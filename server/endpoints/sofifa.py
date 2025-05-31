from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel # Added for PlayerPosition
from typing import List # Added for List[PlayerPosition]
import threading
import os
import json
import cloudscraper # type: ignore
from bs4 import BeautifulSoup, Tag # Added Tag for type hint
import time
import logging
import random
import re
from datetime import datetime, timedelta
from .websocket import send_progress_sync
from concurrent.futures import ThreadPoolExecutor, as_completed
import queue
from threading import Lock

router = APIRouter()
logger = logging.getLogger(__name__)

# Глобальные флаги для отмены процессов
_cancel_flags = {
    "process_teams_and_save_links_simple": False,
    "process_players_and_save_links": False
}

# Блокировка для безопасного доступа к флагам
_cancel_lock = threading.Lock()

# Пул scrapers для повторного использования
_scraper_pool = queue.Queue()
_scraper_lock = Lock()
_max_scrapers = 8  # Максимальное количество scrapers в пуле

class PlayerPosition(BaseModel):
    id: str
    name: str

def get_scraper():
    """Получить scraper из пула или создать новый"""
    try:
        return _scraper_pool.get_nowait()
    except queue.Empty:
        return cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows"},
            delay=1  # Уменьшенная задержка
        )

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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Исправляем пути к файлам
TEAMS_FILE = os.path.abspath(os.path.join(BASE_DIR, "../fc25/data/fifa_ng_db/teams.json"))
RESULT_FILE = os.path.abspath(os.path.join(BASE_DIR, "../db/teamlinks_from_tm.json"))

# Добавляем пути для игроков
PLAYERS_FILE = os.path.abspath(os.path.join(BASE_DIR, "../fc25/data/fifa_ng_db/players.json"))
PLAYERS_RESULT_FILE = os.path.abspath(os.path.join(BASE_DIR, "../db/playerlinks_from_tm.json"))

# Проверяем и создаем альтернативные пути если основные не найдены
if not os.path.exists(TEAMS_FILE):
    # Пробуем альтернативные пути
    alternative_paths = [
        os.path.join(BASE_DIR, "../../fc25/data/fifa_ng_db/teams.json"),
        os.path.join(BASE_DIR, "../data/fifa_ng_db/teams.json"),
        os.path.join(BASE_DIR, "data/fifa_ng_db/teams.json"),
        os.path.join(os.getcwd(), "fc25/data/fifa_ng_db/teams.json"),
        os.path.join(os.getcwd(), "data/fifa_ng_db/teams.json"),
    ]
    
    for alt_path in alternative_paths:
        if os.path.exists(alt_path):
            TEAMS_FILE = alt_path
            logger.info(f"Found teams file at alternative path: {TEAMS_FILE}")
            break
    else:
        logger.error(f"Teams file not found. Searched paths: {[TEAMS_FILE] + alternative_paths}")

# Проверяем пути для игроков
if not os.path.exists(PLAYERS_FILE):
    # Пробуем альтернативные пути для игроков
    alternative_player_paths = [
        os.path.join(BASE_DIR, "../../fc25/data/fifa_ng_db/players.json"),
        os.path.join(BASE_DIR, "../data/fifa_ng_db/players.json"),
        os.path.join(BASE_DIR, "data/fifa_ng_db/players.json"),
        os.path.join(os.getcwd(), "fc25/data/fifa_ng_db/players.json"),
        os.path.join(os.getcwd(), "data/fifa_ng_db/players.json"),
    ]
    
    for alt_path in alternative_player_paths:
        if os.path.exists(alt_path):
            PLAYERS_FILE = alt_path
            logger.info(f"Found players file at alternative path: {PLAYERS_FILE}")
            break
    else:
        logger.error(f"Players file not found. Searched paths: {[PLAYERS_FILE] + alternative_player_paths}")

logger.info(f"Teams file path: {TEAMS_FILE}")
logger.info(f"Result file path: {RESULT_FILE}")
logger.info(f"Players file path: {PLAYERS_FILE}")
logger.info(f"Players result file path: {PLAYERS_RESULT_FILE}")
logger.info(f"Teams file exists: {os.path.exists(TEAMS_FILE)}")
logger.info(f"Players file exists: {os.path.exists(PLAYERS_FILE)}")
logger.info(f"Current working directory: {os.getcwd()}")
logger.info(f"Base directory: {BASE_DIR}")

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

def get_transfermarkt_teamlink(teamid: int, scraper=None) -> str:
    """Оптимизированная функция получения ссылки команды"""
    url = f"https://sofifa.com/team/{teamid}"
    
    # Используем переданный scraper или получаем из пула
    if scraper is None:
        scraper = get_scraper()
        should_return_scraper = True
    else:
        should_return_scraper = False
    
    max_retries = 2  # Уменьшено количество попыток
    base_retry_delay = 5  # Уменьшена базовая задержка
    
    try:
        for attempt in range(max_retries + 1): 
            try:
                resp = scraper.get(url, timeout=10)  # Добавлен timeout
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    a_tag = soup.find("a", string="Transfermarkt")
                    if not a_tag:
                        return ""
                    href = a_tag.get("href", "")
                    if href.startswith("//"):
                        href = "https:" + href
                    elif href.startswith("/"):
                        href = "https://sofifa.com" + href
                    return href
                elif resp.status_code == 404:
                    return ""
                elif resp.status_code == 429:
                    if attempt < max_retries:
                        time.sleep(base_retry_delay * (2 ** attempt))
                        continue
                    return ""
            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"Retry {attempt + 1} for team {teamid}: {e}")
                    time.sleep(base_retry_delay)
                    continue
                else:
                    logger.error(f"Final error getting team link for {teamid}: {e}")
    finally:
        if should_return_scraper:
            return_scraper(scraper)
    
    return ""

def get_transfermarkt_playerlink(playerid: int, scraper=None) -> str:
    """
    Enhanced function to get Transfermarkt link for a player with comprehensive fallback strategies
    """
    # Try multiple URL formats for SoFIFA
    url_formats = [
        f"https://sofifa.com/player/{playerid}",
        f"https://www.sofifa.com/player/{playerid}",
        f"https://sofifa.com/player/{playerid}/",
    ]
    
    # Use provided scraper or get from pool
    if scraper is None:
        scraper = get_scraper()
        should_return_scraper = True
    else:
        should_return_scraper = False
    
    max_retries = 3  # Increased retries
    base_retry_delay = 3  # Slightly increased delay
    
    try:
        for url_format in url_formats:
            logger.info(f"Trying URL format for player {playerid}: {url_format}")
            
            for attempt in range(max_retries + 1):
                try:
                    resp = scraper.get(url_format, timeout=15)  # Increased timeout
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        
                        # Strategy 1: Direct link with "Transfermarkt" text
                        transfermarkt_urls = []
                        
                        # Look for exact text match
                        a_tag = soup.find("a", string="Transfermarkt")
                        if a_tag:
                            href = a_tag.get("href", "")
                            if href:
                                transfermarkt_urls.append(href)
                        
                        # Strategy 2: Case-insensitive text search
                        transfermarkt_links = soup.find_all("a", string=lambda text: text and "transfermarkt" in text.lower())
                        for link in transfermarkt_links:
                            href = link.get("href")
                            if href:
                                transfermarkt_urls.append(href)
                        
                        # Strategy 3: Links containing transfermarkt in href
                        transfermarkt_href_links = soup.find_all("a", href=lambda href: href and "transfermarkt" in href.lower())
                        for link in transfermarkt_href_links:
                            href = link.get("href")
                            if href:
                                transfermarkt_urls.append(href)
                        
                        # Strategy 4: Look for external links section
                        external_sections = soup.find_all("div", class_=lambda x: x and "external" in x.lower())
                        for section in external_sections:
                            for link in section.find_all("a"):
                                href = link.get("href")
                                if href and "transfermarkt" in href.lower():
                                    transfermarkt_urls.append(href)
                        
                        # Strategy 5: Look in info/profile sections
                        info_sections = soup.find_all("div", class_=lambda x: x and any(keyword in x.lower() for keyword in ["info", "profile", "details", "sidebar"]))
                        for section in info_sections:
                            for link in section.find_all("a"):
                                href = link.get("href")
                                if href and "transfermarkt" in href.lower():
                                    transfermarkt_urls.append(href)
                        
                        # Strategy 6: Look in script tags for transfermarkt URLs
                        script_tags = soup.find_all("script")
                        for script in script_tags:
                            if script.string:
                                transfermarkt_matches = re.findall(r'https?://[^"\s]*transfermarkt[^"\s]*', script.string)
                                transfermarkt_urls.extend(transfermarkt_matches)
                        
                        # Process and validate found URLs
                        for raw_url in transfermarkt_urls:
                            if not raw_url:
                                continue
                                
                            # Normalize URL
                            if raw_url.startswith("//"):
                                normalized_url = "https:" + raw_url
                            elif raw_url.startswith("/"):
                                normalized_url = "https://sofifa.com" + raw_url
                            elif raw_url.startswith("http"):
                                normalized_url = raw_url
                            else:
                                normalized_url = "https://sofifa.com/" + raw_url
                            
                            # Validate that it's a proper transfermarkt URL
                            if "transfermarkt" in normalized_url.lower():
                                # Check for player profile patterns
                                player_patterns = [
                                    r'/profil/spieler/\d+',
                                    r'/spieler/[^/]+/profil/spieler/\d+',
                                    r'/[^/]+/profil/spieler/\d+',
                                ]
                                
                                for pattern in player_patterns:
                                    if re.search(pattern, normalized_url):
                                        logger.info(f"Found valid Transfermarkt URL for player {playerid}: {normalized_url}")
                                        return normalized_url
                                
                                # If no specific pattern matches but it's a transfermarkt URL, still return it
                                if re.search(r'transfermarkt\.[a-z]+', normalized_url.lower()):
                                    logger.info(f"Found Transfermarkt URL for player {playerid}: {normalized_url}")
                                    return normalized_url
                        
                        # If we reach here, no transfermarkt URL was found on this page
                        logger.info(f"No Transfermarkt URL found for player {playerid} at {url_format}")
                        break  # Try next URL format
                        
                    elif resp.status_code == 404:
                        logger.info(f"Player {playerid} not found (404) at {url_format}")
                        break  # Try next URL format
                    elif resp.status_code == 429:
                        if attempt < max_retries:
                            wait_time = base_retry_delay * (2 ** attempt) + random.randint(2, 8)
                            logger.warning(f"Rate limited (429) for player {playerid}, waiting {wait_time}s")
                            time.sleep(wait_time)
                            continue
                        else:
                            logger.warning(f"Rate limited (429) for player {playerid}, max retries reached")
                            break  # Try next URL format
                    elif resp.status_code == 403:
                        if attempt < max_retries:
                            wait_time = base_retry_delay * (3 ** attempt) + random.randint(5, 15)
                            logger.warning(f"Forbidden (403) for player {playerid}, waiting {wait_time}s")
                            time.sleep(wait_time)
                            continue
                        else:
                            logger.warning(f"Forbidden (403) for player {playerid}, max retries reached")
                            break  # Try next URL format
                    else:
                        logger.warning(f"HTTP {resp.status_code} for player {playerid} at {url_format}")
                        if attempt < max_retries:
                            time.sleep(base_retry_delay)
                            continue
                        else:
                            break  # Try next URL format
                            
                except Exception as e:
                    if attempt < max_retries:
                        logger.warning(f"Retry {attempt + 1} for player {playerid} at {url_format}: {e}")
                        time.sleep(base_retry_delay + random.randint(1, 3))
                        continue
                    else:
                        logger.error(f"Final error getting player link for {playerid} at {url_format}: {e}")
                        break  # Try next URL format
        
        logger.warning(f"No Transfermarkt URL found for player {playerid} after trying all strategies")
        return ""
        
    finally:
        if should_return_scraper:
            return_scraper(scraper)

def process_teams_and_save_links_simple():
    function_name = "process_teams_and_save_links_simple"
    reset_cancel_flag(function_name)  # Сбрасываем флаг отмены в начале
    
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
            
        # Проверяем существование файла с командами
        if not os.path.exists(TEAMS_FILE):
            error_msg = f"Файл с командами не найден: {TEAMS_FILE}"
            logger.error(error_msg)
            send_progress_sync({
                "type": "error",
                "message": error_msg,
                "status": "error",
                "function_name": function_name
            })
            return []
        
        # Убедиться, что директория для результата существует
        os.makedirs(os.path.dirname(RESULT_FILE), exist_ok=True)
        
        # Чтение уже обработанных
        all_results = []
        processed_team_ids = set()
        existing_found_count = 0
        
        if os.path.exists(RESULT_FILE):
            with open(RESULT_FILE, "r", encoding="utf-8") as f:
                try:
                    all_results = json.load(f)
                    for entry in all_results:
                        if isinstance(entry, dict) and "teamid" in entry:
                            processed_team_ids.add(str(entry["teamid"]))
                            # Подсчитываем уже найденные ссылки
                            if entry.get("transfermarkt_url") and entry["transfermarkt_url"] != "Not found":
                                existing_found_count += 1
                    logger.info(f"Found {len(processed_team_ids)} already processed teams, {existing_found_count} with links")
                except Exception as e:
                    logger.error(f"Error reading existing results: {e}")
                    all_results = []
                    processed_team_ids = set()
                    existing_found_count = 0
        
        # Чтение исходных команд
        logger.info(f"Reading teams from: {TEAMS_FILE}")
        with open(TEAMS_FILE, "r", encoding="utf-8") as f:
            teams_data_from_source = json.load(f)
        
        logger.info(f"Total teams in source file: {len(teams_data_from_source)}")
        
        # Показываем первые несколько команд для отладки
        if teams_data_from_source:
            logger.info(f"Sample team data: {teams_data_from_source[0]}")
        
        teams_to_process = [
            t for t in teams_data_from_source
            if str(t.get("teamid")) not in processed_team_ids
        ]
        
        logger.info(f"Teams to process (after filtering already processed): {len(teams_to_process)}")
        
        if not teams_to_process:
            logger.info("No teams to process (all already processed or no teams found)")
            send_progress_sync({
                "type": "progress",
                "current": 0,
                "total": 0,
                "teamid": "",
                "teamname": "Нет команд для обработки",
                "status": "completed",
                "percentage": 100,
                "found_links": existing_found_count,
                "total_teams": len(teams_data_from_source),
                "found_percentage": round((existing_found_count / len(teams_data_from_source)) * 100, 1) if len(teams_data_from_source) > 0 else 0,
                "estimated_time_remaining": "0 сек",
                "function_name": "process_teams_and_save_links_simple"
            })
            return all_results
        
        # Статистика для расчета времени
        start_time = datetime.now()
        found_links_count = existing_found_count
        total_teams_count = len(teams_data_from_source)
        
        # Отправляем начальный прогресс
        send_progress_sync({
            "type": "progress",
            "current": 0,
            "total": len(teams_to_process),
            "teamid": "",
            "teamname": f"Начинаем обработку {len(teams_to_process)} команд...",
            "status": "starting",
            "percentage": 0,
            "found_links": found_links_count,
            "total_teams": total_teams_count,
            "found_percentage": round((found_links_count / total_teams_count) * 100, 1),
            "estimated_time_remaining": "Расчет...",
            "function_name": "process_teams_and_save_links_simple"
        })
        
        # Многопоточная обработка команд
        max_workers = min(4, len(teams_to_process))  # Ограничиваем количество потоков
        completed_count = 0
        
        def process_single_team(team_data):
            """Обработка одной команды"""
            idx, team = team_data
            teamid = team.get("teamid")
            teamname = team.get("teamname", "Unknown Team")
            
            try:
                teamid_int = int(teamid)
                scraper = get_scraper()
                link_data = get_transfermarkt_teamlink(teamid_int, scraper)
                return_scraper(scraper)
                
                return {
                    "idx": idx,
                    "teamid": str(teamid),
                    "teamname": teamname,
                    "transfermarkt_url": link_data if link_data else "Not found",
                    "found_link": bool(link_data)
                }
            except Exception as e:
                logger.error(f"Error processing team {teamid}: {e}")
                return {
                    "idx": idx,
                    "teamid": str(teamid),
                    "teamname": teamname,
                    "transfermarkt_url": "Not found",
                    "found_link": False
                }
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Создаем задачи
            team_data_with_idx = [(idx, team) for idx, team in enumerate(teams_to_process, 1)]
            future_to_team = {executor.submit(process_single_team, team_data): team_data for team_data in team_data_with_idx}
            
            for future in as_completed(future_to_team):
                # Проверяем флаг отмены - более частая проверка
                if get_cancel_flag(function_name):
                    logger.info(f"Process cancelled at team {completed_count + 1}/{len(teams_to_process)}")
                    # Отменяем все оставшиеся задачи немедленно
                    for f in future_to_team:
                        if not f.done():
                            f.cancel()
                    # Дожидаемся завершения уже запущенных задач (но с таймаутом)
                    try:
                        executor.shutdown(wait=True, timeout=5)
                    except:
                        pass
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
                    result = future.result()
                    completed_count += 1
                    
                    # Увеличиваем счетчик найденных ссылок
                    if result["found_link"]:
                        found_links_count += 1
                    
                    # Добавляем результат
                    new_entry = {
                        "teamid": result["teamid"],
                        "teamname": result["teamname"],
                        "transfermarkt_url": result["transfermarkt_url"]
                    }
                    all_results.append(new_entry)
                    
                    # Сохраняем каждые 10 результатов или если это последний
                    if completed_count % 10 == 0 or completed_count == len(teams_to_process):
                        try:
                            with open(RESULT_FILE, "w", encoding="utf-8") as f:
                                json.dump(all_results, f, indent=2, ensure_ascii=False)
                        except Exception as e:
                            logger.error(f"Error saving results: {e}")
                    
                    # Расчет оставшегося времени
                    elapsed_time = (datetime.now() - start_time).total_seconds()
                    if completed_count > 0:
                        avg_time_per_team = elapsed_time / completed_count
                        remaining_teams = len(teams_to_process) - completed_count
                        estimated_remaining_seconds = remaining_teams * avg_time_per_team
                        estimated_time_str = format_time_remaining(estimated_remaining_seconds)
                        
                        # Расчет времени завершения
                        estimated_completion = datetime.now() + timedelta(seconds=estimated_remaining_seconds)
                        estimated_completion_str = estimated_completion.strftime("%H:%M")
                    else:
                        estimated_time_str = "Расчет..."
                        estimated_completion_str = "Расчет..."
                    
                    # Расчет процентов
                    current_percentage = round((completed_count / len(teams_to_process)) * 100, 1)
                    found_percentage = round((found_links_count / total_teams_count) * 100, 1)
                    
                    # Скорость обработки (команд в минуту)
                    teams_per_minute = round((completed_count / elapsed_time) * 60, 1) if elapsed_time > 0 else 0
                    
                    # Отправка прогресса через websocket
                    progress_data = {
                        "type": "progress",
                        "current": completed_count,
                        "total": len(teams_to_process),
                        "teamid": result["teamid"],
                        "teamname": result["teamname"],
                        "status": "processing",
                        "found_link": result["found_link"],
                        "percentage": current_percentage,
                        "found_links": found_links_count,
                        "total_teams": total_teams_count,
                        "found_percentage": found_percentage,
                        "estimated_time_remaining": estimated_time_str,
                        "estimated_completion_time": estimated_completion_str,
                        "elapsed_time": format_time_remaining(elapsed_time),
                        "processing_speed": teams_per_minute,
                        "last_updated": datetime.now().isoformat(),
                        "function_name": function_name
                    }
                    
                    send_progress_sync(progress_data)
                    logger.info(f"Progress sent: {completed_count}/{len(teams_to_process)} ({current_percentage}%)")
                    
                except Exception as e:
                    logger.error(f"Error processing team result: {e}")
                    completed_count += 1

        # Заменяем старый цикл for пустым блоком, так как обработка уже выполнена выше
        pass
        

        
        # Финальная статистика
        total_elapsed = (datetime.now() - start_time).total_seconds()
        
        # Отправляем финальный прогресс только если процесс не был отменен
        if not get_cancel_flag(function_name):
            send_progress_sync({
                "type": "progress",
                "current": completed_count,
                "total": len(teams_to_process),
                "teamid": "",
                "teamname": f"Обработка завершена! Обработано команд: {completed_count}",
                "status": "completed",
                "percentage": 100,
                "found_links": found_links_count,
                "total_teams": total_teams_count,
                "found_percentage": round((found_links_count / total_teams_count) * 100, 1),
                "estimated_time_remaining": "Завершено",
                "estimated_completion_time": datetime.now().strftime("%H:%M"),
                "elapsed_time": format_time_remaining(total_elapsed),
                "total_elapsed_time": format_time_remaining(total_elapsed),
                "function_name": function_name
            })
        
        logger.info(f"Teams processing completed. Total results: {len(all_results)}, Found links: {found_links_count}")
        return all_results
        
    except Exception as e:
        error_msg = f"Critical error in process_teams_and_save_links_simple: {str(e)}"
        logger.error(error_msg)
        # Отправляем ошибку через WebSocket
        send_progress_sync({
            "type": "error",
            "message": error_msg,
            "status": "error",
            "function_name": "process_teams_and_save_links_simple"
        })
        return []

def process_players_and_save_links():
    """Обрабатывает игроков и сохраняет ссылки Transfermarkt"""
    function_name = "process_players_and_save_links"
    reset_cancel_flag(function_name)  # Сбрасываем флаг отмены в начале
    
    try:
        # Проверяем флаг отмены
        if get_cancel_flag(function_name):
            logger.info("Players process cancelled before start")
            send_progress_sync({
                "type": "progress",
                "status": "cancelled",
                "message": "Процесс обработки игроков отменен",
                "function_name": function_name
            })
            return []
            
        # Проверяем существование файла с игроками
        if not os.path.exists(PLAYERS_FILE):
            error_msg = f"Файл с игроками не найден: {PLAYERS_FILE}"
            logger.error(error_msg)
            send_progress_sync({
                "type": "error",
                "message": error_msg,
                "status": "error",
                "function_name": function_name
            })
            return []
        
        # Убедиться, что директория для результата существует
        os.makedirs(os.path.dirname(PLAYERS_RESULT_FILE), exist_ok=True)
        
        # Чтение уже обработанных игроков
        all_results = []
        processed_player_ids = set()
        existing_found_count = 0
        
        if os.path.exists(PLAYERS_RESULT_FILE):
            with open(PLAYERS_RESULT_FILE, "r", encoding="utf-8") as f:
                try:
                    all_results = json.load(f)
                    if not isinstance(all_results, list):
                        logger.warning(f"Content of {PLAYERS_RESULT_FILE} is not a list. Starting fresh.")
                        all_results = []
                    for entry in all_results:
                        if isinstance(entry, dict) and "playerid" in entry:
                            processed_player_ids.add(str(entry["playerid"]))
                            # Подсчитываем уже найденные ссылки
                            if entry.get("transfermarkt_url") and entry["transfermarkt_url"] != "Not found":
                                existing_found_count += 1
                    logger.info(f"Found {len(processed_player_ids)} already processed players, {existing_found_count} with links")
                except Exception as e:
                    logger.error(f"Error reading existing results: {e}")
                    all_results = []
                    processed_player_ids = set()
                    existing_found_count = 0
        
        # Чтение исходных игроков
        logger.info(f"Reading players from: {PLAYERS_FILE}")
        with open(PLAYERS_FILE, "r", encoding="utf-8") as f:
            players_data_from_source = json.load(f)
        
        logger.info(f"Total players in source file: {len(players_data_from_source)}")
        
        # Показываем первые несколько игроков для отладки
        if players_data_from_source:
            logger.info(f"Sample player data: {players_data_from_source[0]}")
        
        # Фильтруем только новых игроков
        players_to_process = []
        for p_info in players_data_from_source:
            pid = p_info.get("playerid")
            if pid is not None and str(pid) not in processed_player_ids:
                players_to_process.append(p_info)
            elif pid is None:
                logger.warning(f"Found entry without playerid in players.json: {p_info}")
        
        logger.info(f"Players to process (after filtering already processed): {len(players_to_process)}")
        
        if not players_to_process:
            logger.info("No players to process (all already processed or no players found)")
            send_progress_sync({
                "type": "progress",
                "current": 0,
                "total": 0,
                "playerid": "",
                "playername": "Нет игроков для обработки",
                "status": "completed",
                "percentage": 100,
                "found_links": existing_found_count,
                "total_players": len(players_data_from_source),
                "found_percentage": round((existing_found_count / len(players_data_from_source)) * 100, 1) if len(players_data_from_source) > 0 else 0,
                "estimated_time_remaining": "0 сек",
                "function_name": "process_players_and_save_links"
            })
            return all_results
        
        # Статистика для расчета времени
        start_time = datetime.now()
        found_links_count = existing_found_count
        total_players_count = len(players_data_from_source)
        
        # Отправляем начальный прогресс
        send_progress_sync({
            "type": "progress",
            "current": 0,
            "total": len(players_to_process),
            "playerid": "",
            "playername": f"Начинаем обработку {len(players_to_process)} игроков...",
            "teamname": f"Начинаем обработку {len(players_to_process)} игроков...",  # для совместимости с UI
            "status": "starting",
            "percentage": 0,
            "found_links": found_links_count,
            "total_players": total_players_count,
            "found_percentage": round((found_links_count / total_players_count) * 100, 1),
            "estimated_time_remaining": "Расчет...",
            "function_name": "process_players_and_save_links"
        })
        
        # Многопоточная обработка игроков
        max_workers = min(4, len(players_to_process))  # Ограничиваем количество потоков
        completed_count = 0
        
        def process_single_player(player_data):
            """Обработка одного игрока"""
            idx, player = player_data
            playerid = player.get("playerid")
            playername = player.get("playername", "Unknown Player")
            
            try:
                playerid_int = int(playerid)
                scraper = get_scraper()
                link_data = get_transfermarkt_playerlink(playerid_int, scraper)
                return_scraper(scraper)
                
                return {
                    "idx": idx,
                    "playerid": str(playerid),
                    "playername": playername,
                    "transfermarkt_url": link_data if link_data else "Not found",
                    "found_link": bool(link_data)
                }
            except Exception as e:
                logger.error(f"Error processing player {playerid}: {e}")
                return {
                    "idx": idx,
                    "playerid": str(playerid),
                    "playername": playername,
                    "transfermarkt_url": "Not found",
                    "found_link": False
                }
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Создаем задачи
            player_data_with_idx = [(idx, player) for idx, player in enumerate(players_to_process, 1)]
            future_to_player = {executor.submit(process_single_player, player_data): player_data for player_data in player_data_with_idx}
            
            for future in as_completed(future_to_player):
                # Проверяем флаг отмены - более частая проверка
                if get_cancel_flag(function_name):
                    logger.info(f"Players process cancelled at player {completed_count + 1}/{len(players_to_process)}")
                    # Отменяем все оставшиеся задачи немедленно
                    for f in future_to_player:
                        if not f.done():
                            f.cancel()
                    # Дожидаемся завершения уже запущенных задач (но с таймаутом)
                    try:
                        executor.shutdown(wait=True, timeout=5)
                    except:
                        pass
                    send_progress_sync({
                        "type": "progress",
                        "current": completed_count,
                        "total": len(players_to_process),
                        "status": "cancelled",
                        "message": "Процесс обработки игроков отменен пользователем",
                        "percentage": round((completed_count / len(players_to_process)) * 100, 1),
                        "function_name": function_name
                    })
                    break
                
                try:
                    result = future.result()
                    completed_count += 1
                    
                    # Увеличиваем счетчик найденных ссылок
                    if result["found_link"]:
                        found_links_count += 1
                    
                    # Добавляем результат
                    new_entry = {
                        "playerid": result["playerid"],
                        "playername": result["playername"],
                        "transfermarkt_url": result["transfermarkt_url"]
                    }
                    all_results.append(new_entry)
                    
                    # Сохраняем каждые 10 результатов или если это последний
                    if completed_count % 10 == 0 or completed_count == len(players_to_process):
                        try:
                            with open(PLAYERS_RESULT_FILE, "w", encoding="utf-8") as f:
                                json.dump(all_results, f, indent=2, ensure_ascii=False)
                        except Exception as e:
                            logger.error(f"Error saving players results: {e}")
                    
                    # Расчет оставшегося времени
                    elapsed_time = (datetime.now() - start_time).total_seconds()
                    if completed_count > 0:
                        avg_time_per_player = elapsed_time / completed_count
                        remaining_players = len(players_to_process) - completed_count
                        estimated_remaining_seconds = remaining_players * avg_time_per_player
                        estimated_time_str = format_time_remaining(estimated_remaining_seconds)
                        
                        # Расчет времени завершения
                        estimated_completion = datetime.now() + timedelta(seconds=estimated_remaining_seconds)
                        estimated_completion_str = estimated_completion.strftime("%H:%M")
                    else:
                        estimated_time_str = "Расчет..."
                        estimated_completion_str = "Расчет..."
                    
                    # Расчет процентов
                    current_percentage = round((completed_count / len(players_to_process)) * 100, 1)
                    found_percentage = round((found_links_count / total_players_count) * 100, 1)
                    
                    # Скорость обработки (игроков в минуту)
                    players_per_minute = round((completed_count / elapsed_time) * 60, 1) if elapsed_time > 0 else 0
                    
                    # Отправка прогресса через websocket
                    progress_data = {
                        "type": "progress",
                        "current": completed_count,
                        "total": len(players_to_process),
                        "playerid": result["playerid"],
                        "playername": result["playername"],
                        "teamname": result["playername"],  # для совместимости с UI
                        "status": "processing",
                        "found_link": result["found_link"],
                        "percentage": current_percentage,
                        "found_links": found_links_count,
                        "total_players": total_players_count,
                        "found_percentage": found_percentage,
                        "estimated_time_remaining": estimated_time_str,
                        "estimated_completion_time": estimated_completion_str,
                        "elapsed_time": format_time_remaining(elapsed_time),
                        "processing_speed": players_per_minute,
                        "last_updated": datetime.now().isoformat(),
                        "function_name": function_name
                    }
                    
                    send_progress_sync(progress_data)
                    logger.info(f"Progress sent: {completed_count}/{len(players_to_process)} ({current_percentage}%)")
                    
                except Exception as e:
                    logger.error(f"Error processing player result: {e}")
                    completed_count += 1
        
        # Финальная статистика
        total_elapsed = (datetime.now() - start_time).total_seconds()
        
        # Отправляем финальный прогресс только если процесс не был отменен
        if not get_cancel_flag(function_name):
            send_progress_sync({
                "type": "progress",
                "current": completed_count,
                "total": len(players_to_process),
                "playerid": "",
                "playername": f"Обработка завершена! Обработано игроков: {completed_count}",
                "teamname": f"Обработка завершена! Обработано игроков: {completed_count}",  # для совместимости
                "status": "completed",
                "percentage": 100,
                "found_links": found_links_count,
                "total_players": total_players_count,
                "found_percentage": round((found_links_count / total_players_count) * 100, 1),
                "estimated_time_remaining": "Завершено",
                "estimated_completion_time": datetime.now().strftime("%H:%M"),
                "elapsed_time": format_time_remaining(total_elapsed),
                "total_elapsed_time": format_time_remaining(total_elapsed),
                "function_name": function_name
            })
        
        logger.info(f"Players processing completed. Total results: {len(all_results)}, Found links: {found_links_count}")
        return all_results
        
    except Exception as e:
        error_msg = f"Critical error in process_players_and_save_links: {str(e)}"
        logger.error(error_msg)
        # Отправляем ошибку через WebSocket
        send_progress_sync({
            "type": "error",
            "message": error_msg,
            "status": "error",
            "function_name": "process_players_and_save_links"
        })
        return []

# Фоновая задача для команд
def background_scrape_links():
    logger.info("Starting background scrape task")
    process_teams_and_save_links_simple()

# Фоновая задача для игроков
def background_scrape_player_links():
    logger.info("Starting background player scrape task")
    process_players_and_save_links()

@router.post("/teams/sofifa/scrape_transfermarkt", tags=["teams"])
def scrape_transfermarkt_teamlinks(background_tasks: BackgroundTasks):
    """
    Запускает процесс сбора ссылок Transfermarkt для команд в фоне.
    """
    background_tasks.add_task(background_scrape_links)
    logger.info("Scrape task added to background tasks")
    return {"status": "processing", "message": "Загрузка начата в фоне. Проверьте файл teamlinks_from_tm.json позже."}

@router.post("/players/sofifa/scrape_transfermarkt", tags=["players"])
def scrape_transfermarkt_playerlinks(background_tasks: BackgroundTasks):
    """
    Запускает процесс сбора ссылок Transfermarkt для игроков в фоне.
    """
    background_tasks.add_task(background_scrape_player_links)
    logger.info("Player scrape task added to background tasks")
    return {"status": "processing", "message": "Загрузка ссылок игроков начата в фоне. Проверьте файл playerlinks_from_tm.json позже."}

@router.get("/teams/sofifa/transfermarkt_links", tags=["teams"])
def get_transfermarkt_links():
    """
    Получить текущий результат (можно вызывать, чтобы узнать прогресс).
    """
    if os.path.exists(RESULT_FILE):
        with open(RESULT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    else:
        return []

@router.get("/players/sofifa/transfermarkt_links", tags=["players"])
def get_transfermarkt_player_links():
    """
    Получить текущий результат обработки игроков.
    """
    if os.path.exists(PLAYERS_RESULT_FILE):
        with open(PLAYERS_RESULT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    else:
        return []

@router.post("/cancel_process", tags=["progress"])
def cancel_process(function_name: str):
    """
    Отменить выполняющийся процесс по имени функции.
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
    
    logger.info(f"Cancel requested for process: {function_name}")
    return {"status": "success", "message": f"Процесс {function_name} будет отменен"}

@router.get("/process_status", tags=["progress"])
def get_process_status():
    """
    Получить статус всех процессов (активные/отмененные).
    """
    with _cancel_lock:
        status = {name: {"cancelled": flag} for name, flag in _cancel_flags.items()}
    return status

def parse_sofifa_player_positions_from_html() -> List[PlayerPosition]:
    html_content = """<div class="choices-list" aria-multiselectable="true" role="listbox"><div id="choices--pn1-g1-item-choice-1" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="1" data-value="27" data-select-text="" data-choice-selectable="">LW</div><div id="choices--pn1-g1-item-choice-2" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="2" data-value="25" data-select-text="" data-choice-selectable="">ST</div><div id="choices--pn1-g1-item-choice-3" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="3" data-value="23" data-select-text="" data-choice-selectable="">RW</div><div id="choices--pn1-g1-item-choice-4" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="4" data-value="22" data-select-text="" data-choice-selectable="">LF</div><div id="choices--pn1-g1-item-choice-5" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="5" data-value="21" data-select-text="" data-choice-selectable="">CF</div><div id="choices--pn1-g1-item-choice-6" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="6" data-value="20" data-select-text="" data-choice-selectable="">RF</div><div id="choices--pn1-g1-item-choice-7" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="7" data-value="18" data-select-text="" data-choice-selectable="">CAM</div><div id="choices--pn1-g1-item-choice-8" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="8" data-value="16" data-select-text="" data-choice-selectable="">LM</div><div id="choices--pn1-g1-item-choice-9" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="9" data-value="14" data-select-text="" data-choice-selectable="">CM</div><div id="choices--pn1-g1-item-choice-10" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="10" data-value="12" data-select-text="" data-choice-selectable="" aria-selected="false">RM</div><div id="choices--pn1-g1-item-choice-11" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="11" data-value="10" data-select-text="" data-choice-selectable="" aria-selected="false">CDM</div><div id="choices--pn1-g1-item-choice-12" class="choices-item choices-item-choice choices-item-selectable is-highlighted" role="option" data-choice="" data-id="12" data-value="8" data-select-text="" data-choice-selectable="" aria-selected="true">LWB</div><div id="choices--pn1-g1-item-choice-13" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="13" data-value="7" data-select-text="" data-choice-selectable="">LB</div><div id="choices--pn1-g1-item-choice-14" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="14" data-value="5" data-select-text="" data-choice-selectable="">CB</div><div id="choices--pn1-g1-item-choice-15" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="15" data-value="3" data-select-text="" data-choice-selectable="">RB</div><div id="choices--pn1-g1-item-choice-16" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="16" data-value="2" data-select-text="" data-choice-selectable="" aria-selected="false">RWB</div><div id="choices--pn1-g1-item-choice-17" class="choices-item choices-item-choice choices-item-selectable" role="option" data-choice="" data-id="17" data-value="0" data-select-text="" data-choice-selectable="">GK</div></div>"""
    soup = BeautifulSoup(html_content, "html.parser")
    positions: List[PlayerPosition] = []
    choice_items = soup.find_all("div", class_="choices-item")
    for item in choice_items:
        if isinstance(item, Tag):
            value = item.get("data-value")
            name = item.get_text(strip=True)
            if value and name:
                positions.append(PlayerPosition(id=value, name=name))
    return positions

@router.get("/sofifa/player_positions", response_model=List[PlayerPosition], tags=["sofifa_players"])
async def get_sofifa_player_positions_endpoint():
    try:
        positions = parse_sofifa_player_positions_from_html()
        return positions
    except Exception as e:
        logger.error(f"Error fetching SoFIFA player positions: {e}")
        # Consider using specific HTTPException for clarity if needed
        raise JSONResponse(status_code=500, content={"message": f"Internal server error: {str(e)}"})