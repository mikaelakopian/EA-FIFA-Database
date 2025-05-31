from fastapi import APIRouter, Query, HTTPException, Body
from .utils import load_json_file
from pathlib import Path
import json
from typing import List, Dict, Any
import asyncio
import aiofiles
import time

router = APIRouter()

@router.get("/teamstadiumlinks", tags=["teamstadiumlinks"])
async def get_teamstadiumlinks(project_id: str = Query(None, description="Project ID to load teamstadiumlinks from")):
    """Get teamstadiumlinks data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/teamstadiumlinks.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project teamstadiumlinks: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/teamstadiumlinks.json')

@router.post("/{project_name}/add-team-stadiums")
async def add_team_stadiums(
    project_name: str, 
    data: List[Dict[str, Any]] = Body(...)
) -> Dict[str, Any]:
    """
    Добавляет связи команд со стадионами в файл teamstadiumlinks.json
    
    Args:
        project_name: Название проекта
        data: Список команд для добавления стадионов
        
    Returns:
        Dict: Результат операции
    """
    
    # Путь к файлу teamstadiumlinks.json
    links_file = Path("projects") / project_name / "data" / "fifa_ng_db" / "teamstadiumlinks.json"
    
    
    # Создаем папки если они не существуют
    links_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Если файл не существует, создаем пустой список
    if not links_file.exists():
        async with aiofiles.open(links_file, 'w', encoding='utf-8') as f:
            await f.write('[]')
    
    try:
        start_time = time.time()
        
        # Асинхронно читаем данные из файла
        async with aiofiles.open(links_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            links = json.loads(content)
        
        read_time = time.time() - start_time
        
        # Проверяем, что мы получили валидные данные
        team_ids = []
        for item in data:
            if "teamid" in item:
                # Преобразуем teamid в int, если это строка
                team_id = item.get("teamid")
                if isinstance(team_id, str):
                    team_ids.append(int(team_id))
                else:
                    team_ids.append(team_id)
                    
        if not team_ids:
            raise HTTPException(status_code=400, detail="Не указаны ID команд для добавления стадионов")
        
        
        # Значения по умолчанию для стадиона
        default_stadium_id = 34  # _Town Park
        default_stadium_name = "_Town Park"
        
        # Создаем набор существующих связей для быстрой проверки
        existing_team_ids = set()
        for link in links:
            team_id = link.get("teamid")
            if team_id is not None:
                existing_team_ids.add(int(team_id))
        
        
        # Добавляем новые связи
        added_count = 0
        for team_data in data:
            team_id = team_data.get("teamid")
            # Преобразуем teamid в int, если это строка
            if isinstance(team_id, str):
                team_id = int(team_id)
                
            if team_id is None:
                continue
                
            # Проверяем, существует ли уже связь для этой команды
            if team_id in existing_team_ids:
                continue
            
            # Создаем новую связь
            new_link = {
                "swapcrowdplacement": 0,
                "stadiumid": default_stadium_id,
                "stadiumname": default_stadium_name,
                "teamid": team_id,  # teamid как int
                "forcedhome": 0
            }
            
            links.append(new_link)
            existing_team_ids.add(team_id)  # Добавляем в набор для предотвращения дублирования
            added_count += 1
        
        # Если были добавлены связи, сохраняем файл асинхронно
        if added_count > 0:
            write_start = time.time()
            
            # Сериализуем JSON с отступами для читаемости
            json_content = json.dumps(links, ensure_ascii=False, indent=2)
            
            async with aiofiles.open(links_file, 'w', encoding='utf-8') as f:
                await f.write(json_content)
            
            write_time = time.time() - write_start
            total_time = time.time() - start_time
        
        return {
            "status": "success",
            "message": f"Добавлено {added_count} связей команд со стадионами",
            "added_count": added_count,
            "total_records": len(links),
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
# async def get_project_teamstadiumlinks(project_name: str) -> List[dict]:
#     """
#     Получить список всех связей команд со стадионами
#     """
#     # Путь к файлу teamstadiumlinks.json
#     links_file = Path("projects") / project_name / "data/fifa_ng_db/teamstadiumlinks.json"
#     
#     if not links_file.exists():
#         raise HTTPException(status_code=404, detail="Файл teamstadiumlinks.json не найден")
#     
#     try:
#         with open(links_file, 'r', encoding='utf-8') as f:
#             links = json.load(f)
#             return links
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Ошибка при чтении файла: {str(e)}")

@router.get("/{project_name}/team/{team_id}")
async def get_team_stadium_link(project_name: str, team_id: int) -> dict:
    """
    Получить связь команды со стадионом
    """
    # Путь к файлу teamstadiumlinks.json
    links_file = Path("projects") / project_name / "data/fifa_ng_db/teamstadiumlinks.json"
    
    if not links_file.exists():
        raise HTTPException(status_code=404, detail="Файл teamstadiumlinks.json не найден")
    
    try:
        with open(links_file, 'r', encoding='utf-8') as f:
            links = json.load(f)
            
            # Ищем связь для команды
            link = next((l for l in links if l.get("teamid") == team_id), None)
            
            if not link:
                raise HTTPException(status_code=404, detail=f"Связь для команды {team_id} не найдена")
            
            return link
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при чтении файла: {str(e)}")

# Функция для добавления стадионов команды без HTTP запроса
async def add_team_stadiums_internal(project_name: str, team_ids: List[str]) -> Dict[str, Any]:
    """
    Внутренняя функция для добавления связей команд со стадионами
    
    Args:
        project_name: Название проекта
        team_ids: Список ID команд для добавления стадионов
        
    Returns:
        Dict: Результат операции
    """
    data = [{"teamid": team_id} for team_id in team_ids]
    return await add_team_stadiums(project_name, data)
