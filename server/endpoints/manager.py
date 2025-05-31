from fastapi import APIRouter, Query, HTTPException, Body
from .utils import load_json_file
from pathlib import Path
import json
from typing import List, Dict, Any
from datetime import datetime
import asyncio
import aiofiles
import time

router = APIRouter()

# Константы для менеджеров
DEFAULT_MANAGER_START_ID = 100000

def get_next_manager_id(existing: List[Dict[str, Any]]) -> int:
    """Получает следующий доступный ID для менеджера"""
    existing_ids = {int(m.get("managerid", 0)) for m in existing}
    next_id = max(DEFAULT_MANAGER_START_ID, max(existing_ids, default=0) + 1)
    while next_id in existing_ids:
        next_id += 1
    return next_id

def convert_dob_to_fifa_int(dob: datetime) -> str:
    """Convert datetime → FIFA integer representation."""
    epoch = datetime(1899, 12, 31)
    offset = 115_859
    return str((dob - epoch).days + offset)

@router.get("/manager", tags=["manager"])
async def get_manager(project_id: str = Query(None, description="Project ID to load manager from")):
    """Get manager data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/manager.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project manager: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/manager.json')

@router.post("/{project_name}/add-managers")
async def add_managers(
    project_name: str, 
    data: List[Dict[str, Any]] = Body(...)
) -> Dict[str, Any]:
    """
    Добавляет менеджеров в файл manager.json
    
    Args:
        project_name: Название проекта
        data: Список данных менеджеров для добавления
        
    Returns:
        Dict: Результат операции
    """
    
    # Путь к файлу manager.json
    manager_file = Path("projects") / project_name / "data" / "fifa_ng_db" / "manager.json"
    
    
    # Создаем папки если они не существуют
    manager_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Если файл не существует, создаем пустой список
    if not manager_file.exists():
        async with aiofiles.open(manager_file, 'w', encoding='utf-8') as f:
            await f.write('[]')
    
    try:
        start_time = time.time()
        
        # Асинхронно читаем данные из файла
        async with aiofiles.open(manager_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            managers = json.loads(content)
        
        read_time = time.time() - start_time
        
        # Проверяем, что мы получили валидные данные
        if not data:
            raise HTTPException(status_code=400, detail="Не указаны данные менеджеров для добавления")
        
        # Добавляем новых менеджеров
        added_count = 0
        for manager_data in data:
            # Проверяем обязательные поля
            if not manager_data.get("full_name"):
                continue
                
            # Получаем следующий доступный ID
            manager_id = get_next_manager_id(managers)
            
            # Обрабатываем дату рождения
            birth_dt = manager_data.get("birth_dt")
            if hasattr(birth_dt, 'strftime'):  # Если это datetime объект
                birthdate_fifa = convert_dob_to_fifa_int(birth_dt)
            else:
                # Если это строка или другой формат, используем дату по умолчанию
                default_date = datetime(1970, 1, 1)
                birthdate_fifa = convert_dob_to_fifa_int(default_date)
            
            # Создаем запись менеджера с правильной структурой
            new_manager = {
                "haircolorcode": "0",
                "facialhairtypecode": "243",
                "managerid": str(manager_id),
                "accessorycode4": "0",
                "hairtypecode": "160",
                "lipcolor": "0",
                "skinsurfacepack": "232001",
                "accessorycode3": "0",
                "accessorycolourcode1": "0",
                "headtypecode": "2521",
                "firstname": manager_data.get("firstname", "Manager"),
                "height": "175",
                "seasonaloutfitid": "5557",
                "birthdate": birthdate_fifa,
                "skinmakeup": "0",
                "weight": "75",
                "hashighqualityhead": "0",
                "eyedetail": "2",
                "gender": "0",
                "commonname": manager_data.get("full_name", "Manager Unknown"),
                "headassetid": str(manager_id),
                "ethnicity": "4",
                "surname": manager_data.get("surname", "Unknown"),
                "faceposerpreset": "3",
                "teamid": manager_data.get("team_id", "1"),
                "eyebrowcode": "2150301",
                "eyecolorcode": "5",
                "personalityid": "1",
                "accessorycolourcode3": "0",
                "accessorycode1": "0",
                "headclasscode": "0",
                "nationality": manager_data.get("nationality_id", "45"),
                "sideburnscode": "0",
                "skintypecode": "0",
                "accessorycolourcode4": "0",
                "headvariation": "0",
                "skintonecode": "3",
                "outfitid": "5566",
                "skincomplexion": "4",
                "accessorycode2": "0",
                "hairstylecode": "0",
                "bodytypecode": "81",
                "managerjointeamdate": birthdate_fifa,
                "accessorycolourcode2": "0",
                "facialhaircolorcode": "0"
            }
            
            managers.append(new_manager)
            added_count += 1
        
        # Если были добавлены менеджеры, сохраняем файл асинхронно
        if added_count > 0:
            write_start = time.time()
            
            # Сериализуем JSON с отступами для читаемости
            json_content = json.dumps(managers, ensure_ascii=False, indent=2)
            
            async with aiofiles.open(manager_file, 'w', encoding='utf-8') as f:
                await f.write(json_content)
            
            write_time = time.time() - write_start
            total_time = time.time() - start_time
        
        return {
            "status": "success",
            "message": f"Добавлено {added_count} менеджеров",
            "added_count": added_count,
            "total_records": len(managers),
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

# @router.get("/{project_name}")
# async def get_project_managers(project_name: str) -> List[dict]:
#     """
#     Получить список всех менеджеров проекта
#     """
#     # Путь к файлу manager.json
#     manager_file = Path("projects") / project_name / "data/fifa_ng_db/manager.json"
#     
#     if not manager_file.exists():
#         raise HTTPException(status_code=404, detail="Файл manager.json не найден")
#     
#     try:
#         with open(manager_file, 'r', encoding='utf-8') as f:
#             managers = json.load(f)
#             return managers
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Ошибка при чтении файла: {str(e)}")

@router.get("/{project_name}/manager/{manager_id}")
async def get_manager_by_id(project_name: str, manager_id: str) -> dict:
    """
    Получить конкретного менеджера по ID
    """
    # Путь к файлу manager.json
    manager_file = Path("projects") / project_name / "data/fifa_ng_db/manager.json"
    
    if not manager_file.exists():
        raise HTTPException(status_code=404, detail="Файл manager.json не найден")
    
    try:
        with open(manager_file, 'r', encoding='utf-8') as f:
            managers = json.load(f)
            
            # Ищем менеджера по ID
            manager = next((m for m in managers if m.get("managerid") == manager_id), None)
            
            if not manager:
                raise HTTPException(status_code=404, detail=f"Менеджер с ID {manager_id} не найден")
            
            return manager
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при чтении файла: {str(e)}")

# Функция для добавления менеджеров без HTTP запроса
async def add_managers_internal(project_name: str, managers_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Внутренняя функция для добавления менеджеров
    
    Args:
        project_name: Название проекта
        managers_data: Список данных менеджеров для добавления
        
    Returns:
        Dict: Результат операции
    """
    return await add_managers(project_name, managers_data)
