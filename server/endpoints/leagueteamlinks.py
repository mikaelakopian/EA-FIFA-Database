from fastapi import APIRouter, Query, HTTPException, Body
from .utils import load_json_file, save_json_file
from pydantic import BaseModel
from typing import List, Dict
from pathlib import Path
import json
import time
import asyncio
import aiofiles

# Define workspace root relative to this file's location
# Assuming leagueteamlinks.py is in /<workspace_root>/server/endpoints/
# WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
# Corrected WORKSPACE_ROOT to point to the 'server' directory, as 'projects', 'db', 'fc25' are subdirs of 'server'
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent

router = APIRouter()

class TeamTransfer(BaseModel):
    teamid: str
    from_leagueid: str
    to_leagueid: str

@router.get("/leagueteamlinks", tags=["leagueteamlinks"])
async def get_leagueteamlinks(project_id: str = Query(None, description="Project ID to load leagueteamlinks from")):
    """Get leagueteamlinks data from project folder or default file"""
    
    if project_id:
        try:
            project_links_path = WORKSPACE_ROOT / "projects" / project_id / "data" / "fifa_ng_db" / "leagueteamlinks.json"
            return load_json_file(str(project_links_path))
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project leagueteamlinks: {e.detail}")
    
    default_links_path = WORKSPACE_ROOT / "fc25" / "data" / "fifa_ng_db" / "leagueteamlinks.json"
    return load_json_file(str(default_links_path))

@router.get("/leagueteamlinks/transferable-teams", tags=["leagueteamlinks"])
async def get_transferable_teams(
    country_id: str = Query(..., description="Country ID to find teams for"),
    project_id: str = Query(None, description="Project ID")
):
    """Find teams from rest_of_world_teams.json that can be transferred to a new first division league"""
    
    try:
        # Load rest of world teams
        rest_of_world_path = WORKSPACE_ROOT / "db" / "rest_of_world_teams.json"
        rest_of_world_teams = load_json_file(str(rest_of_world_path))
        
        # Filter teams by country - return all teams from this country
        country_teams = [team for team in rest_of_world_teams if team['countryid'] == country_id]
        
        if not country_teams:
            return []
        
        # Load current leagueteamlinks to get current league assignments
        if project_id:
            try:
                links_path = WORKSPACE_ROOT / "projects" / project_id / "data" / "fifa_ng_db" / "leagueteamlinks.json"
                leagueteamlinks = load_json_file(str(links_path))
            except HTTPException:
                default_links_path = WORKSPACE_ROOT / "fc25" / "data" / "fifa_ng_db" / "leagueteamlinks.json"
                leagueteamlinks = load_json_file(str(default_links_path))
        else:
            default_links_path = WORKSPACE_ROOT / "fc25" / "data" / "fifa_ng_db" / "leagueteamlinks.json"
            leagueteamlinks = load_json_file(str(default_links_path))
        
        # Load leagues to get league names
        if project_id:
            try:
                leagues_file_path = WORKSPACE_ROOT / "projects" / project_id / "data" / "fifa_ng_db" / "leagues.json"
                leagues = load_json_file(str(leagues_file_path))
            except HTTPException:
                default_leagues_path = WORKSPACE_ROOT / "fc25" / "data" / "fifa_ng_db" / "leagues.json"
                leagues = load_json_file(str(default_leagues_path))
        else:
            default_leagues_path = WORKSPACE_ROOT / "fc25" / "data" / "fifa_ng_db" / "leagues.json"
            leagues = load_json_file(str(default_leagues_path))
        
        # Create a map of league info
        league_info = {}
        for league in leagues:
            league_info[str(league['leagueid'])] = {
                'leaguename': league.get('leaguename', f"League {league['leagueid']}"),
                'countryid': league.get('countryid', ''),
                'level': league.get('level', '')
            }
        
        # Create a map of team assignments
        team_assignments = {}
        for link in leagueteamlinks:
            team_assignments[str(link['teamid'])] = {
                'current_leagueid': str(link['leagueid']),
                'current_prevleagueid': str(link['prevleagueid'])
            }
        
        # Add current league info to teams
        transferable_teams = []
        for team in country_teams:
            team_assignment = team_assignments.get(str(team['teamid']))
            
            if team_assignment:
                current_league_id = team_assignment.get('current_leagueid', 'Not Assigned')
                current_league_name = 'Not Assigned to League'
                
                if current_league_id != 'Not Assigned' and current_league_id in league_info:
                    current_league_name = league_info[current_league_id]['leaguename']
                elif current_league_id != 'Not Assigned':
                    current_league_name = f"League {current_league_id} (Name not found)"
            else:
                current_league_id = 'Not in any league'
                current_league_name = 'Not assigned to any league'
            
            team_info = {
                **team,
                'teamid': str(team['teamid']),
                'current_leagueid': current_league_id,
                'current_leaguename': current_league_name,
                'current_prevleagueid': team_assignment.get('current_prevleagueid', 'Not Assigned') if team_assignment else 'Not Assigned'
            }
            transferable_teams.append(team_info)
        
        return transferable_teams
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finding transferable teams: {str(e)}")

@router.post("/leagueteamlinks/transfer-teams", tags=["leagueteamlinks"])
async def transfer_teams(
    project_id: str = Query(..., description="Project ID"),
    transfers: List[TeamTransfer] = Body(...)
):
    """Transfer teams from one league to another by updating leagueid and prevleagueid"""
    
    try:
        
        if not transfers:
            raise HTTPException(status_code=400, detail="No transfers provided")
        
        # Load current leagueteamlinks
        file_path_obj = WORKSPACE_ROOT / "projects" / project_id / "data" / "fifa_ng_db" / "leagueteamlinks.json"
        if not file_path_obj.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_path_obj}")
        leagueteamlinks = load_json_file(str(file_path_obj))
        
        transferred_count = 0
        
        # Update team league assignments
        for transfer in transfers:
            for link in leagueteamlinks:
                if str(link['teamid']) == str(transfer.teamid) and str(link['leagueid']) == str(transfer.from_leagueid):
                    link['leagueid'] = transfer.to_leagueid
                    link['prevleagueid'] = transfer.to_leagueid
                    transferred_count += 1
                    break
        
        # Save updated file
        save_json_file(str(file_path_obj), leagueteamlinks)
        
        return {
            "message": f"Successfully transferred {transferred_count} teams", 
            "transfers": transfers,
            "transferred_count": transferred_count
        }
        
    except Exception as e:
        print(f"[ERROR] Error transferring teams: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error transferring teams: {str(e)}")

@router.post("/{project_name}/connect")
async def connect_team_league(
    project_name: str,
    data: Dict = Body(...)
) -> Dict:
    """
    Добавляет команду в лигу, записывая её в файл leagueteamlinks.json
    
    Принимает:
    - league_id: ID лиги
    - team_ids: Список ID команд для добавления
    """
    league_id = data.get("league_id")
    team_ids = data.get("team_ids", [])
    
    
    if not league_id:
        raise HTTPException(status_code=400, detail="ID лиги обязателен")
    
    if not team_ids or not isinstance(team_ids, list):
        raise HTTPException(status_code=400, detail="Список ID команд обязателен")
    
    if not project_name:
        raise HTTPException(status_code=400, detail="Имя проекта (project_name) отсутствует или пустое.")
    
    # Путь к файлу leagueteamlinks.json
    links_file = WORKSPACE_ROOT / "projects" / project_name / "data" / "fifa_ng_db" / "leagueteamlinks.json"
    
    
    if not links_file.exists():
        raise HTTPException(status_code=404, detail="Файл leagueteamlinks.json не найден")
    
    try:
        start_time = time.time()
        
        # Асинхронно читаем данные из файла
        async with aiofiles.open(links_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            links = json.loads(content)
        
        read_time = time.time() - start_time
        
        # Находим максимальный artificialkey и создаем индекс существующих соединений
        max_key = 0
        existing_connections = set()
        
        # Обрабатываем записи пакетами для лучшей производительности
        batch_size = 1000
        for i in range(0, len(links), batch_size):
            batch = links[i:i + batch_size]
            for link in batch:
                try:
                    current_key = int(link.get("artificialkey", "0"))
                    max_key = max(max_key, current_key)
                    
                    # Создаем набор существующих соединений для быстрой проверки
                    team_id = link.get("teamid")
                    league_id_link = link.get("leagueid")
                    if team_id and league_id_link:
                        existing_connections.add(f"{team_id}_{league_id_link}")
                except (ValueError, TypeError):
                    continue
            
            # Даем возможность другим задачам выполниться
            if i % (batch_size * 10) == 0:
                await asyncio.sleep(0.001)
        
        
        # Счетчик добавленных команд
        added_count = 0
        new_links = []
        
        # Добавляем новые записи для каждой команды
        for team_id in team_ids:
            connection_key = f"{team_id}_{league_id}"
            
            # Быстрая проверка существования связи
            if connection_key not in existing_connections:
                # Увеличиваем artificialkey для новой записи
                max_key += 1
                
                # Создаем новую запись
                new_link = {
                    "teamshortform": "0",
                    "hasachievedobjective": "0",
                    "yettowin": "0",
                    "unbeatenallcomps": "0",
                    "unbeatenleague": "0",
                    "champion": "0",
                    "leagueid": league_id,
                    "homega": "0",
                    "prevleagueid": league_id,
                    "previousyeartableposition": "1",
                    "highestpossible": "0",
                    "teamform": "0",
                    "homegf": "0",
                    "highestprobable": "0",
                    "homewins": "0",
                    "artificialkey": str(max_key),
                    "nummatchesplayed": "0",
                    "teamid": team_id,
                    "grouping": "0",
                    "currenttableposition": "1",
                    "awaywins": "0",
                    "objective": "0",
                    "points": "0",
                    "actualvsexpectations": "0",
                    "homelosses": "0",
                    "unbeatenhome": "0",
                    "lastgameresult": "0",
                    "unbeatenaway": "0",
                    "awaylosses": "0",
                    "awaygf": "0",
                    "awaydraws": "0",
                    "awayga": "0",
                    "homedraws": "0",
                    "teamlongform": "0"
                }
                
                # Добавляем запись в список новых записей
                new_links.append(new_link)
                added_count += 1
        
        # Если были добавлены команды, сохраняем файл
        if added_count > 0:
            
            # Добавляем новые записи к существующим
            links.extend(new_links)
            
            # Асинхронно сохраняем файл
            write_start = time.time()
            
            # Сериализуем JSON с минимальными отступами для экономии места и времени
            json_content = json.dumps(links, ensure_ascii=False, separators=(',', ':'))
            
            async with aiofiles.open(links_file, 'w', encoding='utf-8') as f:
                await f.write(json_content)
            
            write_time = time.time() - write_start
        
        total_time = time.time() - start_time
        
        return {
            "status": "success",
            "message": f"Добавлено {added_count} команд в лигу {league_id}",
            "added_count": added_count,
            "total_records": len(links),
            "processing_time": f"{total_time:.2f}s"
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

async def connect_team_to_league_direct(project_name: str, league_id: str, team_id: str) -> dict:
    """Прямое подключение команды к лиге без HTTP запроса"""
    try:
        
        if not project_name:
            return {"status": "error", "message": "Имя проекта (project_name) отсутствует для прямого подключения."}
        
        # Путь к файлу leagueteamlinks.json
        links_file = WORKSPACE_ROOT / "projects" / project_name / "data" / "fifa_ng_db" / "leagueteamlinks.json"
        

        if not links_file.exists():
            return {"status": "error", "message": "Файл leagueteamlinks.json не найден"}
        
        start_time = time.time()
        
        # Читаем данные из файла
        # Note: This is synchronous file I/O. Consider making it async if performance is critical for this direct call.
        with open(links_file, 'r', encoding='utf-8') as f:
            links = json.load(f)
        
        
        # Быстрая проверка существования связи
        connection_key = f"{team_id}_{league_id}"
        existing_connections = set()
        max_key = 0
        
        for link in links:
            try:
                current_key = int(link.get("artificialkey", "0"))
                max_key = max(max_key, current_key)
                
                team_id_link = link.get("teamid")
                league_id_link = link.get("leagueid")
                if team_id_link and league_id_link:
                    existing_connections.add(f"{team_id_link}_{league_id_link}")
            except (ValueError, TypeError):
                continue
        
        # Проверяем, не существует ли уже связь
        if connection_key in existing_connections:
            return {
                "status": "success", 
                "message": f"Команда {team_id} уже подключена к лиге {league_id}",
                "added_count": 0
            }
        
        # Создаем новую запись
        max_key += 1
        new_link = {
            "teamshortform": "0",
            "hasachievedobjective": "0",
            "yettowin": "0",
            "unbeatenallcomps": "0",
            "unbeatenleague": "0",
            "champion": "0",
            "leagueid": league_id,
            "homega": "0",
            "prevleagueid": league_id,
            "previousyeartableposition": "1",
            "highestpossible": "0",
            "teamform": "0",
            "homegf": "0",
            "highestprobable": "0",
            "homewins": "0",
            "artificialkey": str(max_key),
            "nummatchesplayed": "0",
            "teamid": team_id,
            "grouping": "0",
            "currenttableposition": "1",
            "awaywins": "0",
            "objective": "0",
            "points": "0",
            "actualvsexpectations": "0",
            "homelosses": "0",
            "unbeatenhome": "0",
            "lastgameresult": "0",
            "unbeatenaway": "0",
            "awaylosses": "0",
            "awaygf": "0",
            "awaydraws": "0",
            "awayga": "0",
            "homedraws": "0",
            "teamlongform": "0"
        }
        
        # Добавляем новую запись
        links.append(new_link)
        
        # Сохраняем файл с минимальным форматированием для скорости
        # Note: This is synchronous file I/O.
        write_start = time.time()
        with open(links_file, 'w', encoding='utf-8') as f:
            json.dump(links, f, ensure_ascii=False, separators=(',', ':'))
        
        write_time = time.time() - write_start
        total_time = time.time() - start_time
        
        
        return {
            "status": "success",
            "message": f"Команда {team_id} успешно подключена к лиге {league_id}",
            "added_count": 1,
            "processing_time": f"{total_time:.2f}s"
        }
        
    except Exception as e:
        print(f"[ERROR] Direct connection error: {e}")
        return {"status": "error", "message": f"Ошибка подключения: {str(e)}"}
