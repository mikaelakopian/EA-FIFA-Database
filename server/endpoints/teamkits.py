from fastapi import APIRouter, Query, HTTPException, Body
from pathlib import Path
import json
from typing import List, Dict, Any, Optional
from collections import OrderedDict
import numpy as np
import os
from PIL import Image
import asyncio
import aiofiles
import time

router = APIRouter()

# Определяем правильный порядок ключей
TEAMKIT_FIELDS_ORDER = [
    "jerseybacknamefontcase", "chestbadge", "teamkittypetechid", "shortsnumberplacementcode", "powid",
    "shortsnumbercolorprimg", "isinheritbasedetailmap", "teamcolorsecb", "shortsrenderingdetailmaptype",
    "jerseyfrontnumberplacementcode", "jerseynumbercolorsecr", "jerseynumbercolorprimr", "jerseynumbercolorprimg",
    "islocked", "shortsnumbercolorsecb", "teamcolorprimg", "shortsnumbercolorterb", "shortsnumbercolorprimr",
    "numberfonttype", "teamcolortertb", "jerseynumbercolorterg", "jerseynameoutlinecolorr", "shortsnumbercolorprimb",
    "jerseynamefonttype", "jerseynamelayouttype", "teamkitid", "teamcolorprimpercent", "jerseynumbercolorterr",
    "jerseyrightsleevebadge", "jerseynumbercolorprimb", "jerseyshapestyle", "jerseybacknameplacementcode",
    "teamcolorprimr", "jerseynamecolorg", "teamcolorsecpercent", "jerseyleftsleevebadge", "jerseynameoutlinecolorb",
    "teamcolorsecg", "shortsnumbercolorsecg", "year", "teamcolortertr", "jerseynumbercolorsecg",
    "renderingmaterialtype", "captainarmband", "teamtechid", "isembargoed", "hasadvertisingkit",
    "jerseynameoutlinewidth", "dlc", "shortsnumbercolorterr", "teamcolorsecr", "teamcolortertpercent",
    "jerseycollargeometrytype", "shortsnumbercolorterg", "jerseynamecolorr", "teamcolorprimb", "armbandtype",
    "jerseyrenderingdetailmaptype", "shortsnumberfonttype", "shortstyle", "jerseynameoutlinecolorg",
    "jerseynumbercolorsecb", "jerseynamecolorb", "jerseyfit", "jerseynumbercolorterb", "jerseyrestriction",
    "teamcolortertg", "shortsnumbercolorsecr"
]

# Функция для создания OrderedDict с правильным порядком ключей
def create_ordered_kit(kit_data: Dict[str, Any]) -> OrderedDict:
    """
    Создает OrderedDict с правильным порядком ключей для формы команды
    """
    ordered_kit = OrderedDict()
    for key in TEAMKIT_FIELDS_ORDER:
        ordered_kit[key] = kit_data.get(key, "0")  # По умолчанию "0" если ключ отсутствует
    return ordered_kit

# Пользовательский JSONEncoder для сохранения порядка ключей в OrderedDict
class OrderedDictJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, OrderedDict):
            return obj
        return super().default(obj)

async def write_json_file(file_path: Path, data: List[OrderedDict]):
    """Асинхронная запись JSON файла с сохранением порядка ключей"""
    # Сериализуем JSON с минимальными отступами для экономии места и времени
    json_content = json.dumps(data, ensure_ascii=False, separators=(',', ':'), cls=OrderedDictJSONEncoder)
    
    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
        await f.write(json_content)

def extract_dominant_colors(image_path: str, num_colors: int = 3) -> np.ndarray:
    """Извлекает доминирующие цвета из изображения логотипа"""
    try:
        from sklearn.cluster import KMeans
        
        # Открываем изображение
        image = Image.open(image_path).convert('RGB')
        
        # Преобразуем в numpy array
        image_array = np.array(image)
        
        # Изменяем форму для кластеризации
        pixels = image_array.reshape(-1, 3)
        
        # Удаляем белые и очень светлые пиксели (фон)
        non_white_pixels = pixels[np.sum(pixels, axis=1) < 700]  # Сумма RGB < 700
        
        if len(non_white_pixels) < 10:
            # Если слишком мало пикселей, используем все
            non_white_pixels = pixels
        
        # Применяем K-means кластеризацию
        kmeans = KMeans(n_clusters=min(num_colors, len(non_white_pixels)), random_state=42, n_init=10)
        kmeans.fit(non_white_pixels)
        
        # Получаем центры кластеров (доминирующие цвета)
        colors = kmeans.cluster_centers_.astype(int)
        
        return colors
        
    except Exception as e:
        print(f"Error extracting colors from {image_path}: {e}")
        # Возвращаем цвета по умолчанию
        return np.array([[255, 0, 0], [255, 255, 255], [0, 0, 0]])

def sort_colors_by_importance(colors: np.ndarray) -> List[List[int]]:
    """Сортирует цвета по важности (яркость, насыщенность)"""
    sorted_colors = []
    
    for color in colors:
        r, g, b = color
        # Вычисляем яркость и насыщенность
        brightness = (r + g + b) / 3
        saturation = max(r, g, b) - min(r, g, b)
        
        # Приоритет: высокая насыщенность и средняя яркость
        importance = saturation * (1 - abs(brightness - 128) / 128)
        
        sorted_colors.append((importance, [int(r), int(g), int(b)]))
    
    # Сортируем по важности (убывание)
    sorted_colors.sort(key=lambda x: x[0], reverse=True)
    
    return [color[1] for color in sorted_colors]

def get_contrasting_text_color(background_color: List[int]) -> np.ndarray:
    """Возвращает контрастный цвет текста для фона"""
    r, g, b = background_color
    # Вычисляем яркость фона
    brightness = (r * 0.299 + g * 0.587 + b * 0.114)
    
    # Если фон темный, возвращаем белый, иначе черный
    if brightness < 128:
        return np.array([255, 255, 255])  # Белый
    else:
        return np.array([0, 0, 0])  # Черный

# @router.get("/teamkits", tags=["teamkits"])
# async def get_teamkits(project_id: str = None):
#     """Get teamkits data from project folder or default file"""
#     
#     if project_id:
#         try:
#             from .utils import load_json_file
#             return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/teamkits.json')
#         except HTTPException as e:
#             if e.status_code != 404:
#                 print(f"[ERROR] Error loading project teamkits: {e.detail}")
#     
#     # Используем правильный путь к файлу по умолчанию (относительно endpoints папки)
#     try:
#         from .utils import load_json_file
#         return load_json_file('../fc25/data/fifa_ng_db/teamkits.json')
#     except HTTPException as e:
#         print(f"[ERROR] Error loading default teamkits: {e.detail}")
#         # Возвращаем пустой список если файл не найден
#         return []

# @router.get("/{project_name}")
# async def get_team_kits(project_name: str) -> List[dict]:
#     """
#     Получить список всех форм команд
#     """
#     # Путь к файлу teamkits.json
#     kits_file = Path("projects") / project_name / "data/fifa_ng_db/teamkits.json"
#     
#     if not kits_file.exists():
#         raise HTTPException(status_code=404, detail="Файл teamkits.json не найден")
#     
#     try:
#         with open(kits_file, 'r', encoding='utf-8') as f:
#             kits = json.load(f)
#             return kits
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Ошибка при чтении файла: {str(e)}")

@router.get("/{project_name}/team/{team_tech_id}")
async def get_team_kits_by_team(project_name: str, team_tech_id: str) -> List[dict]:
    """
    Получить формы конкретной команды
    """
    # Путь к файлу teamkits.json
    kits_file = Path("projects") / project_name / "data/fifa_ng_db/teamkits.json"
    
    if not kits_file.exists():
        raise HTTPException(status_code=404, detail="Файл teamkits.json не найден")
    
    try:
        # Преобразуем team_tech_id в строку для правильного сравнения
        team_tech_id_str = str(team_tech_id)
        
        with open(kits_file, 'r', encoding='utf-8') as f:
            kits = json.load(f)
            # Фильтруем формы для конкретной команды
            team_kits = [kit for kit in kits if kit.get("teamtechid") == team_tech_id_str]
            
            return team_kits
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при чтении файла: {str(e)}")

@router.post("/{project_name}/add-team-kits")
async def add_team_kits(
    project_name: str, 
    data: List[Dict[str, Any]] = Body(...)
) -> Dict[str, Any]:
    """
    Добавляет комплекты форм для команд в файл teamkits.json
    
    Args:
        project_name: Название проекта
        data: Список команд для добавления форм (teamid)
        
    Returns:
        Dict: Результат операции
    """
    
    # Путь к файлу teamkits.json
    kits_file = Path("projects") / project_name / "data" / "fifa_ng_db" / "teamkits.json"
    
    
    # Создаем папки если они не существуют
    kits_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Если файл не существует, создаем пустой список
    if not kits_file.exists():
        async with aiofiles.open(kits_file, 'w', encoding='utf-8') as f:
            await f.write('[]')
    
    try:
        start_time = time.time()
        
        # Асинхронно читаем данные из файла
        async with aiofiles.open(kits_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            kits = json.loads(content)
        
        read_time = time.time() - start_time
        
        # Проверяем, что мы получили валидные данные
        team_ids = []
        for item in data:
            if "teamid" in item:
                team_id = item.get("teamid")
                team_ids.append(str(team_id))
                
        if not team_ids:
            raise HTTPException(status_code=400, detail="Не указаны ID команд для добавления форм")
        
        
        # Определяем последний использованный teamkitid
        max_kit_id = 0
        for kit in kits:
            try:
                current_id = int(kit.get("teamkitid", "0"))
                max_kit_id = max(max_kit_id, current_id)
            except (ValueError, TypeError):
                continue
                
        
        # Шаблоны для домашней, выездной и альтернативной формы
        kit_templates = [
            # Домашняя форма (teamkittypetechid=0)
            {
                "jerseybacknamefontcase": "0", 
                "chestbadge": "351", 
                "teamkittypetechid": "0", 
                "shortsnumberplacementcode": "1", 
                "powid": "-1", 
                "shortsnumbercolorprimg": "220", 
                "isinheritbasedetailmap": "0", 
                "teamcolorsecb": "178", 
                "shortsrenderingdetailmaptype": "0", 
                "jerseyfrontnumberplacementcode": "0", 
                "jerseynumbercolorsecr": "12", 
                "jerseynumbercolorprimr": "220", 
                "jerseynumbercolorprimg": "220", 
                "islocked": "0", 
                "shortsnumbercolorsecb": "220", 
                "teamcolorprimg": "34", 
                "shortsnumbercolorterb": "12", 
                "shortsnumbercolorprimr": "220", 
                "numberfonttype": "27", 
                "teamcolortertb": "30", 
                "jerseynumbercolorterg": "12", 
                "jerseynameoutlinecolorr": "12", 
                "shortsnumbercolorprimb": "220", 
                "jerseynamefonttype": "29", 
                "jerseynamelayouttype": "0", 
                # teamkitid будет увеличен для каждой формы
                "teamcolorprimpercent": "71", 
                "jerseynumbercolorterr": "12", 
                "jerseyrightsleevebadge": "0", 
                "jerseynumbercolorprimb": "220", 
                "jerseyshapestyle": "0", 
                "jerseybacknameplacementcode": "1", 
                "teamcolorprimr": "29", 
                "jerseynamecolorg": "220", 
                "teamcolorsecpercent": "27", 
                "jerseyleftsleevebadge": "0", 
                "jerseynameoutlinecolorb": "12", 
                "teamcolorsecg": "57", 
                "shortsnumbercolorsecg": "220", 
                "year": "0", 
                "teamcolortertr": "30", 
                "jerseynumbercolorsecg": "12", 
                "renderingmaterialtype": "0", 
                "captainarmband": "0", 
                # teamtechid будет указан из данных команды
                "isembargoed": "0", 
                "hasadvertisingkit": "0", 
                "jerseynameoutlinewidth": "2", 
                "dlc": "0", 
                "shortsnumbercolorterr": "12", 
                "teamcolorsecr": "0", 
                "teamcolortertpercent": "100", 
                "jerseycollargeometrytype": "7", 
                "shortsnumbercolorterg": "12", 
                "jerseynamecolorr": "220", 
                "teamcolorprimb": "44", 
                "armbandtype": "0", 
                "jerseyrenderingdetailmaptype": "0", 
                "shortsnumberfonttype": "27", 
                "shortstyle": "0", 
                "jerseynameoutlinecolorg": "12", 
                "jerseynumbercolorsecb": "12", 
                "jerseynamecolorb": "220", 
                "jerseyfit": "0", 
                "jerseynumbercolorterb": "12", 
                "jerseyrestriction": "0", 
                "teamcolortertg": "30", 
                "shortsnumbercolorsecr": "220"
            },
            
            # Выездная форма (teamkittypetechid=1)
            {
                "jerseybacknamefontcase": "0", 
                "chestbadge": "351", 
                "teamkittypetechid": "1", 
                "shortsnumberplacementcode": "1", 
                "powid": "-1", 
                "shortsnumbercolorprimg": "12", 
                "isinheritbasedetailmap": "0", 
                "teamcolorsecb": "30", 
                "shortsrenderingdetailmaptype": "0", 
                "jerseyfrontnumberplacementcode": "0", 
                "jerseynumbercolorsecr": "220", 
                "jerseynumbercolorprimr": "12", 
                "jerseynumbercolorprimg": "12", 
                "islocked": "0", 
                "shortsnumbercolorsecb": "12", 
                "teamcolorprimg": "30", 
                "shortsnumbercolorterb": "220", 
                "shortsnumbercolorprimr": "12", 
                "numberfonttype": "27", 
                "teamcolortertb": "30", 
                "jerseynumbercolorterg": "220", 
                "jerseynameoutlinecolorr": "220", 
                "shortsnumbercolorprimb": "12", 
                "jerseynamefonttype": "29", 
                "jerseynamelayouttype": "0", 
                # teamkitid будет увеличен для каждой формы
                "teamcolorprimpercent": "98", 
                "jerseynumbercolorterr": "220", 
                "jerseyrightsleevebadge": "0", 
                "jerseynumbercolorprimb": "12", 
                "jerseyshapestyle": "0", 
                "jerseybacknameplacementcode": "1", 
                "teamcolorprimr": "29", 
                "jerseynamecolorg": "12", 
                "teamcolorsecpercent": "98", 
                "jerseyleftsleevebadge": "0", 
                "jerseynameoutlinecolorb": "220", 
                "teamcolorsecg": "30", 
                "shortsnumbercolorsecg": "12", 
                "year": "0", 
                "teamcolortertr": "30", 
                "jerseynumbercolorsecg": "220", 
                "renderingmaterialtype": "0", 
                "captainarmband": "0", 
                # teamtechid будет указан из данных команды
                "isembargoed": "0", 
                "hasadvertisingkit": "0", 
                "jerseynameoutlinewidth": "0", 
                "dlc": "0", 
                "shortsnumbercolorterr": "220", 
                "teamcolorsecr": "29", 
                "teamcolortertpercent": "100", 
                "jerseycollargeometrytype": "0", 
                "shortsnumbercolorterg": "220", 
                "jerseynamecolorr": "12", 
                "teamcolorprimb": "30", 
                "armbandtype": "0", 
                "jerseyrenderingdetailmaptype": "0", 
                "shortsnumberfonttype": "27", 
                "shortstyle": "0", 
                "jerseynameoutlinecolorg": "220", 
                "jerseynumbercolorsecb": "220", 
                "jerseynamecolorb": "12", 
                "jerseyfit": "0", 
                "jerseynumbercolorterb": "220", 
                "jerseyrestriction": "0", 
                "teamcolortertg": "30", 
                "shortsnumbercolorsecr": "12"
            },
            
            # Альтернативная форма (teamkittypetechid=2)
            {
                "jerseybacknamefontcase": "0", 
                "chestbadge": "351", 
                "teamkittypetechid": "2", 
                "shortsnumberplacementcode": "1", 
                "powid": "-1", 
                "shortsnumbercolorprimg": "12", 
                "isinheritbasedetailmap": "0", 
                "teamcolorsecb": "93", 
                "shortsrenderingdetailmaptype": "0", 
                "jerseyfrontnumberplacementcode": "0", 
                "jerseynumbercolorsecr": "220", 
                "jerseynumbercolorprimr": "12", 
                "jerseynumbercolorprimg": "12", 
                "islocked": "0", 
                "shortsnumbercolorsecb": "12", 
                "teamcolorprimg": "90", 
                "shortsnumbercolorterb": "220", 
                "shortsnumbercolorprimr": "12", 
                "numberfonttype": "27", 
                "teamcolortertb": "98", 
                "jerseynumbercolorterg": "220", 
                "jerseynameoutlinecolorr": "220", 
                "shortsnumbercolorprimb": "12", 
                "jerseynamefonttype": "29", 
                "jerseynamelayouttype": "0", 
                # teamkitid будет увеличен для каждой формы
                "teamcolorprimpercent": "96", 
                "jerseynumbercolorterr": "220", 
                "jerseyrightsleevebadge": "0", 
                "jerseynumbercolorprimb": "12", 
                "jerseyshapestyle": "0", 
                "jerseybacknameplacementcode": "1", 
                "teamcolorprimr": "233", 
                "jerseynamecolorg": "12", 
                "teamcolorsecpercent": "96", 
                "jerseyleftsleevebadge": "0", 
                "jerseynameoutlinecolorb": "220", 
                "teamcolorsecg": "90", 
                "shortsnumbercolorsecg": "12", 
                "year": "0", 
                "teamcolortertr": "241", 
                "jerseynumbercolorsecg": "220", 
                "renderingmaterialtype": "0", 
                "captainarmband": "0", 
                # teamtechid будет указан из данных команды
                "isembargoed": "0", 
                "hasadvertisingkit": "0", 
                "jerseynameoutlinewidth": "2", 
                "dlc": "0", 
                "shortsnumbercolorterr": "220", 
                "teamcolorsecr": "233", 
                "teamcolortertpercent": "100", 
                "jerseycollargeometrytype": "7", 
                "shortsnumbercolorterg": "220", 
                "jerseynamecolorr": "12", 
                "teamcolorprimb": "93", 
                "armbandtype": "1", 
                "jerseyrenderingdetailmaptype": "0", 
                "shortsnumberfonttype": "27", 
                "shortstyle": "0", 
                "jerseynameoutlinecolorg": "220", 
                "jerseynumbercolorsecb": "220", 
                "jerseynamecolorb": "12", 
                "jerseyfit": "0", 
                "jerseynumbercolorterb": "220", 
                "jerseyrestriction": "0", 
                "teamcolortertg": "93", 
                "shortsnumbercolorsecr": "12"
            }
        ]
        
        # Создаем новый список форм, с правильным порядком ключей
        ordered_kits = []
        for kit in kits:
            ordered_kits.append(create_ordered_kit(kit))
        
        # Добавляем формы для каждой команды
        added_kits_count = 0
        teams_processed = 0
        
        for team_id in team_ids:
            # Проверяем, есть ли уже формы для этой команды
            existing_kits = [kit for kit in ordered_kits if kit.get("teamtechid") == team_id]
            
            # Если у команды уже есть 3 или более формы, пропускаем
            if len(existing_kits) >= 3:
                continue
                
            # Добавляем формы для команды
            for template in kit_templates:
                max_kit_id += 1
                
                # Копируем данные из шаблона с указанием teamkitid и teamtechid
                template_copy = template.copy()
                template_copy["teamkitid"] = str(max_kit_id)
                template_copy["teamtechid"] = team_id
                
                # Создаем OrderedDict с правильным порядком ключей
                ordered_kit = create_ordered_kit(template_copy)
                
                ordered_kits.append(ordered_kit)
                added_kits_count += 1
            
            teams_processed += 1
        
        # Сохраняем обновленные данные, если были добавлены формы
        if added_kits_count > 0:
            write_start = time.time()
            
            # Сериализуем JSON с отступами для читаемости
            json_content = json.dumps(ordered_kits, ensure_ascii=False, indent=2, cls=OrderedDictJSONEncoder)
            
            async with aiofiles.open(kits_file, 'w', encoding='utf-8') as f:
                await f.write(json_content)
            
            write_time = time.time() - write_start
            total_time = time.time() - start_time
        
        return {
            "status": "success",
            "message": f"Добавлено {added_kits_count} комплекта(ов) формы для {teams_processed} команд(ы)",
            "added_kits_count": added_kits_count,
            "teams_processed": teams_processed,
            "total_records": len(ordered_kits),
            "processing_time": f"{time.time() - start_time:.2f}s"
        }
                
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON decode error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка чтения JSON файла: {str(e)}")
    except PermissionError as e:
        print(f"[ERROR] Permission error: {e}")
        raise HTTPException(status_code=500, detail=f"Нет прав доступа к файлу: {str(e)}")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при обновлении файла: {str(e)}")

# Функция для добавления форм команды без HTTP запроса
async def add_team_kits_internal(project_name: str, team_ids: List[str]) -> Dict[str, Any]:
    """
    Внутренняя функция для добавления комплектов форм команд
    
    Args:
        project_name: Название проекта
        team_ids: Список ID команд для добавления форм
        
    Returns:
        Dict: Результат операции
    """
    data = [{"teamid": team_id} for team_id in team_ids]
    return await add_team_kits(project_name, data)

def directly_fix_team_colors(project_name: str, team_id: str, team_name: str = None) -> bool:
    """Fix team colors by directly updating JSON files"""
    print(f"Starting direct color fix for team {team_id} in project {project_name}")
    
    # Base directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    
    # JSON file paths
    teams_file = os.path.join(base_dir, 'projects', project_name, 'data', 'fifa_ng_db', 'teams.json')
    teamkits_file = os.path.join(base_dir, 'projects', project_name, 'data', 'fifa_ng_db', 'teamkits.json')
    
    # Check if files exist
    if not os.path.exists(teams_file):
        print(f"Error: teams.json not found at {teams_file}")
        return False
    
    if not os.path.exists(teamkits_file):
        print(f"Error: teamkits.json not found at {teamkits_file}")
        return False
    
    # Load JSON data
    try:
        with open(teams_file, 'r', encoding='utf-8') as f:
            teams_data = json.load(f)
        
        with open(teamkits_file, 'r', encoding='utf-8') as f:
            teamkits_data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON data: {e}")
        return False
    
    # Find team in teams.json
    team = None
    for t in teams_data:
        if str(t.get('teamid')) == str(team_id):
            team = t
            break
    
    # Create team entry if it doesn't exist
    if team is None:
        print(f"Team {team_id} not found in teams.json. Creating...")
        if not teams_data:
            print("Error: No teams found to use as template")
            return False
        
        team = teams_data[0].copy()
        team['teamid'] = str(team_id)
        team['assetid'] = str(team_id)
        
        if team_name:
            team['teamname'] = team_name
        else:
            team['teamname'] = f"Team {team_id}"
        
        teams_data.append(team)
    elif team_name:
        # Update name if provided
        team['teamname'] = team_name
    
    # Find team's kits in teamkits.json
    existing_kits = []
    for tk in teamkits_data:
        # Check if this kit belongs to our team
        if str(tk.get('teamtechid')) == str(team_id):
            # Remove 'teamid' field if it exists
            if 'teamid' in tk:
                del tk['teamid']
            existing_kits.append(tk)
    
    # Sort kits by teamkittypetechid
    existing_kits.sort(key=lambda x: int(x.get('teamkittypetechid', '0')))
    
    # Find team logo and extract colors
    team_name = team.get('teamname', f"Team {team_id}")
    
    # Check logo paths
    possible_paths = [
        os.path.join(base_dir, 'projects', project_name, 'data', 'images', 'crest', f"l{team_id}.png"),
        os.path.join(base_dir, 'projects', project_name, 'data', 'images', 'crest', f"{team_id}.png"),
        os.path.join(base_dir, 'fc25', 'images', 'teams', f"l{team_id}.png"),
        os.path.join(base_dir, 'fc25', 'images', 'teams', f"{team_id}.png")
    ]
    
    logo_path = None
    for path in possible_paths:
        if os.path.exists(path):
            logo_path = path
            print(f"Found logo at: {logo_path}")
            break
    
    if not logo_path:
        print(f"Logo not found for {team_name} (ID: {team_id})")
        # Assign default colors
        default_colors = [
            [255, 0, 0],  # Red
            [255, 255, 255],  # White
            [0, 0, 0]  # Black
        ]
        colors = np.array(default_colors)
        print("Using default colors")
    else:
        print(f"Extracting colors from logo: {logo_path}")
        colors = extract_dominant_colors(logo_path)
        
        if len(colors) == 0:
            print(f"Failed to extract colors from logo for {team_name}")
            # Use default colors
            default_colors = [
                [255, 0, 0],  # Red
                [255, 255, 255],  # White
                [0, 0, 0]  # Black
            ]
            colors = np.array(default_colors)
            print("Using default colors")
    
    # Sort colors by importance
    sorted_colors = sort_colors_by_importance(colors)
    
    # Make sure we have at least 3 colors
    while len(sorted_colors) < 3:
        # Add black as fallback
        sorted_colors.append([0, 0, 0])
    
    # Update team colors in teams.json
    for i, color_base in enumerate(['teamcolor1', 'teamcolor2', 'teamcolor3']):
        if i < len(sorted_colors):
            r, g, b = sorted_colors[i]
            team[f"{color_base}r"] = str(r)
            team[f"{color_base}g"] = str(g)
            team[f"{color_base}b"] = str(b)
    
    # Find template kits to use if we need to create new ones
    template_kits = []
    for kit_type in range(3):  # We need 3 types: 0, 1, 2
        # Try to find a matching kit type
        found = False
        for tk in teamkits_data:
            if tk.get('teamkittypetechid') == str(kit_type) and tk != team:
                template_kits.append(tk.copy())
                found = True
                break
        
        if not found and teamkits_data:
            # If no matching kit type, use any kit as template
            template_kits.append(teamkits_data[0].copy())
    
    # Ensure we have exactly 3 kit entries (0, 1, 2)
    final_kits = []
    for kit_type in range(3):
        # Try to find existing kit of this type
        existing_kit = None
        for kit in existing_kits:
            if kit.get('teamkittypetechid') == str(kit_type):
                existing_kit = kit
                break
        
        if existing_kit:
            # Use existing kit
            final_kit = existing_kit
        elif kit_type < len(template_kits):
            # Create new kit from template
            final_kit = template_kits[kit_type].copy()
            final_kit['teamkittypetechid'] = str(kit_type)
        else:
            # Should not happen, but create minimal kit record
            final_kit = {
                'teamkittypetechid': str(kit_type),
                'teamtechid': str(team_id)
            }
        
        # Ensure teamtechid is set correctly
        final_kit['teamtechid'] = str(team_id)
        
        # Remove teamid if it exists
        if 'teamid' in final_kit:
            del final_kit['teamid']
        
        final_kits.append(final_kit)
    
    # Setup color scheme based on kit type
    # Primary kit (kit_type 0)
    primary_color = sorted_colors[0]
    secondary_color = sorted_colors[1] if len(sorted_colors) > 1 else get_contrasting_text_color(primary_color)
    tertiary_color = sorted_colors[2] if len(sorted_colors) > 2 else np.array([255, 255, 0])  # Default to yellow
    text_color = get_contrasting_text_color(primary_color)
    
    # Update colors for primary kit (kit_type 0)
    final_kits[0]['teamcolorprimr'] = str(primary_color[0])
    final_kits[0]['teamcolorprimg'] = str(primary_color[1])
    final_kits[0]['teamcolorprimb'] = str(primary_color[2])
    final_kits[0]['teamcolorprimpercent'] = "75"
    
    final_kits[0]['teamcolorsecr'] = str(secondary_color[0])
    final_kits[0]['teamcolorsecg'] = str(secondary_color[1])
    final_kits[0]['teamcolorsecb'] = str(secondary_color[2])
    final_kits[0]['teamcolorsecpercent'] = "15"
    
    final_kits[0]['teamcolortertr'] = str(tertiary_color[0])
    final_kits[0]['teamcolortertg'] = str(tertiary_color[1])
    final_kits[0]['teamcolortertb'] = str(tertiary_color[2])
    final_kits[0]['teamcolortertpercent'] = "10"
    
    # Away kit (kit_type 1) - reverse primary and secondary colors
    final_kits[1]['teamcolorprimr'] = str(secondary_color[0])
    final_kits[1]['teamcolorprimg'] = str(secondary_color[1])
    final_kits[1]['teamcolorprimb'] = str(secondary_color[2])
    final_kits[1]['teamcolorprimpercent'] = "75"
    
    final_kits[1]['teamcolorsecr'] = str(primary_color[0])
    final_kits[1]['teamcolorsecg'] = str(primary_color[1])
    final_kits[1]['teamcolorsecb'] = str(primary_color[2])
    final_kits[1]['teamcolorsecpercent'] = "15"
    
    final_kits[1]['teamcolortertr'] = str(tertiary_color[0])
    final_kits[1]['teamcolortertg'] = str(tertiary_color[1])
    final_kits[1]['teamcolortertb'] = str(tertiary_color[2])
    final_kits[1]['teamcolortertpercent'] = "10"
    
    # Third kit (kit_type 2) - use tertiary as primary, with accents
    final_kits[2]['teamcolorprimr'] = str(tertiary_color[0])
    final_kits[2]['teamcolorprimg'] = str(tertiary_color[1])
    final_kits[2]['teamcolorprimb'] = str(tertiary_color[2])
    final_kits[2]['teamcolorprimpercent'] = "75"
    
    final_kits[2]['teamcolorsecr'] = str(primary_color[0])
    final_kits[2]['teamcolorsecg'] = str(primary_color[1])
    final_kits[2]['teamcolorsecb'] = str(primary_color[2])
    final_kits[2]['teamcolorsecpercent'] = "15"
    
    final_kits[2]['teamcolortertr'] = str(secondary_color[0])
    final_kits[2]['teamcolortertg'] = str(secondary_color[1])
    final_kits[2]['teamcolortertb'] = str(secondary_color[2])
    final_kits[2]['teamcolortertpercent'] = "10"
    
    # Update teamkits_data
    # First remove existing kits for this team
    teamkits_data = [tk for tk in teamkits_data if str(tk.get('teamtechid')) != str(team_id)]
    # Then add our updated kits
    teamkits_data.extend(final_kits)
    
    # Save the updated files
    try:
        print(f"Saving updated team data to: {teams_file}")
        with open(teams_file, 'w', encoding='utf-8') as f:
            json.dump(teams_data, f, indent=2, ensure_ascii=False)
        
        print(f"Saving updated teamkit data with {len(final_kits)} kits to: {teamkits_file}")
        with open(teamkits_file, 'w', encoding='utf-8') as f:
            json.dump(teamkits_data, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully updated colors for {team_name} (ID: {team_id})")
        return True
    except Exception as e:
        print(f"Error saving JSON data: {e}")
        return False
