from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import threading
import os
import json
import cloudscraper # type: ignore
from bs4 import BeautifulSoup, Tag
import time
import logging
import random
import re
from datetime import datetime, timedelta, timezone
from .websocket import send_progress_sync
from concurrent.futures import ThreadPoolExecutor, as_completed
import queue
from threading import Lock
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional
from urllib.parse import urlparse, urljoin
import requests
from PIL import Image
from io import BytesIO
from nameparser import HumanName
import traceback
from fastapi import status

router = APIRouter()
logger = logging.getLogger(__name__)

class LeagueTeamsRequest(BaseModel):
    league_url: str

class PlayerPosition(BaseModel):
    id: str
    name: str

# Enhanced configuration for robust scraping
ENHANCED_CONFIG = {
    "max_retries": 5,
    "base_delay": 2,
    "max_delay": 30,
    "timeout": 15,
    "max_workers": 3,  # Reduced to be more respectful
    "save_frequency": 5,  # Save every 5 results
}

# Multiple User-Agent strings for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# Варианты Accept заголовков
ACCEPT_HEADERS = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
]

# Варианты Accept-Language заголовков
ACCEPT_LANGUAGE_HEADERS = [
    "en-US,en;q=0.9,de;q=0.8",
    "en-US,en;q=0.9",
    "en-GB,en;q=0.9,de;q=0.8",
    "de-DE,de;q=0.9,en;q=0.8",
    "en,de;q=0.9,fr;q=0.8"
]

# Глобальные флаги для отмены процессов
_cancel_flags = {
    "process_transfermarkt_squads": False,
    "process_transfermarkt_leagues": False,
    "process_players_enhanced": False
}

# Блокировка для безопасного доступа к флагам
_cancel_lock = threading.Lock()

# Пул scrapers для повторного использования
_scraper_pool = queue.Queue()
_scraper_lock = Lock()
_max_scrapers = 6  # Уменьшено для Transfermarkt

# Enhanced scraper pool
_enhanced_scraper_pool = queue.Queue()
_enhanced_scraper_lock = Lock()
_max_enhanced_scrapers = 6

# Конфигурация
SEASON_TO_SCRAPE = "2024"
BASE_URL = "https://www.transfermarkt.com"

# Маппинг национальностей (загружается из файла)
NATION_MAPPING = {}

def load_nation_mapping():
    """Загружает маппинг национальностей из файла"""
    global NATION_MAPPING
    try:
        mapping_file = os.path.join(os.path.dirname(__file__), "../db/tm_fifa_nation_map.json")
        if os.path.exists(mapping_file):
            with open(mapping_file, 'r', encoding='utf-8') as f:
                NATION_MAPPING = json.load(f)
            logger.info(f"Loaded {len(NATION_MAPPING)} nation mappings")
        else:
            logger.warning(f"Nation mapping file not found: {mapping_file}")
            NATION_MAPPING = {}
    except Exception as e:
        logger.error(f"Error loading nation mapping: {e}")
        NATION_MAPPING = {}

# Загружаем маппинг при импорте модуля
load_nation_mapping()

def get_random_headers():
    """Генерация случайных заголовков для обхода детекции"""
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": random.choice(ACCEPT_HEADERS),
        "Accept-Language": random.choice(ACCEPT_LANGUAGE_HEADERS),
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": random.choice(["1", "0"]),
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": random.choice(["document", "empty"]),
        "Sec-Fetch-Mode": random.choice(["navigate", "cors"]),
        "Sec-Fetch-Site": random.choice(["none", "same-origin", "cross-site"]),
        "Cache-Control": random.choice(["max-age=0", "no-cache"]),
    }
    
    # Случайно добавляем дополнительные заголовки
    if random.choice([True, False]):
        headers["Sec-Fetch-User"] = "?1"
    
    if random.choice([True, False]):
        headers["Pragma"] = "no-cache"
    
    # Случайно добавляем Referer
    if random.choice([True, False]):
        referers = [
            "https://www.google.com/",
            "https://www.bing.com/",
            "https://duckduckgo.com/",
            "https://www.transfermarkt.com/"
        ]
        headers["Referer"] = random.choice(referers)
    
    return headers

def get_enhanced_scraper():
    """Get an enhanced scraper with random headers and improved configuration"""
    try:
        scraper = _enhanced_scraper_pool.get_nowait()
        # Update headers for each use
        scraper.headers.update(get_random_headers())
        return scraper
    except queue.Empty:
        scraper = cloudscraper.create_scraper(
            delay=random.uniform(1, 3),
            browser={
                "browser": random.choice(["chrome", "firefox"]),
                "platform": random.choice(["windows", "linux", "darwin"]),
                "mobile": False
            }
        )
        scraper.headers.update(get_random_headers())
        return scraper

def return_enhanced_scraper(scraper):
    """Return scraper to the enhanced pool"""
    if _enhanced_scraper_pool.qsize() < _max_enhanced_scrapers:
        _enhanced_scraper_pool.put(scraper)

HEADERS = {
    "#": ["#", "№"],
    "Player": ["Player", "Spieler", "Giocatore", "Joueur", "Jugador", "Jogador"],
    "Date of birth/Age": [
        "Date of birth/Age", "Geb./Alter", "Data di nascita/Età",
        "Date de naissance/Âge", "Fecha de nacimiento/Edad",
    ],
    "Nat.": ["Nat."],
    "Height": ["Height", "Größe", "Altezza", "Taille", "Altura"],
    "Foot": ["Foot", "Fuß", "Piede", "Pied", "Pie"],
    "Joined": ["Joined", "Seit", "Arrivo", "Arrivée", "Llegó"],
    "Signed from": [
        "Signed from", "Abgebender Verein", "Provenienza",
        "Provenance", "Procedencia",
    ],
    "Contract": [
        "Contract", "Vertrag bis", "Contratto fino",
        "Contrat jusqu'au", "Contrato hasta",
    ],
    "Market value": [
        "Market value", "Marktwert", "Valore di mercato",
        "Valeur marchande", "Valor de mercado",
    ],
}
REQUIRED_HEADERS = {"Player", "Nat.", "Market value"}

# Пути к файлам
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.abspath(os.path.join(BASE_DIR, "../db/teamlinks_from_tm.json"))
OUTPUT_FILE = os.path.abspath(os.path.join(BASE_DIR, "../db/tm_league_squads.json"))
LEAGUES_OUTPUT_FILE = os.path.abspath(os.path.join(BASE_DIR, "../db/LeaguesFromTransfermarkt.json"))

# Константы для парсинга лиг
CONF_SEGMENTS = {
    "europa": "Europe",
    "asien": "Asia/Oceania", 
    "amerika": "America",
    "afrika": "Africa",
}

# Приблизительные оценки числа лиг для прогресса
ESTIMATED_LEAGUES = {
    "Europe": 244,
    "Asia/Oceania": 69,
    "America": 59,
    "Africa": 10,
}

def init_file_paths():
    """Инициализация и проверка путей к файлам"""
    logger.info(f"BASE_DIR: {BASE_DIR}")
    logger.info(f"INPUT_FILE: {INPUT_FILE}")
    logger.info(f"OUTPUT_FILE: {OUTPUT_FILE}")
    logger.info(f"INPUT_FILE exists: {os.path.exists(INPUT_FILE)}")
    logger.info(f"OUTPUT_FILE parent dir: {os.path.dirname(OUTPUT_FILE)}")
    logger.info(f"OUTPUT_FILE parent exists: {os.path.exists(os.path.dirname(OUTPUT_FILE))}")
    
    # Создаем директорию для результатов если не существует
    output_dir = os.path.dirname(OUTPUT_FILE)
    if not os.path.exists(output_dir):
        logger.info(f"Creating output directory: {output_dir}")
        os.makedirs(output_dir, exist_ok=True)
    
    return INPUT_FILE, OUTPUT_FILE

def save_squads_safely(squads_data: list, filepath: str) -> bool:
    """Быстрое сохранение данных составов с сортировкой по teamid"""
    try:
        # Создаем директорию если не существует
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Сортируем по teamid для правильного порядка
        sorted_squads = sorted(squads_data, key=lambda x: int(x.get("teamid", 0)))
        
        logger.info(f"Saving {len(sorted_squads)} squads to {filepath} (sorted by teamid)")
        
        # Сохраняем напрямую в основной файл
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(sorted_squads, f, indent=2, ensure_ascii=False)
        
        # Проверяем что файл создался и имеет содержимое
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            logger.info(f"Successfully saved {len(sorted_squads)} squads to {filepath}")
            return True
        else:
            logger.error(f"File was not created or is empty: {filepath}")
            return False
            
    except Exception as e:
        logger.error(f"Error saving squads to {filepath}: {str(e)}")
        return False

def load_existing_squads(filepath: str) -> list:
    """Быстрая загрузка существующих данных составов"""
    try:
        if not os.path.exists(filepath):
            logger.info(f"Output file does not exist: {filepath}")
            return []
        
        file_size = os.path.getsize(filepath)
        logger.info(f"Loading existing squads from {filepath} (size: {file_size} bytes)")
        
        if file_size == 0:
            logger.warning(f"Output file is empty: {filepath}")
            return []
        
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        if not isinstance(data, list):
            logger.warning(f"Output file does not contain a list: {filepath}")
            return []
        
        logger.info(f"Loaded {len(data)} existing squad records")
        return data
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {filepath}: {e}")
        return []
    except Exception as e:
        logger.error(f"Error loading existing squads from {filepath}: {e}")
        return []

def get_scraper():
    """Получить scraper из пула или создать новый с случайными заголовками"""
    try:
        scraper = _scraper_pool.get_nowait()
        # Обновляем заголовки случайными для каждого использования
        scraper.headers.update(get_random_headers())
        return scraper
    except queue.Empty:
        scraper = cloudscraper.create_scraper(
            delay=3,  # Уменьшена задержка для скорости
            browser={
                "browser": random.choice(["chrome", "firefox"]),
                "platform": random.choice(["windows", "linux", "darwin"]),
                "mobile": False
            }
        )
        # Настройка сессии со случайными заголовками
        scraper.headers.update(get_random_headers())
        return scraper

def return_scraper(scraper):
    """Вернуть scraper в пул"""
    if _scraper_pool.qsize() < _max_scrapers:
        _scraper_pool.put(scraper)

def set_cancel_flag(function_name: str, value: bool = True):
    """Установить флаг отмены для функции"""
    with _cancel_lock:
        if function_name in _cancel_flags:
            _cancel_flags[function_name] = value
            logger.info(f"Cancel flag for {function_name} set to {value}")

def get_cancel_flag(function_name: str) -> bool:
    """Проверить флаг отмены для функции"""
    with _cancel_lock:
        return _cancel_flags.get(function_name, False)

def reset_cancel_flag(function_name: str):
    """Сбросить флаг отмены для функции"""
    set_cancel_flag(function_name, False)

def format_time_remaining(seconds):
    """Форматирует время в читаемый вид"""
    if seconds < 60:
        return f"{int(seconds)} сек"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}м {secs}с"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}ч {minutes}м"

def utc_now_iso() -> str:
    """Return current UTC time in ISO-8601 without microseconds."""
    return datetime.utcnow().replace(tzinfo=timezone.utc, microsecond=0).isoformat()

def parse_tm_club_url(url: str) -> Tuple[str | None, str | None]:
    """Extract (slug, verein_id) from a Transfermarkt club URL."""
    # Улучшенное регулярное выражение для парсинга URL Transfermarkt
    patterns = [
        # Основной паттерн: /team-name/startseite/verein/123
        r"transfermarkt\.[^/]+/([^/]+)/startseite/verein/(\d+)",
        # Альтернативный паттерн: /team-name/kader/verein/123
        r"transfermarkt\.[^/]+/([^/]+)/kader/verein/(\d+)", 
        # Паттерн с дополнительными сегментами
        r"transfermarkt\.[^/]+/([^/]+)/[^/]+/verein/(\d+)"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            slug, vid = match.groups()
            logger.debug(f"Parsed URL {url}: slug={slug}, vid={vid}")
            return slug, vid
    
    # Fallback: попробуем парсить по частям пути
    try:
        parts = [p for p in urlparse(url).path.split("/") if p]
        if "verein" in parts:
            idx = parts.index("verein")
            if idx > 0 and idx + 1 < len(parts):
                slug = parts[idx - 2] if idx > 1 else parts[0]  # Берем название команды
                vid = parts[idx + 1]
                logger.debug(f"Fallback parsing for {url}: slug={slug}, vid={vid}")
                return slug, vid
    except (ValueError, IndexError) as e:
        logger.warning(f"Failed to parse URL {url}: {e}")
    
    logger.error(f"Could not parse Transfermarkt URL: {url}")
    return None, None

def squad_url(slug: str | None, vid: str | None, name: str) -> str | None:
    """Construct the squad (kader) URL for given slug & ID."""
    if not slug or not vid:
        return None
    # Arsenal special case
    if name.lower() == "arsenal" and slug == "fc-arsenal":
        slug = "arsenal-fc"
    return f"{BASE_URL}/{slug}/kader/verein/{vid}/saison_id/{SEASON_TO_SCRAPE}/plus/1"

def get_html(url: str, scraper: cloudscraper.CloudScraper, retries: int = 5, function_name: str = "process_transfermarkt_squads") -> str:
    """Fetch HTML with improved error handling, random headers and reduced delays"""
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Fetching URL (attempt {attempt}): {url}")
            
            # Проверяем отмену перед задержкой
            if get_cancel_flag(function_name):
                logger.info(f"Process cancelled during HTML fetch for {url}")
                return ""
            
            # Уменьшенная задержка для ускорения с проверкой отмены
            delay = random.uniform(1, 3)
            sleep_steps = max(1, int(delay))
            for _ in range(sleep_steps):
                if get_cancel_flag(function_name):
                    logger.info(f"Process cancelled during delay for {url}")
                    return ""
                time.sleep(min(1.0, delay / sleep_steps))
            
            # Используем случайные заголовки для каждого запроса
            random_headers = get_random_headers()
            response = scraper.get(url, headers=random_headers, timeout=45)
            
            if response.status_code == 200:
                logger.info(f"Successfully fetched URL: {url}")
                return response.text
            elif response.status_code == 429:
                # Rate limiting - увеличиваем задержку
                wait_time = 20 * attempt + random.randint(5, 15)
                logger.warning(f"Rate limited (429) for {url}, waiting {wait_time}s")
                
                # Разбиваем ожидание на части для проверки отмены
                wait_steps = max(1, wait_time // 5)
                for _ in range(wait_steps):
                    if get_cancel_flag(function_name):
                        logger.info(f"Process cancelled during rate limit wait for {url}")
                        return ""
                    time.sleep(min(5.0, wait_time / wait_steps))
                continue
            elif response.status_code == 403:
                # Forbidden - может быть блокировка
                wait_time = 30 + random.randint(15, 30)
                logger.warning(f"Forbidden (403) for {url}, waiting {wait_time}s")
                
                # Разбиваем ожидание на части для проверки отмены
                wait_steps = max(1, wait_time // 10)
                for _ in range(wait_steps):
                    if get_cancel_flag(function_name):
                        logger.info(f"Process cancelled during forbidden wait for {url}")
                        return ""
                    time.sleep(min(10.0, wait_time / wait_steps))
                continue
            elif response.status_code == 404:
                logger.warning(f"Not found (404): {url}")
                return ""
            else:
                logger.warning(f"HTTP {response.status_code} for {url}")
                
        except Exception as e:
            logger.error(f"Attempt {attempt} failed for {url}: {str(e)}")
            if attempt < retries:
                wait_time = 5 * attempt + random.randint(3, 10)
                logger.info(f"Waiting {wait_time}s before retry...")
                
                # Разбиваем ожидание на части для проверки отмены
                wait_steps = max(1, wait_time // 3)
                for _ in range(wait_steps):
                    if get_cancel_flag(function_name):
                        logger.info(f"Process cancelled during retry wait for {url}")
                        return ""
                    time.sleep(min(3.0, wait_time / wait_steps))
    
    logger.error(f"Failed to fetch {url} after {retries} attempts")
    return ""

def map_headers(row: Tag) -> Dict[str, int]:
    """Map table headers to column indices."""
    titles = [th.get_text(strip=True) for th in row.find_all("th")]
    idx: Dict[str, int] = {}
    for canon, variants in HEADERS.items():
        for v in variants:
            if v in titles:
                idx[canon] = titles.index(v)
                break
    return idx

def td(cells: List[Tag], idx: Dict[str, int], key: str) -> Tag | None:
    """Get table cell by header key."""
    i = idx.get(key)
    return cells[i] if i is not None and i < len(cells) else None

def parse_player_row(tr: Tag, idx: Dict[str, int]) -> Optional[Dict[str, Any]]:
    """Parse a single player row from the squad table."""
    cells = tr.find_all("td", recursive=False)
    if len(cells) < 10:  # Ensure we have enough columns
        return None

    # Extract player number from first column
    player_number = "-"
    number_cell = cells[0]
    if number_cell:
        number_div = number_cell.find("div", class_="rn_nummer")
        if number_div:
            player_number = number_div.get_text(strip=True)

    # Extract player info from second column (complex structure)
    pcell = cells[1]  # Player column
    if not pcell:
        return None

    # Find player link and name
    a = pcell.select_one('a[href*="/profil/spieler/"]')
    if not a:
        return None

    rel = a["href"]
    href = rel if rel.startswith("http") else f"{BASE_URL}{rel}"
    pid_match = re.search(r"/spieler/(\d+)", href)
    if not pid_match:
        return None
    pid = pid_match.group(1)

    player_name = a.get_text(strip=True)
    
    # Extract player photo URL
    player_photo_url = "N/A"
    img_tag = pcell.select_one('img.bilderrahmen-fixed')
    if img_tag and img_tag.get('data-src'):
        player_photo_url = img_tag['data-src']
    elif img_tag and img_tag.get('src'):
        player_photo_url = img_tag['src']

    # Extract position from inline table
    position = "N/A"
    inline_table = pcell.find("table", class_="inline-table")
    if inline_table:
        rows = inline_table.find_all("tr")
        if len(rows) > 1:
            position_cell = rows[1].find("td")
            if position_cell:
                position = position_cell.get_text(strip=True)

    # Extract nationality from fourth column (index 3)
    nationality = "N/A"
    # Use idx.get("nationality", 3) if you plan to use the idx dictionary,
    # otherwise, hardcoding 3 is fine if the column index is stable.
    # For this modification, I'll stick to the original hardcoded index 3.
    nationality_column_index = 3 # Or potentially idx.get("nationality")
    if len(cells) > nationality_column_index:
        nat_cell = cells[nationality_column_index]
        if nat_cell:
            # Find the *first* flag image for nationality
            first_flag = nat_cell.find("img", class_="flaggenrahmen")
            if first_flag:
                nat_name = first_flag.get("title") or first_flag.get("alt") or ""
                if nat_name: # Ensure nat_name is not empty
                    nationality = nat_name
            # If no flag is found, or if the flag has no title/alt, nationality remains "N/A"

    # Extract market value from last column (index 9)
    # Use idx.get("market_value", 9) if you plan to use the idx dictionary.
    market_value_column_index = 9 # Or potentially idx.get("market_value")
    market_value = "-"
    if len(cells) > market_value_column_index: # Ensure cell exists
        value_cell = cells[market_value_column_index]  # Market value column
        if value_cell:
            value_link = value_cell.find("a")
            if value_link:
                market_value = value_link.get_text(strip=True)
            else:
                # Sometimes it's just text without link
                market_value = value_cell.get_text(strip=True)
    else: # If the column doesn't exist (e.g., less than 10 columns checked earlier but maybe not for this specific index)
        market_value = "-"


    return {
        "player_number": player_number,
        "player_name": player_name,
        "player_position": position,
        "player_nationality": nationality,
        "market_value_eur": market_value,
        "player_profile_url": href,
        "player_id": pid,
        "player_photo_url": player_photo_url
    }

def scrape_squad(url: str, scraper: cloudscraper.CloudScraper, function_name: str = "process_transfermarkt_squads") -> Tuple[List[Dict[str, Any]], str]:
    """Scrape squad data from a Transfermarkt team page."""
    try:
        logger.info(f"Scraping squad from: {url}")
        response = scraper.get(url, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Find the squad table
        table = soup.find("table", class_="items")
        if not table:
            logger.warning(f"No squad table found on {url}")
            return [], "No squad table found"
        
        tbody = table.find("tbody")
        if not tbody:
            logger.warning(f"No tbody found in squad table on {url}")
            return [], "No tbody found in squad table"
        
        rows = tbody.find_all("tr")
        if not rows:
            logger.warning(f"No player rows found in squad table on {url}")
            return [], "No player rows found"
        
        players = []
        occupied_numbers = set()
        for row in rows:
            try:
                player_data = parse_player_row(row, {})  # Empty dict since we don't use idx anymore
                if player_data:
                    players.append(player_data)
                    if player_data["player_number"] != "-":
                        try:
                            occupied_numbers.add(int(player_data["player_number"]))
                        except ValueError:
                            # Handle cases where player_number might not be a simple integer string
                            logger.warning(f"Could not parse player number: {player_data['player_number']} for player {player_data['player_name']}")
            except Exception as e:
                logger.warning(f"Error parsing player row: {e}")
                continue
        
        if not players:
            return [], "No players could be parsed from the table"
        
        # Assign available numbers to players without one
        available_number = 1
        for player in players:
            if player["player_number"] == "-":
                while available_number in occupied_numbers:
                    available_number += 1
                if available_number <= 99:
                    player["player_number"] = str(available_number)
                    occupied_numbers.add(available_number)
                    available_number += 1
                else:
                    # No more numbers available in 1-99 range
                    logger.warning(f"No available number (1-99) for player {player['player_name']}")
                    # Keep player_number as "-" or assign a special value if needed
        
        logger.info(f"Successfully scraped {len(players)} players from {url}")
        return players, "Success"
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error while scraping {url}: {e}")
        return [], f"Request error: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error while scraping {url}: {e}")
        return [], f"Unexpected error: {str(e)}"

def process_single_team_squad(team_data_with_existing, function_name="process_transfermarkt_squads"):
    """Обработка одной команды для скрапинга состава с улучшенной обработкой ошибок"""
    team, existing_squads = team_data_with_existing
    tid = str(team["teamid"])
    name = team["teamname"]
    
    logger.info(f"Processing team: {name} (ID: {tid})")
    
    try:
        # Проверяем отмену перед началом обработки
        if get_cancel_flag(function_name):
            logger.info(f"Process cancelled while processing team {name}")
            return None
            
        slug, vid = parse_tm_club_url(team["transfermarkt_url"])
        url_sq = squad_url(slug, vid, name)

        record: Dict[str, Any] = {
            "teamid": tid,
            "teamname": name,
            "transfermarkt_url": team["transfermarkt_url"],
            "players": [],
            "updated_date": utc_now_iso(),
        }

        if not url_sq:
            record["scraping_error"] = "Bad squad URL"
            logger.warning(f"Bad squad URL for team {name}: {team['transfermarkt_url']}")
            return record

        # Уменьшенная задержка с проверкой отмены
        delay = random.uniform(2, 5)
        logger.info(f"Waiting {delay:.1f}s before processing {name}")
        
        # Разбиваем задержку на части для быстрой отмены
        sleep_intervals = max(1, int(delay))
        remaining_delay = delay
        for _ in range(sleep_intervals):
            if get_cancel_flag(function_name):
                logger.info(f"Process cancelled during delay for team {name}")
                return None
            sleep_time = min(1.0, remaining_delay)
            time.sleep(sleep_time)
            remaining_delay -= sleep_time
            if remaining_delay <= 0:
                break

        # Проверяем отмену перед скрапингом
        if get_cancel_flag(function_name):
            logger.info(f"Process cancelled before scraping team {name}")
            return None

        scraper = get_scraper()
        try:
            players, status = scrape_squad(url_sq, scraper, function_name)
            record["players"] = players
            if status != "Success":
                record["scraping_error"] = status
                
            logger.info(f"Team {name}: {len(players)} players, status: {status}")
            
        finally:
            return_scraper(scraper)
        
        return record
        
    except Exception as e:
        error_msg = f"Error processing team {name} ({tid}): {str(e)}"
        logger.error(error_msg)
        record = {
            "teamid": tid,
            "teamname": name,
            "transfermarkt_url": team.get("transfermarkt_url", ""),
            "players": [],
            "updated_date": utc_now_iso(),
            "scraping_error": str(e)
        }
        return record

def process_transfermarkt_squads():
    """Основная функция обработки составов команд с Transfermarkt"""
    function_name = "process_transfermarkt_squads"
    reset_cancel_flag(function_name)
    
    try:
        # Проверяем флаг отмены
        if get_cancel_flag(function_name):
            logger.info("Process cancelled before start")
            send_progress_sync({
                "type": "progress",
                "status": "cancelled",
                "message": "Процесс отменен",
                "function_name": function_name
            })
            return []

        # Инициализация путей к файлам
        input_file, output_file = init_file_paths()

        # Загрузка существующих данных
        existing_squads = load_existing_squads(output_file)

        # Загрузка команд для обработки
        if not os.path.exists(input_file):
            error_msg = f"Файл с командами не найден: {input_file}"
            logger.error(error_msg)
            send_progress_sync({
                "type": "error",
                "message": error_msg,
                "status": "error",
                "function_name": function_name
            })
            return []

        try:
            with open(input_file, "r", encoding="utf-8") as f:
                league_teams = json.load(f)
        except Exception as e:
            error_msg = f"Ошибка чтения файла команд {input_file}: {str(e)}"
            logger.error(error_msg)
            send_progress_sync({
                "type": "error",
                "message": error_msg,
                "status": "error",
                "function_name": function_name
            })
            return []

        logger.info(f"Total teams in source file: {len(league_teams)}")

        # Определение команд для обработки
        error_ids = {str(t["teamid"]) for t in existing_squads if "scraping_error" in t}
        last_updated = {
            str(t["teamid"]): t.get("updated_date", "1970-01-01T00:00:00+00:00")
            for t in existing_squads if isinstance(t, dict)
        }

        known_ids = set(last_updated)
        new_ids = {str(t["teamid"]) for t in league_teams} - known_ids
        
        # Построение очереди: ошибки → новые → остальные по дате обновления
        error_teams = [t for t in league_teams if str(t["teamid"]) in error_ids]
        new_teams = [t for t in league_teams if str(t["teamid"]) in new_ids]
        rest = [
            t for t in league_teams
            if str(t["teamid"]) not in error_ids and str(t["teamid"]) not in new_ids
        ]
        rest_sorted = sorted(rest, key=lambda t: last_updated.get(str(t["teamid"]), "1970-01-01T00:00:00+00:00"))

        teams_to_process = error_teams + new_teams + rest_sorted

        if not teams_to_process:
            logger.info("No teams to process")
            send_progress_sync({
                "type": "progress",
                "current": 0,
                "total": 0,
                "teamid": "",
                "teamname": "Нет команд для обработки",
                "status": "completed",
                "percentage": 100,
                "function_name": function_name
            })
            return existing_squads

        logger.info(f"Processing {len(teams_to_process)} teams: {len(error_teams)} errors, {len(new_teams)} new")

        # Статистика
        start_time = datetime.now()
        completed_count = 0
        successful_count = 0

        # Отправляем начальный прогресс
        send_progress_sync({
            "type": "progress",
            "current": 0,
            "total": len(teams_to_process),
            "teamid": "",
            "teamname": f"Начинаем обработку {len(teams_to_process)} команд...",
            "status": "starting",
            "percentage": 0,
            "estimated_time_remaining": "Расчет...",
            "function_name": function_name
        })

        # Последовательная обработка команд по одной
        logger.info(f"Processing {len(teams_to_process)} teams sequentially")
        
        for team_idx, team in enumerate(teams_to_process):
            # Проверяем флаг отмены
            if get_cancel_flag(function_name):
                logger.info(f"Process cancelled at team {completed_count + 1}/{len(teams_to_process)}")
                send_progress_sync({
                    "type": "progress",
                    "current": completed_count,
                    "total": len(teams_to_process),
                    "status": "cancelled",
                    "message": "Процесс отменен пользователем",
                    "percentage": round((completed_count / len(teams_to_process)) * 100, 1),
                    "function_name": function_name
                })
                break

            try:
                # Обрабатываем команду
                result = process_single_team_squad((team, existing_squads), function_name)
                
                # Если процесс отменен, result будет None
                if result is None:
                    logger.info("Process cancelled - breaking from main loop")
                    break
                    
                completed_count += 1
                
                # Подсчет успешных обработок
                if "scraping_error" not in result:
                    successful_count += 1

                # Обновляем существующие данные
                tid = result["teamid"]
                existing_squads = [s for s in existing_squads if str(s.get("teamid")) != tid]
                existing_squads.append(result)

                # Сохраняем после каждой команды для максимальной скорости и безопасности
                save_success = save_squads_safely(existing_squads, output_file)
                if not save_success:
                    logger.error("Failed to save results - continuing but data may be lost")

                # Расчет оставшегося времени
                elapsed_time = (datetime.now() - start_time).total_seconds()
                if completed_count > 0:
                    avg_time_per_team = elapsed_time / completed_count
                    remaining_teams = len(teams_to_process) - completed_count
                    estimated_remaining_seconds = remaining_teams * avg_time_per_team
                    estimated_time_str = format_time_remaining(estimated_remaining_seconds)
                    
                    estimated_completion = datetime.now() + timedelta(seconds=estimated_remaining_seconds)
                    estimated_completion_str = estimated_completion.strftime("%H:%M")
                else:
                    estimated_time_str = "Расчет..."
                    estimated_completion_str = "Расчет..."

                # Расчет процентов
                current_percentage = round((completed_count / len(teams_to_process)) * 100, 1)
                success_percentage = round((successful_count / completed_count) * 100, 1) if completed_count > 0 else 0

                # Скорость обработки
                teams_per_minute = round((completed_count / elapsed_time) * 60, 1) if elapsed_time > 0 else 0

                # Отправка прогресса через websocket
                progress_data = {
                    "type": "progress",
                    "current": completed_count,
                    "total": len(teams_to_process),
                    "teamid": result["teamid"],
                    "teamname": result["teamname"],
                    "status": "processing",
                    "percentage": current_percentage,
                    "successful_teams": successful_count,
                    "success_percentage": success_percentage,
                    "players_found": len(result.get("players", [])),
                    "has_error": "scraping_error" in result,
                    "estimated_time_remaining": estimated_time_str,
                    "estimated_completion_time": estimated_completion_str,
                    "elapsed_time": format_time_remaining(elapsed_time),
                    "processing_speed": teams_per_minute,
                    "last_updated": datetime.now().isoformat(),
                    "function_name": function_name
                }

                send_progress_sync(progress_data)
                logger.info(f"Progress sent: {completed_count}/{len(teams_to_process)} ({current_percentage}%) - {result['teamname']}")

            except Exception as e:
                logger.error(f"Error processing team {team.get('teamname', 'Unknown')}: {e}")
                completed_count += 1

        # Финальное сохранение
        final_save_success = save_squads_safely(existing_squads, output_file)
        if final_save_success:
            logger.info(f"Final save successful: {len(existing_squads)} squads saved")
        else:
            logger.error("Final save failed!")

        # Финальная статистика
        total_elapsed = (datetime.now() - start_time).total_seconds()

        # Отправляем финальный прогресс только если процесс не был отменен
        if not get_cancel_flag(function_name):
            send_progress_sync({
                "type": "progress",
                "current": completed_count,
                "total": len(teams_to_process),
                "teamid": "",
                "teamname": f"Обработка завершена! Команд: {completed_count}, успешно: {successful_count}",
                "status": "completed",
                "percentage": 100,
                "successful_teams": successful_count,
                "success_percentage": round((successful_count / completed_count) * 100, 1) if completed_count > 0 else 0,
                "estimated_time_remaining": "Завершено",
                "estimated_completion_time": datetime.now().strftime("%H:%M"),
                "elapsed_time": format_time_remaining(total_elapsed),
                "total_elapsed_time": format_time_remaining(total_elapsed),
                "function_name": function_name
            })

        logger.info(f"Transfermarkt squads processing completed. Total teams: {completed_count}, Successful: {successful_count}")
        return existing_squads

    except Exception as e:
        error_msg = f"Critical error in process_transfermarkt_squads: {str(e)}"
        logger.error(error_msg)
        send_progress_sync({
            "type": "error",
            "message": error_msg,
            "status": "error",
            "function_name": function_name
        })
        return []

def background_scrape_transfermarkt_squads():
    """Фоновая задача для скрапинга составов Transfermarkt"""
    logger.info("Starting background Transfermarkt squads scrape task")
    process_transfermarkt_squads()

@router.post("/transfermarkt/scrape_squads", tags=["transfermarkt"])
def scrape_transfermarkt_squads(background_tasks: BackgroundTasks):
    """
    Запускает процесс сбора составов команд с Transfermarkt в фоне.
    """
    background_tasks.add_task(background_scrape_transfermarkt_squads)
    logger.info("Transfermarkt squads scrape task added to background tasks")
    return {"status": "processing", "message": "Загрузка составов команд с Transfermarkt начата в фоне. Проверьте файл tm_league_squads.json позже."}

@router.get("/transfermarkt/squads", tags=["transfermarkt"])
def get_transfermarkt_squads():
    """
    Получить текущий результат скрапинга составов команд с Transfermarkt.
    """
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    else:
        return []

@router.post("/transfermarkt/cancel_process", tags=["transfermarkt"])
def cancel_transfermarkt_process(function_name: str):
    """
    Отменить выполняющийся процесс Transfermarkt по имени функции.
    """
    if function_name not in _cancel_flags:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": f"Unknown process: {function_name}"}
        )
    
    set_cancel_flag(function_name, True)
    
    # Отправляем уведомление об отмене через WebSocket
    send_progress_sync({
        "type": "progress",
        "status": "cancelling",
        "message": f"Отмена процесса {function_name}...",
        "function_name": function_name
    })
    
    logger.info(f"Cancel requested for Transfermarkt process: {function_name}")
    return {"status": "success", "message": f"Процесс {function_name} будет отменен"}

@router.get("/transfermarkt/process_status", tags=["transfermarkt"])
def get_transfermarkt_process_status():
    """
    Получить статус всех процессов Transfermarkt (активные/отмененные).
    """
    with _cancel_lock:
        status = {name: {"cancelled": flag} for name, flag in _cancel_flags.items()}
    return status

def find_idx(headers: list, *keywords: str) -> int | None:
    """
    Возвращает индекс первого заголовка из headers, содержащего все
    ключевые слова *keywords* (регистр игнорируется). Если не найдено — None.
    """
    keywords = [k.lower() for k in keywords]
    for i, text in enumerate(headers):
        if all(k in text.lower() for k in keywords):
            return i
    return None

def to_int(text: str) -> int:
    """Извлекает первое целое число из произвольной строки."""
    return int(re.sub(r"[^\d]", "", text) or 0)

def process_transfermarkt_leagues():
    """Основная функция парсинга лиг с Transfermarkt (до 5 дивизионов)"""
    function_name = "process_transfermarkt_leagues"
    reset_cancel_flag(function_name)
    
    try:
        # Проверяем флаг отмены
        if get_cancel_flag(function_name):
            logger.info("Leagues parsing cancelled before start")
            send_progress_sync({
                "type": "progress",
                "status": "cancelled",
                "message": "Процесс отменен",
                "function_name": function_name
            })
            return {}

        total_estimate = sum(ESTIMATED_LEAGUES.values())
        done_counter = 0
        start_time = datetime.now()

        # Создаем структуру данных
        confederations = [
            {
                "confederation_name": name,
                "url": f"{BASE_URL}/wettbewerbe/{seg}/wettbewerbe?plus=1",
                "leagues": [],
            }
            for seg, name in CONF_SEGMENTS.items()
        ]

        # Отправляем начальный прогресс
        send_progress_sync({
            "type": "progress",
            "current": 0,
            "total": total_estimate,
            "status": "starting",
            "percentage": 0,
            "message": f"Начинаем парсинг лиг из {len(confederations)} конфедераций...",
            "function_name": function_name
        })

        for conf_idx, conf in enumerate(confederations):
            # Проверяем отмену
            if get_cancel_flag(function_name):
                logger.info(f"Leagues parsing cancelled at confederation {conf['confederation_name']}")
                break

            logger.info(f"Processing confederation: {conf['confederation_name']}")
            leagues = []
            page = 1
            tier = None

            while True:
                # Проверяем отмену перед каждой страницей
                if get_cancel_flag(function_name):
                    logger.info(f"Process cancelled during {conf['confederation_name']} page {page}")
                    break

                url = conf["url"] if page == 1 else f"{conf['url']}&page={page}"
                
                try:
                    scraper = get_scraper()
                    try:
                        html = get_html(url, scraper, function_name=function_name)
                        if not html:
                            logger.warning(f"Failed to get HTML for {url}")
                            break
                        
                        soup = BeautifulSoup(html, "html.parser")
                        table = soup.find("table", class_="items")
                        if not table or not table.find("thead"):
                            logger.warning(f"No table found on page {page} of {conf['confederation_name']}")
                            break

                        headers = [
                            th.get_text(" ", strip=True)
                            for th in table.find("thead").find_all("th")
                        ]

                        idx_comp = find_idx(headers, "competition")
                        idx_ctry = find_idx(headers, "country")
                        idx_club = find_idx(headers, "club")
                        idx_avg = find_idx(headers, "average", "value")
                        idx_total = find_idx(headers, "total", "value")

                        if None in (idx_comp, idx_ctry, idx_club, idx_total):
                            logger.warning(f"Missing required headers in {conf['confederation_name']} page {page}")
                            break

                        tbody = table.find("tbody")
                        if not tbody:
                            break

                        page_leagues = 0
                        for tr in tbody.find_all("tr", recursive=False):
                            # Проверяем отмену
                            if get_cancel_flag(function_name):
                                break

                            cells = tr.find_all("td", recursive=False)

                            # Определяем уровень (tier)
                            if cells and cells[0].has_attr("colspan"):
                                txt = tr.get_text(" ", strip=True).lower()
                                if "first tier" in txt: 
                                    tier = 1
                                elif "second tier" in txt: 
                                    tier = 2
                                elif "third tier" in txt: 
                                    tier = 3
                                elif "fourth tier" in txt: 
                                    tier = 4
                                elif "fifth tier" in txt: 
                                    tier = 5
                                elif "sixth tier" in txt:
                                    # Останавливаемся на 6-м дивизионе
                                    break
                                else:
                                    tier = None
                                continue

                            if tier is None or tier > 5:
                                continue

                            max_idx = max(idx_comp, idx_ctry, idx_club, idx_total, idx_avg or 0)
                            if len(cells) <= max_idx:
                                continue

                            # Парсим Competition, logo, URL
                            comp_cell = cells[idx_comp]
                            logo_tag = comp_cell.find("img")
                            logo_url = ""
                            if logo_tag and logo_tag.get("src"):
                                src = logo_tag["src"]
                                logo_url = ("https:" + src) if src.startswith("//") else f"{BASE_URL}{src}"

                            competition = ""
                            competition_url = ""
                            for a in comp_cell.find_all("a", href=True):
                                text = a.get_text(strip=True)
                                if text:
                                    competition = text
                                    competition_url = f"{BASE_URL}{a['href']}" if not a['href'].startswith('http') else a['href']
                                    break

                            # Парсим страну
                            ctry_cell = cells[idx_ctry]
                            flag = ctry_cell.find("img")
                            country = (
                                flag["title"].strip()
                                if flag and flag.get("title")
                                else ctry_cell.get_text(strip=True)
                            )

                            # Количество клубов
                            clubs = to_int(cells[idx_club].get_text())

                            # Значения
                            avg_val = cells[idx_avg].get_text(strip=True) if idx_avg is not None else "-"
                            total_val = cells[idx_total].get_text(strip=True)

                            leagues.append({
                                "tier": tier,
                                "competition": competition,
                                "competition_url": competition_url,
                                "competition_logo_url": logo_url,
                                "country": country,
                                "clubs": clubs,
                                "average_market_value": avg_val,
                                "total_value": total_val,
                            })

                            # Обновляем прогресс
                            done_counter += 1
                            page_leagues += 1

                            percentage = min(int(done_counter / total_estimate * 100), 99)
                            elapsed_time = (datetime.now() - start_time).total_seconds()
                            
                            if elapsed_time > 0:
                                leagues_per_second = done_counter / elapsed_time
                                remaining_leagues = total_estimate - done_counter
                                estimated_remaining = remaining_leagues / leagues_per_second if leagues_per_second > 0 else 0
                                eta_str = format_time_remaining(estimated_remaining)
                            else:
                                eta_str = "Расчет..."

                            # Отправляем прогресс каждые 5 лиг
                            if done_counter % 5 == 0:
                                send_progress_sync({
                                    "type": "progress",
                                    "current": done_counter,
                                    "total": total_estimate,
                                    "status": "processing",
                                    "percentage": percentage,
                                    "message": f"Парсинг {conf['confederation_name']} (стр. {page}): {competition}",
                                    "confederation": conf['confederation_name'],
                                    "page": page,
                                    "page_leagues": page_leagues,
                                    "estimated_time_remaining": eta_str,
                                    "elapsed_time": format_time_remaining(elapsed_time),
                                    "function_name": function_name
                                })

                    finally:
                        return_scraper(scraper)

                    # Проверяем пагинацию
                    next_link = soup.select_one(f'a[href*="page={page+1}"]')
                    if next_link and page < 300:
                        page += 1
                        # Добавляем задержку между страницами
                        if not get_cancel_flag(function_name):
                            time.sleep(random.uniform(2, 4))
                    else:
                        break

                except Exception as e:
                    logger.error(f"Error processing page {page} of {conf['confederation_name']}: {e}")
                    break

            conf["leagues"] = leagues
            logger.info(f"Completed {conf['confederation_name']}: {len(leagues)} leagues")

        # Проверяем отмену перед сохранением
        if get_cancel_flag(function_name):
            send_progress_sync({
                "type": "progress",
                "status": "cancelled",
                "message": "Процесс отменен пользователем",
                "function_name": function_name
            })
            return {}

        # Сохраняем результат
        os.makedirs(os.path.dirname(LEAGUES_OUTPUT_FILE), exist_ok=True)
        now = datetime.now()
        data = {
            "last_updated": {
                "timestamp": int(now.timestamp()),
                "date": now.strftime("%Y-%m-%d %H:%M:%S"),
            },
            "confederations": confederations,
        }

        with open(LEAGUES_OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Финальный прогресс
        total_elapsed = (datetime.now() - start_time).total_seconds()
        total_leagues = sum(len(conf["leagues"]) for conf in confederations)

        send_progress_sync({
            "type": "progress",
            "current": total_leagues,
            "total": total_leagues,
            "status": "completed",
            "percentage": 100,
            "message": f"Парсинг завершен! Собрано {total_leagues} лиг из {len(confederations)} конфедераций",
            "estimated_time_remaining": "Завершено",
            "elapsed_time": format_time_remaining(total_elapsed),
            "function_name": function_name
        })

        logger.info(f"Leagues parsing completed. Total leagues: {total_leagues}")
        return data

    except Exception as e:
        error_msg = f"Critical error in process_transfermarkt_leagues: {str(e)}"
        logger.error(error_msg)
        send_progress_sync({
            "type": "error",
            "message": error_msg,
            "status": "error",
            "function_name": function_name
        })
        return {}

def background_scrape_transfermarkt_leagues():
    """Фоновая задача для парсинга лиг Transfermarkt"""
    logger.info("Starting background Transfermarkt leagues scrape task")
    process_transfermarkt_leagues()

@router.post("/transfermarkt/scrape_leagues", tags=["transfermarkt"])
def scrape_transfermarkt_leagues(background_tasks: BackgroundTasks):
    """
    Запускает процесс сбора лиг с Transfermarkt (до 5 дивизионов) в фоне.
    """
    background_tasks.add_task(background_scrape_transfermarkt_leagues)
    logger.info("Transfermarkt leagues scrape task added to background tasks")
    return {"status": "processing", "message": "Загрузка лиг с Transfermarkt начата в фоне. Проверьте файл LeaguesFromTransfermarkt.json позже."}

@router.get("/transfermarkt/leagues", tags=["transfermarkt"])
def get_transfermarkt_leagues():
    """
    Получить текущий результат парсинга лиг с Transfermarkt.
    """
    if os.path.exists(LEAGUES_OUTPUT_FILE):
        try:
            with open(LEAGUES_OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data
        except Exception as e:
            logger.error(f"Error reading leagues file: {e}")
            return {"error": f"Failed to read leagues file: {e}"}
    else:
        return {"error": "Leagues file not found", "file_path": LEAGUES_OUTPUT_FILE}

def normalize_url(url: str, base_url: str = "https://sofifa.com") -> str:
    """Normalize and validate URLs"""
    if not url:
        return ""
    
    # Handle different URL formats
    if url.startswith("//"):
        return "https:" + url
    elif url.startswith("/"):
        return urljoin(base_url, url)
    elif url.startswith("http"):
        return url
    else:
        return urljoin(base_url, url)

def extract_transfermarkt_urls_comprehensive(soup: BeautifulSoup) -> List[str]:
    """
    Comprehensive extraction of Transfermarkt URLs using multiple strategies
    """
    urls = []
    
    # Strategy 1: Direct link with "Transfermarkt" text
    transfermarkt_links = soup.find_all("a", string=lambda text: text and "transfermarkt" in text.lower())
    for link in transfermarkt_links:
        href = link.get("href")
        if href:
            urls.append(normalize_url(href))
    
    # Strategy 2: Links containing transfermarkt in href
    transfermarkt_href_links = soup.find_all("a", href=lambda href: href and "transfermarkt" in href.lower())
    for link in transfermarkt_href_links:
        href = link.get("href")
        if href:
            urls.append(normalize_url(href))
    
    # Strategy 3: Look for external links section
    external_links_section = soup.find("div", class_=lambda x: x and "external" in x.lower())
    if external_links_section:
        for link in external_links_section.find_all("a"):
            href = link.get("href")
            if href and "transfermarkt" in href.lower():
                urls.append(normalize_url(href))
    
    # Strategy 4: Look for links in sidebar or info sections
    info_sections = soup.find_all("div", class_=lambda x: x and any(keyword in x.lower() for keyword in ["info", "sidebar", "details", "profile"]))
    for section in info_sections:
        for link in section.find_all("a"):
            href = link.get("href")
            if href and "transfermarkt" in href.lower():
                urls.append(normalize_url(href))
    
    # Strategy 5: Look for any link with transfermarkt domain
    all_links = soup.find_all("a", href=True)
    for link in all_links:
        href = link.get("href")
        if href and "transfermarkt" in href.lower():
            urls.append(normalize_url(href))
    
    # Strategy 6: Look in script tags for transfermarkt URLs
    script_tags = soup.find_all("script")
    for script in script_tags:
        if script.string:
            # Use regex to find transfermarkt URLs in JavaScript
            transfermarkt_matches = re.findall(r'https?://[^"\s]*transfermarkt[^"\s]*', script.string)
            for match in transfermarkt_matches:
                urls.append(match)
    
    # Strategy 7: Look in data attributes
    elements_with_data = soup.find_all(attrs={"data-href": True})
    for element in elements_with_data:
        data_href = element.get("data-href")
        if data_href and "transfermarkt" in data_href.lower():
            urls.append(normalize_url(data_href))
    
    # Remove duplicates and filter valid URLs
    unique_urls = []
    seen = set()
    for url in urls:
        if url and url not in seen and "transfermarkt" in url.lower():
            # Validate that it's a proper transfermarkt URL
            if re.search(r'transfermarkt\.[a-z]+', url.lower()):
                unique_urls.append(url)
                seen.add(url)
    
    return unique_urls

def validate_transfermarkt_url(url: str) -> bool:
    """Validate that a URL is a proper Transfermarkt player profile URL"""
    if not url or "transfermarkt" not in url.lower():
        return False
    
    # Check for player profile patterns
    player_patterns = [
        r'/profil/spieler/\d+',
        r'/spieler/[^/]+/profil/spieler/\d+',
        r'/[^/]+/profil/spieler/\d+',
    ]
    
    for pattern in player_patterns:
        if re.search(pattern, url):
            return True
    
    return False

def get_transfermarkt_playerlink_enhanced(playerid: int, scraper=None) -> str:
    """
    Enhanced function to get Transfermarkt link for a player with comprehensive fallback strategies
    """
    function_name = "process_players_enhanced"
    
    # Check for cancellation
    if get_cancel_flag(function_name):
        return ""
    
    # Use provided scraper or get from pool
    if scraper is None:
        scraper = get_enhanced_scraper()
        should_return_scraper = True
    else:
        should_return_scraper = False
    
    # Try multiple URL formats for SoFIFA
    url_formats = [
        f"https://sofifa.com/player/{playerid}",
        f"https://sofifa.com/player/{playerid}/",
        f"https://www.sofifa.com/player/{playerid}",
    ]
    
    max_retries = ENHANCED_CONFIG["max_retries"]
    base_delay = ENHANCED_CONFIG["base_delay"]
    timeout = ENHANCED_CONFIG["timeout"]
    
    try:
        for url_format in url_formats:
            # Check for cancellation before each URL attempt
            if get_cancel_flag(function_name):
                return ""
            
            logger.info(f"Trying URL format: {url_format}")
            
            for attempt in range(max_retries):
                # Check for cancellation before each attempt
                if get_cancel_flag(function_name):
                    return ""
                
                try:
                    # Add random delay between requests
                    if attempt > 0:
                        delay = min(base_delay * (2 ** attempt) + random.uniform(0, 2), ENHANCED_CONFIG["max_delay"])
                        logger.info(f"Waiting {delay:.1f}s before retry {attempt + 1}")
                        time.sleep(delay)
                    
                    # Update headers for each request
                    scraper.headers.update(get_random_headers())
                    
                    logger.info(f"Fetching player {playerid}, attempt {attempt + 1}: {url_format}")
                    resp = scraper.get(url_format, timeout=timeout)
                    
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        
                        # Use comprehensive URL extraction
                        transfermarkt_urls = extract_transfermarkt_urls_comprehensive(soup)
                        
                        # Filter and validate URLs
                        valid_urls = [url for url in transfermarkt_urls if validate_transfermarkt_url(url)]
                        
                        if valid_urls:
                            # Return the first valid URL
                            best_url = valid_urls[0]
                            logger.info(f"Found Transfermarkt URL for player {playerid}: {best_url}")
                            return best_url
                        else:
                            logger.info(f"No valid Transfermarkt URLs found for player {playerid} in {url_format}")
                    
                    elif resp.status_code == 404:
                        logger.info(f"Player {playerid} not found (404) at {url_format}")
                        break  # Try next URL format
                    
                    elif resp.status_code == 429:
                        # Rate limited - increase delay
                        delay = min(base_delay * (3 ** attempt) + random.uniform(5, 15), ENHANCED_CONFIG["max_delay"])
                        logger.warning(f"Rate limited (429) for player {playerid}, waiting {delay:.1f}s")
                        time.sleep(delay)
                        continue
                    
                    elif resp.status_code == 403:
                        # Forbidden - might be blocked
                        delay = min(base_delay * (4 ** attempt) + random.uniform(10, 20), ENHANCED_CONFIG["max_delay"])
                        logger.warning(f"Forbidden (403) for player {playerid}, waiting {delay:.1f}s")
                        time.sleep(delay)
                        continue
                    
                    else:
                        logger.warning(f"HTTP {resp.status_code} for player {playerid} at {url_format}")
                        if attempt < max_retries - 1:
                            continue
                        else:
                            break  # Try next URL format
                
                except Exception as e:
                    logger.error(f"Attempt {attempt + 1} failed for player {playerid} at {url_format}: {str(e)}")
                    if attempt < max_retries - 1:
                        delay = base_delay * (attempt + 1) + random.uniform(1, 5)
                        time.sleep(delay)
                        continue
                    else:
                        break  # Try next URL format
        
        logger.warning(f"No Transfermarkt URL found for player {playerid} after trying all strategies")
        return ""
        
    finally:
        if should_return_scraper:
            return_enhanced_scraper(scraper)

def process_players_enhanced():
    """
    Enhanced player processing with improved reliability and comprehensive URL detection
    """
    function_name = "process_players_enhanced"
    reset_cancel_flag(function_name)
    
    try:
        # Check for cancellation
        if get_cancel_flag(function_name):
            logger.info("Enhanced process cancelled before start")
            send_progress_sync({
                "type": "progress",
                "status": "cancelled",
                "message": "Enhanced process cancelled",
                "function_name": function_name
            })
            return []
        
        # File paths
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        PLAYERS_FILE = os.path.abspath(os.path.join(BASE_DIR, "../fc25/data/fifa_ng_db/players.json"))
        RESULT_FILE = os.path.abspath(os.path.join(BASE_DIR, "../db/playerlinks_from_tm_enhanced.json"))
        
        # Check if players file exists
        if not os.path.exists(PLAYERS_FILE):
            error_msg = f"Players file not found: {PLAYERS_FILE}"
            logger.error(error_msg)
            send_progress_sync({
                "type": "error",
                "message": error_msg,
                "status": "error",
                "function_name": function_name
            })
            return []
        
        # Ensure result directory exists
        os.makedirs(os.path.dirname(RESULT_FILE), exist_ok=True)
        
        # Load existing results
        all_results = []
        processed_player_ids = set()
        existing_found_count = 0
        
        if os.path.exists(RESULT_FILE):
            try:
                with open(RESULT_FILE, "r", encoding="utf-8") as f:
                    all_results = json.load(f)
                    for entry in all_results:
                        if isinstance(entry, dict) and "playerid" in entry:
                            processed_player_ids.add(str(entry["playerid"]))
                            if entry.get("transfermarkt_url") and entry["transfermarkt_url"] != "Not found":
                                existing_found_count += 1
                logger.info(f"Loaded {len(processed_player_ids)} processed players, {existing_found_count} with links")
            except Exception as e:
                logger.error(f"Error reading existing results: {e}")
                all_results = []
                processed_player_ids = set()
                existing_found_count = 0
        
        # Load players data
        logger.info(f"Reading players from: {PLAYERS_FILE}")
        with open(PLAYERS_FILE, "r", encoding="utf-8") as f:
            players_data = json.load(f)
        
        logger.info(f"Total players in source file: {len(players_data)}")
        
        # Filter players to process (prioritize failed ones)
        failed_players = []
        new_players = []
        
        for player in players_data:
            playerid = str(player.get("playerid", ""))
            if playerid in processed_player_ids:
                # Check if this player failed before
                for result in all_results:
                    if str(result.get("playerid", "")) == playerid and result.get("transfermarkt_url") == "Not found":
                        failed_players.append(player)
                        break
            else:
                new_players.append(player)
        
        # Process failed players first, then new players
        players_to_process = failed_players + new_players
        
        logger.info(f"Players to process: {len(players_to_process)} (Failed: {len(failed_players)}, New: {len(new_players)})")
        
        if not players_to_process:
            logger.info("No players to process")
            send_progress_sync({
                "type": "progress",
                "status": "completed",
                "message": "No players to process",
                "function_name": function_name
            })
            return all_results
        
        # Processing statistics
        start_time = datetime.now()
        completed_count = 0
        found_links_count = existing_found_count
        total_players_count = len(players_data)
        
        # Send initial progress
        send_progress_sync({
            "type": "progress",
            "current": 0,
            "total": len(players_to_process),
            "status": "starting",
            "message": f"Starting enhanced processing of {len(players_to_process)} players...",
            "function_name": function_name
        })
        
        def process_single_player_enhanced(player_data):
            """Process a single player with enhanced methods"""
            idx, player = player_data
            playerid = player.get("playerid")
            playername = player.get("playername", "Unknown Player")
            
            try:
                playerid_int = int(playerid)
                scraper = get_enhanced_scraper()
                link_data = get_transfermarkt_playerlink_enhanced(playerid_int, scraper)
                return_enhanced_scraper(scraper)
                
                return {
                    "idx": idx,
                    "playerid": str(playerid),
                    "playername": playername,
                    "transfermarkt_url": link_data if link_data else "Not found",
                    "found_link": bool(link_data),
                    "processing_method": "enhanced"
                }
            except Exception as e:
                logger.error(f"Error processing player {playerid}: {e}")
                return {
                    "idx": idx,
                    "playerid": str(playerid),
                    "playername": playername,
                    "transfermarkt_url": "Not found",
                    "found_link": False,
                    "processing_method": "enhanced",
                    "error": str(e)
                }
        
        # Multi-threaded processing with reduced workers for stability
        max_workers = min(ENHANCED_CONFIG["max_workers"], len(players_to_process))
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Create tasks
            player_data_with_idx = [(idx, player) for idx, player in enumerate(players_to_process, 1)]
            future_to_player = {executor.submit(process_single_player_enhanced, player_data): player_data for player_data in player_data_with_idx}
            
            for future in as_completed(future_to_player):
                # Check for cancellation
                if get_cancel_flag(function_name):
                    logger.info(f"Enhanced process cancelled at player {completed_count + 1}/{len(players_to_process)}")
                    # Cancel remaining tasks
                    for f in future_to_player:
                        if not f.done():
                            f.cancel()
                    send_progress_sync({
                        "type": "progress",
                        "current": completed_count,
                        "total": len(players_to_process),
                        "status": "cancelled",
                        "message": "Enhanced process cancelled by user",
                        "function_name": function_name
                    })
                    break
                
                try:
                    result = future.result()
                    completed_count += 1
                    
                    # Update statistics
                    if result["found_link"]:
                        found_links_count += 1
                    
                    # Update or add result
                    playerid = result["playerid"]
                    
                    # Remove existing entry if it exists
                    all_results = [r for r in all_results if str(r.get("playerid", "")) != playerid]
                    
                    # Add new result
                    new_entry = {
                        "playerid": result["playerid"],
                        "playername": result["playername"],
                        "transfermarkt_url": result["transfermarkt_url"],
                        "processing_method": result["processing_method"],
                        "processed_date": datetime.now().isoformat()
                    }
                    
                    if "error" in result:
                        new_entry["error"] = result["error"]
                    
                    all_results.append(new_entry)
                    
                    # Save periodically
                    if completed_count % ENHANCED_CONFIG["save_frequency"] == 0 or completed_count == len(players_to_process):
                        try:
                            with open(RESULT_FILE, "w", encoding="utf-8") as f:
                                json.dump(all_results, f, indent=2, ensure_ascii=False)
                            logger.info(f"Saved results after processing {completed_count} players")
                        except Exception as e:
                            logger.error(f"Error saving results: {e}")
                    
                    # Calculate progress statistics
                    elapsed_time = (datetime.now() - start_time).total_seconds()
                    if completed_count > 0:
                        avg_time_per_player = elapsed_time / completed_count
                        remaining_players = len(players_to_process) - completed_count
                        estimated_remaining_seconds = remaining_players * avg_time_per_player
                        estimated_time_str = f"{int(estimated_remaining_seconds // 60)}m {int(estimated_remaining_seconds % 60)}s"
                    else:
                        estimated_time_str = "Calculating..."
                    
                    current_percentage = round((completed_count / len(players_to_process)) * 100, 1)
                    found_percentage = round((found_links_count / total_players_count) * 100, 1)
                    
                    # Send progress update
                    progress_data = {
                        "type": "progress",
                        "current": completed_count,
                        "total": len(players_to_process),
                        "playerid": result["playerid"],
                        "playername": result["playername"],
                        "status": "processing",
                        "found_link": result["found_link"],
                        "percentage": current_percentage,
                        "found_links": found_links_count,
                        "total_players": total_players_count,
                        "found_percentage": found_percentage,
                        "estimated_time_remaining": estimated_time_str,
                        "processing_method": "enhanced",
                        "function_name": function_name
                    }
                    
                    send_progress_sync(progress_data)
                    logger.info(f"Enhanced progress: {completed_count}/{len(players_to_process)} ({current_percentage}%) - {result['playername']} - {'Found' if result['found_link'] else 'Not found'}")
                    
                except Exception as e:
                    logger.error(f"Error processing player result: {e}")
                    completed_count += 1
        
        # Final save
        try:
            with open(RESULT_FILE, "w", encoding="utf-8") as f:
                json.dump(all_results, f, indent=2, ensure_ascii=False)
            logger.info(f"Final save completed: {len(all_results)} total results")
        except Exception as e:
            logger.error(f"Error in final save: {e}")
        
        # Send completion message
        if not get_cancel_flag(function_name):
            total_elapsed = (datetime.now() - start_time).total_seconds()
            send_progress_sync({
                "type": "progress",
                "current": completed_count,
                "total": len(players_to_process),
                "status": "completed",
                "message": f"Enhanced processing completed! Processed: {completed_count}, Found: {found_links_count}",
                "percentage": 100,
                "found_links": found_links_count,
                "total_players": total_players_count,
                "found_percentage": found_percentage,
                "elapsed_time": f"{int(total_elapsed // 60)}m {int(total_elapsed % 60)}s",
                "processing_method": "enhanced",
                "function_name": function_name
            })
        
        logger.info(f"Enhanced player processing completed. Total results: {len(all_results)}, Found links: {found_links_count}")
        return all_results
        
    except Exception as e:
        error_msg = f"Critical error in enhanced player processing: {str(e)}"
        logger.error(error_msg)
        send_progress_sync({
            "type": "error",
            "message": error_msg,
            "status": "error",
            "function_name": function_name
        })
        return []

# Background task
def background_process_players_enhanced():
    """Background task for enhanced player processing"""
    logger.info("Starting enhanced background player processing")
    process_players_enhanced()

# Enhanced player processing endpoints
@router.post("/players/sofifa/scrape_transfermarkt_enhanced", tags=["players"])
def scrape_transfermarkt_playerlinks_enhanced(background_tasks: BackgroundTasks):
    """
    Start enhanced Transfermarkt link scraping for players with improved reliability
    """
    background_tasks.add_task(background_process_players_enhanced)
    logger.info("Enhanced player scrape task added to background tasks")
    return {
        "status": "processing", 
        "message": "Enhanced Transfermarkt link scraping started. Check playerlinks_from_tm_enhanced.json for results."
    }

@router.get("/players/sofifa/transfermarkt_links_enhanced", tags=["players"])
def get_transfermarkt_player_links_enhanced():
    """
    Get current results of enhanced player processing
    """
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    RESULT_FILE = os.path.abspath(os.path.join(BASE_DIR, "../db/playerlinks_from_tm_enhanced.json"))
    
    if os.path.exists(RESULT_FILE):
        with open(RESULT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    else:
        return []

@router.post("/players/cancel_enhanced_process", tags=["players"])
def cancel_enhanced_process():
    """
    Cancel the enhanced player processing
    """
    set_cancel_flag("process_players_enhanced", True)
    
    send_progress_sync({
        "type": "progress",
        "status": "cancelling",
        "message": "Cancelling enhanced player processing...",
        "function_name": "process_players_enhanced"
    })
    
    logger.info("Cancel requested for enhanced player processing")
    return {"status": "success", "message": "Enhanced player processing will be cancelled"}

@router.get("/players/enhanced_process_status", tags=["players"])
def get_enhanced_process_status():
    """
    Get status of enhanced player processing
    """
    with _cancel_lock:
        status = {name: {"cancelled": flag} for name, flag in _cancel_flags.items()}
    return status

def parse_transfermarkt_league_teams(league_url: str) -> List[Dict[str, Any]]:
    """
    Parse teams from a Transfermarkt league page with WebSocket progress updates
    """
    try:
        # Send initial progress
        send_progress_sync({
            "type": "progress",
            "function_name": "parse_league_teams",
            "message": "Starting to parse teams from Transfermarkt...",
            "details": "Connecting to Transfermarkt",
            "current": 0,
            "total": 0,
            "percentage": 0
        })
        
        scraper = get_scraper()
        try:
            # Send progress for fetching page
            send_progress_sync({
                "type": "progress",
                "function_name": "parse_league_teams",
                "message": "Fetching league page...",
                "details": f"Loading {league_url}",
                "current": 0,
                "total": 0,
                "percentage": 10
            })
            
            html = get_html(league_url, scraper, function_name="parse_league_teams")
            if not html:
                logger.error(f"Failed to fetch league page: {league_url}")
                send_progress_sync({
                    "status": "error",
                    "function_name": "parse_league_teams",
                    "message": "Failed to fetch league page",
                    "details": f"Could not load {league_url}"
                })
                return []
            
            # Send progress for parsing HTML
            send_progress_sync({
                "type": "progress",
                "function_name": "parse_league_teams",
                "message": "Parsing league page...",
                "details": "Analyzing HTML structure",
                "current": 0,
                "total": 0,
                "percentage": 20
            })
            
            soup = BeautifulSoup(html, "html.parser")
            
            # Find the teams table
            table = soup.select_one("#yw1 table.items")
            if not table:
                table = soup.select_one("table.items")
            
            if not table:
                logger.error(f"Teams table not found on page: {league_url}")
                send_progress_sync({
                    "status": "error",
                    "function_name": "parse_league_teams",
                    "message": "Teams table not found",
                    "details": "Could not find teams data on the page"
                })
                return []
            
            teams = []
            tbody = table.find("tbody")
            if not tbody:
                logger.error(f"Table body not found on page: {league_url}")
                send_progress_sync({
                    "status": "error",
                    "function_name": "parse_league_teams",
                    "message": "Table structure error",
                    "details": "Could not find table body"
                })
                return []
            
            rows = tbody.find_all("tr", recursive=False)
            total_rows = len(rows)
            logger.info(f"Found {total_rows} team rows")
            
            # Send progress with total count
            send_progress_sync({
                "type": "progress",
                "function_name": "parse_league_teams",
                "message": f"Found {total_rows} teams to parse",
                "details": "Starting team data extraction",
                "current": 0,
                "total": total_rows,
                "percentage": 30
            })
            
            for row_idx, tr in enumerate(rows):
                try:
                    # Send progress for each team
                    progress_percentage = 30 + (row_idx / total_rows) * 60  # 30% to 90%
                    send_progress_sync({
                        "type": "progress",
                        "function_name": "parse_league_teams",
                        "message": f"Parsing team {row_idx + 1} of {total_rows}",
                        "details": f"Extracting team data...",
                        "current": row_idx + 1,
                        "total": total_rows,
                        "percentage": progress_percentage
                    })
                    
                    cells = tr.find_all("td", recursive=False)
                    if len(cells) < 7:  # Need at least 7 columns
                        continue
                    
                    # Extract team logo (first cell)
                    logo_cell = cells[0]
                    logo_img = logo_cell.find("img", class_="tiny_wappen")
                    team_logo = ""
                    if logo_img and logo_img.get("src"):
                        # Convert tiny logo to head logo format
                        tiny_logo = logo_img["src"]
                        if "tiny" in tiny_logo:
                            team_logo = tiny_logo.replace("/tiny/", "/head/")
                        else:
                            team_logo = tiny_logo
                    
                    # Extract team name and link (second cell)
                    name_cell = cells[1]
                    team_link = name_cell.find("a")
                    team_name = ""
                    team_url = ""
                    if team_link:
                        team_name = team_link.get_text(strip=True)
                        team_url = team_link.get("href", "")
                        if team_url and not team_url.startswith("http"):
                            team_url = f"{BASE_URL}{team_url}"
                    
                    # Extract squad size (third cell with link)
                    squad_cell = cells[2]
                    squad_link = squad_cell.find("a")
                    squad_size = 0
                    if squad_link:
                        try:
                            squad_size = int(squad_link.get_text(strip=True))
                        except (ValueError, TypeError):
                            squad_size = 0
                    
                    # Extract average age (fourth cell)
                    avg_age_text = cells[3].get_text(strip=True)
                    avg_age = 0.0
                    try:
                        avg_age = float(avg_age_text)
                    except (ValueError, TypeError):
                        avg_age = 0.0
                    
                    # Extract foreigners count (fifth cell)
                    foreigners_text = cells[4].get_text(strip=True)
                    foreigners = 0
                    try:
                        foreigners = int(foreigners_text)
                    except (ValueError, TypeError):
                        foreigners = 0
                    
                    # Extract average market value (sixth cell)
                    avg_market_value = cells[5].get_text(strip=True)
                    
                    # Extract total market value (seventh cell)
                    total_market_value_cell = cells[6]
                    total_market_value_link = total_market_value_cell.find("a")
                    total_market_value = ""
                    if total_market_value_link:
                        total_market_value = total_market_value_link.get_text(strip=True)
                    else:
                        total_market_value = total_market_value_cell.get_text(strip=True)
                    
                    # Extract team ID from URL
                    team_id = ""
                    if team_url:
                        match = re.search(r'/verein/(\d+)', team_url)
                        if match:
                            team_id = match.group(1)
                    
                    team_data = {
                        "teamname": team_name,
                        "teamlogo": team_logo,
                        "team_url": team_url,
                        "team_id": team_id,
                        "squad": squad_size,
                        "avg_age": avg_age,
                        "foreigners": foreigners,
                        "avg_market_value": avg_market_value,
                        "total_market_value": total_market_value
                    }
                    
                    if team_name:  # Only add if we have a team name
                        teams.append(team_data)
                        logger.debug(f"Parsed team: {team_name} (ID: {team_id})")
                        
                        # Send progress with team name
                        send_progress_sync({
                            "type": "progress",
                            "function_name": "parse_league_teams",
                            "message": f"Parsed {team_name}",
                            "details": f"Team {row_idx + 1} of {total_rows} completed",
                            "current": row_idx + 1,
                            "total": total_rows,
                            "percentage": progress_percentage
                        })
                
                except Exception as e:
                    logger.warning(f"Error parsing team row {row_idx}: {e}")
                    continue
            
            # Send completion progress
            send_progress_sync({
                "type": "progress",
                "function_name": "parse_league_teams",
                "message": f"Successfully parsed {len(teams)} teams!",
                "details": "Team parsing completed",
                "current": len(teams),
                "total": total_rows,
                "percentage": 100
            })
            
            # Send completion status
            send_progress_sync({
                "status": "completed",
                "function_name": "parse_league_teams",
                "message": f"Found {len(teams)} teams from Transfermarkt",
                "teams_count": len(teams)
            })
            
            logger.info(f"Successfully parsed {len(teams)} teams from league page")
            return teams
            
        finally:
            return_scraper(scraper)
            
    except Exception as e:
        logger.error(f"Error parsing league teams from {league_url}: {e}")
        send_progress_sync({
            "status": "error",
            "function_name": "parse_league_teams",
            "message": "Failed to parse teams",
            "details": f"Error: {str(e)}"
        })
        return []

@router.post("/transfermarkt/parse_league_teams", tags=["transfermarkt"])
def parse_league_teams(request: LeagueTeamsRequest):
    """
    Parse teams from a Transfermarkt league page
    
    Args:
        request: Request body containing league_url
    
    Returns:
        List of teams with their data
    """
    try:
        league_url = request.league_url
        
        if not league_url:
            return JSONResponse(
                status_code=400,
                content={"error": "League URL is required"}
            )
        
        if "transfermarkt.com" not in league_url:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid Transfermarkt URL"}
            )
        
        logger.info(f"Parsing teams from league: {league_url}")
        teams = parse_transfermarkt_league_teams(league_url)
        
        if not teams:
            return JSONResponse(
                status_code=404,
                content={"error": "No teams found or failed to parse league page"}
            )
        
        return {
            "status": "success",
            "league_url": league_url,
            "teams_count": len(teams),
            "teams": teams
        }
        
    except Exception as e:
        logger.error(f"Error in parse_league_teams endpoint: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Internal server error: {str(e)}"}
        )

def download_and_process_team_crest(url: str, project_name: str, team_id: str, team_name_for_log: str = "Unknown") -> bool:
    """
    Скачивает логотип команды по URL, обрабатывает его и сохраняет.
    
    Args:
        url: URL изображения логотипа
        project_name: Название проекта
        team_id: ID команды
        team_name_for_log: Имя команды для логирования (опционально)
    
    Returns:
        bool: True если успешно или пропущено (например, default logo), False в случае ошибки или отсутствия URL/проекта.
    """
    if not url or not project_name:
        print(f"        ⚠️ Логотип для команды {team_name_for_log}: URL ('{url}') не найден или проект ('{project_name}') не указан.")
        logger.warning(f"Логотип для команды {team_name_for_log}: URL ('{url}') не найден или проект ('{project_name}') не указан.")
        return False # Возвращаем False, так как операция не может быть выполнена

    try:
        # Создаем путь к папке для хранения логотипов
        crest_dir = Path("projects") / project_name / "images" / "crest"
        
        # Создаем папку, если она не существует
        crest_dir.mkdir(parents=True, exist_ok=True)
        
        # Формируем имя файла: l{teamid}.png
        filename = f"l{team_id}.png"
        file_path = crest_dir / filename
        
        # Проверяем URL на "default"
        if 'default' in url.lower():
            logger.info(f"Обнаружен стандартный логотип '{url}', пропускаем скачивание.")
            # Можно опционально удалить существующий файл, если он есть
            if file_path.exists():
                try:
                    os.remove(file_path)
                    logger.info(f"Удален существующий стандартный логотип: {filename}")
                except OSError as e:
                    logger.error(f"Ошибка при удалении существующего стандартного логотипа {filename}: {e}")
            return True # Считаем успешным, так как стандартный логотип не нужен

        # Скачивание изображения
        logger.info(f"Скачивание логотипа с URL: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()  # Проверка на ошибки HTTP
        
        image_bytes = BytesIO(response.content)
        image = Image.open(image_bytes).convert("RGBA") # Конвертируем в RGBA для прозрачности
        
        # --- Обработка изображения --- 
        target_size = 256
        
        # Рассчитываем новый размер, сохраняя пропорции и вписывая в 256x256
        original_width, original_height = image.size
        ratio = min(target_size / original_width, target_size / original_height)
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)
        
        # Изменяем размер изображения
        resized_image = image.resize((new_width, new_height), Image.LANCZOS)
        
        # Создание нового прозрачного изображения 256x256
        final_image = Image.new('RGBA', (target_size, target_size), (255, 255, 255, 0))
        
        # Вычисление отступов для центрирования
        paste_x = (target_size - new_width) // 2
        paste_y = (target_size - new_height) // 2
        
        # Вставка измененного изображения на прозрачный фон
        final_image.paste(resized_image, (paste_x, paste_y), resized_image) # Используем маску для прозрачности
        
        # Сохранение изображения
        final_image.save(file_path)
        
        logger.info(f"Логотип {filename} успешно обработан и сохранен в {file_path}")
        return True
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Ошибка при скачивании логотипа {url}: {str(e)}")
        return False
    except (IOError, OSError) as e:
        logger.error(f"Ошибка при обработке или сохранении логотипа {filename}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Непредвиденная ошибка при работе с логотипом {filename}: {str(e)}")
        return False

def _make_request_with_retries(url: str, max_retries: int = 3) -> requests.Response:
    """Выполняет HTTP запрос с повторными попытками"""
    for attempt in range(max_retries):
        try:
            scraper = get_scraper()
            try:
                response = scraper.get(url, timeout=30)
                response.raise_for_status()
                return response
            finally:
                return_scraper(scraper)
        except Exception as e:
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to fetch {url} after {max_retries} attempts: {str(e)}"
                )
            time.sleep(2 ** attempt)  # Exponential backoff

def parse_manager_row(coaching_table):
    """Парсит строку менеджера из таблицы Coaching Staff"""
    if not coaching_table:
        return None
    
    try:
        rows = coaching_table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) >= 3:
                # Ищем ячейку с должностью
                position_cell = cells[1] if len(cells) > 1 else None
                if position_cell and ("manager" in position_cell.get_text().lower() or 
                                    "trainer" in position_cell.get_text().lower() or
                                    "head coach" in position_cell.get_text().lower()):
                    
                    # Извлекаем данные менеджера
                    name_cell = cells[0]
                    name_link = name_cell.find("a")
                    if name_link:
                        full_name = name_link.get_text(strip=True)
                        profile_path = name_link.get("href", "")
                        
                        # Извлекаем национальность
                        nationality_img = name_cell.find("img", class_="flaggenrahmen")
                        nationality_name = "Неизвестно"
                        if nationality_img:
                            nationality_name = nationality_img.get("title", nationality_img.get("alt", "Неизвестно"))
                        
                        return {
                            "full_name": full_name,
                            "profile_path": profile_path,
                            "nationality_name": nationality_name
                        }
    except Exception as e:
        logger.error(f"Error parsing manager row: {e}")
    
    return None

def extract_birthdate_from_profile(profile_soup):
    """Извлекает дату рождения из профиля менеджера"""
    try:
        # Ищем дату рождения в различных форматах
        birth_patterns = [
            r'(\d{1,2})\s+(\w+)\s+(\d{4})',  # "15 March 1970"
            r'(\d{1,2})\.(\d{1,2})\.(\d{4})',  # "15.03.1970"
            r'(\d{4})-(\d{1,2})-(\d{1,2})',   # "1970-03-15"
        ]
        
        # Ищем в тексте страницы
        page_text = profile_soup.get_text()
        
        for pattern in birth_patterns:
            matches = re.findall(pattern, page_text)
            if matches:
                match = matches[0]
                try:
                    if len(match) == 3:
                        if pattern == birth_patterns[0]:  # "15 March 1970"
                            day, month_name, year = match
                            month_map = {
                                'january': 1, 'february': 2, 'march': 3, 'april': 4,
                                'may': 5, 'june': 6, 'july': 7, 'august': 8,
                                'september': 9, 'october': 10, 'november': 11, 'december': 12,
                                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
                            }
                            month = month_map.get(month_name.lower(), 1)
                            return datetime(int(year), month, int(day))
                        elif pattern == birth_patterns[1]:  # "15.03.1970"
                            day, month, year = match
                            return datetime(int(year), int(month), int(day))
                        elif pattern == birth_patterns[2]:  # "1970-03-15"
                            year, month, day = match
                            return datetime(int(year), int(month), int(day))
                except ValueError:
                    continue
        
        # Если не найдено, возвращаем дату по умолчанию
        logger.warning("Birth date not found, using default date")
        return datetime(1970, 1, 1)
        
    except Exception as e:
        logger.error(f"Error extracting birth date: {e}")
        return datetime(1970, 1, 1)

async def get_manager_details(mitarbeiter_url: str) -> Dict[str, Any]:
    """
    Получает информацию о менеджере по URL страницы персонала команды Transfermarkt.

    Args:
        mitarbeiter_url: URL страницы персонала (вида .../mitarbeiter/verein/...).

    Returns:
        Словарь с распарсенными данными менеджера:
        'full_name', 'firstname', 'surname', 'tm_trainer_id', 'nationality_name',
        'nationality_id', 'birth_dt' (datetime object), 'profile_path'.

    Raises:
        HTTPException: В случае ошибок сети, таймаута или парсинга.
    """
    print(f"\n--- Запрос деталей менеджера: {mitarbeiter_url} ---")
    try:
        # 1. Получаем страницу персонала команды
        print(f"    1. Запрос страницы персонала: {mitarbeiter_url}")
        staff_response = _make_request_with_retries(str(mitarbeiter_url))
        staff_soup = BeautifulSoup(staff_response.text, 'html.parser')

        # 2. Ищем блок "Coaching Staff"
        print("    2. Поиск блока 'Coaching Staff'")
        coaching_box = staff_soup.select_one('.box:has(.content-box-headline:-soup-contains("Coaching Staff")), .box:has(.content-box-headline:-soup-contains("Trainerstab"))')
        if not coaching_box:
            print("    ❌ Блок Coaching Staff не найден.")
            raise HTTPException(status_code=404, detail="Секция 'Coaching Staff' не найдена на странице персонала.")

        # 3. Ищем таблицу внутри блока и парсим строку менеджера
        print("    3. Поиск и парсинг строки менеджера")
        coaching_table = coaching_box.select_one(".items > tbody, .responsive-table table tbody") # Пробуем два селектора
        manager_row_data = parse_manager_row(coaching_table) # Используем перенесенную функцию

        if not manager_row_data:
            print("    ❌ Менеджер не найден в таблице Coaching Staff.")
            raise HTTPException(status_code=404, detail="Менеджер не найден в таблице 'Coaching Staff'.")

        print(f"    ✅ Данные из строки менеджера: {manager_row_data}")
        profile_path = manager_row_data['profile_path']
        full_name = manager_row_data['full_name']
        nationality_name = manager_row_data['nationality_name']

        # 4. Формируем URL профиля менеджера и получаем страницу профиля
        profile_url = f"https://www.transfermarkt.com{profile_path}" if profile_path.startswith('/') else profile_path
        print(f"    4. Запрос профиля менеджера: {profile_url}")
        profile_response = _make_request_with_retries(profile_url)
        profile_soup = BeautifulSoup(profile_response.text, 'html.parser')

        # 5. Извлекаем дату рождения
        print("    5. Извлечение даты рождения")
        birth_dt = extract_birthdate_from_profile(profile_soup)
        print(f"       Финальная дата рождения: {birth_dt.strftime('%Y-%m-%d')}")

        # 6. Извлекаем ID тренера из URL профиля
        print("    6. Извлечение Transfermarkt Trainer ID")
        tm_id_match = re.search(r'/(?:profil|trainer)/(\d+)', profile_path)
        tm_trainer_id = tm_id_match.group(1) if tm_id_match else None
        print(f"       Transfermarkt Trainer ID: {tm_trainer_id}")
        if not tm_trainer_id:
             print("       ⚠️ Не удалось извлечь TM Trainer ID из пути профиля.")
             # Можно либо выбросить ошибку, либо присвоить None/0
             # raise HTTPException(status_code=500, detail="Не удалось извлечь ID тренера из URL профиля.")

        # 7. Парсинг имени и фамилии
        print("    7. Парсинг имени и фамилии")
        name_parsed = HumanName(full_name)
        firstname = name_parsed.first
        surname = name_parsed.last
        # Обработка мононимов (как в player-details)
        if not firstname and surname: 
            firstname = surname
        elif firstname and not surname: 
            surname = firstname
        print(f"       Имя: '{firstname}', Фамилия: '{surname}'")

        # 8. Получаем ID национальности из маппинга
        print(f"    8. Поиск ID для национальности '{nationality_name}'")
        nation_id = NATION_MAPPING.get(nationality_name, "0")
        if nation_id == "0" and nationality_name != "Неизвестно":
            print(f"       ⚠️ Национальность '{nationality_name}' не найдена в tm_fifa_nation_map.json. ID = 0.")
        else:
            print(f"       ID национальности: {nation_id}")

        # 9. Возвращаем результат
        manager_details = {
            "full_name": full_name,
            "firstname": firstname,
            "surname": surname,
            "tm_trainer_id": tm_trainer_id,
            "nationality_name": nationality_name,
            "nationality_id": nation_id,
            "birth_dt": birth_dt, # Возвращаем объект datetime
            "profile_path": profile_path
        }
        print(f"--- ✅ Детали для менеджера '{full_name}' (TM ID: {tm_trainer_id}) успешно извлечены ---")
        return manager_details

    except HTTPException as http_exc:
        # Перехватываем и перевыбрасываем HTTPException из _make_request_with_retries или возникшие здесь
        raise http_exc
    except Exception as e:
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА при парсинге деталей менеджера с URL {mitarbeiter_url}: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Внутренняя ошибка сервера при обработке деталей менеджера: {str(e)}"
        )

@router.post("/transfermarkt/get_manager_details", tags=["transfermarkt"])
async def get_manager_details_endpoint(mitarbeiter_url: str):
    """
    Эндпоинт для получения деталей менеджера по URL страницы персонала Transfermarkt
    """
    try:
        manager_details = await get_manager_details(mitarbeiter_url)
        return {
            "status": "success",
            "manager": manager_details
        }
    except HTTPException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"status": "error", "message": e.detail}
        )
    except Exception as e:
        logger.error(f"Error in get_manager_details_endpoint: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Internal server error: {str(e)}"}
        )

def parse_player_main_positions_from_html() -> List[PlayerPosition]:
    html_content = """
<select class="chzn-select detailed-search__select chzn-done" tabindex="-1" name="Detailsuche[hauptposition_id]" id="Detailsuche_hauptposition_id" style="display: none;">
<option value="">doesn't matter</option>
<option value="1">Goalkeeper</option>
<option value="2">Sweeper</option>
<option value="3">Centre-Back</option>
<option value="4">Left-Back</option>
<option value="5">Right-Back</option>
<option value="6">Defensive Midfield</option>
<option value="7">Central Midfield</option>
<option value="8">Right Midfield</option>
<option value="9">Left Midfield</option>
<option value="10">Attacking Midfield</option>
<option value="11">Left Winger</option>
<option value="12">Right Winger</option>
<option value="13">Second Striker</option>
<option value="14">Centre-Forward</option>
</select>
"""
    soup = BeautifulSoup(html_content, "html.parser")
    positions: List[PlayerPosition] = []
    select_element = soup.find("select", {"id": "Detailsuche_hauptposition_id"})
    if select_element and isinstance(select_element, Tag): # Type check for safety
        for option_tag in select_element.find_all("option"):
            if isinstance(option_tag, Tag): # Type check for safety
                value = option_tag.get("value")
                name = option_tag.get_text(strip=True)
                if value: # Skip "doesn't matter" or options without a value
                    positions.append(PlayerPosition(id=value, name=name))
    return positions

@router.get("/transfermarkt/player_main_positions", response_model=List[PlayerPosition], tags=["transfermarkt"])
async def get_player_main_positions_endpoint():
    try:
        positions = parse_player_main_positions_from_html()
        # No need to check for empty here, as it's valid to return an empty list if HTML was empty/malformed
        return positions
    except Exception as e:
        logger.error(f"Error fetching player main positions: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
