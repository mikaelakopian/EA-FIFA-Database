from fastapi import APIRouter, Query, HTTPException
from .utils import load_json_file, save_json_file
from typing import List, Dict, Any
import asyncio
import os

router = APIRouter()

# Cache for loaded data
_teamplayerlinks_cache: Dict[str, List[Dict[str, Any]]] = {}

@router.get("/teamplayerlinks", tags=["teamplayerlinks"])
async def get_teamplayerlinks(project_id: str = Query(None, description="Project ID to load teamplayerlinks from")):
    """Get teamplayerlinks data from project folder or default file, using cache."""
    file_to_load = '../fc25/data/fifa_ng_db/teamplayerlinks.json'
    if project_id:
        project_file = f'../projects/{project_id}/data/fifa_ng_db/teamplayerlinks.json'
        # Check cache first for project file
        if project_file in _teamplayerlinks_cache:
            return _teamplayerlinks_cache[project_file]
        try:
            data = load_json_file(project_file)
            _teamplayerlinks_cache[project_file] = data # Cache project data
            return data
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project teamplayerlinks: {e.detail}")
            # Fall through to default if project file not found or other non-404 http error during load
    
    # If no project_id or project file failed, try default (checking cache first)
    if file_to_load in _teamplayerlinks_cache:
        return _teamplayerlinks_cache[file_to_load]
    
    data = load_json_file(file_to_load)
    _teamplayerlinks_cache[file_to_load] = data # Cache default data
    return data

async def save_teamplayerlinks_with_jersey_numbers(
    project_name: str, 
    team_id: str, 
    player_links_info: List[Dict[str, str]] # Expects list of {"playerid": "...", "jerseynumber": "...", "position_code": "..."}
) -> Dict[str, Any]:
    """Save team-player links with jersey numbers and extended attributes to project's teamplayerlinks.json file."""
    if not project_name:
        return {"status": "error", "message": "Project name is required"}
    
    teamplayerlinks_file_path = f'../projects/{project_name}/data/fifa_ng_db/teamplayerlinks.json'
    
    try:
        existing_links: List[Dict[str, Any]] = []
        try:
            # Try to load from cache first if available, otherwise load from file
            if teamplayerlinks_file_path in _teamplayerlinks_cache:
                existing_links = list(_teamplayerlinks_cache[teamplayerlinks_file_path]) # Use a copy
            else:
                existing_links = load_json_file(teamplayerlinks_file_path)
        except FileNotFoundError:
            os.makedirs(os.path.dirname(teamplayerlinks_file_path), exist_ok=True)
        except HTTPException as e:
            if e.status_code == 404: # File not found is okay, means we start fresh
                os.makedirs(os.path.dirname(teamplayerlinks_file_path), exist_ok=True)
            else: # Re-raise other HTTP exceptions
                raise
        
        # Determine starting artificialkey
        max_artificial_key = -1
        if existing_links:
            for link in existing_links:
                try:
                    key_val = int(link.get('artificialkey', -1))
                    max_artificial_key = max(max_artificial_key, key_val)
                except ValueError:
                    continue
        
        # Remove any existing links for this team before adding new ones
        updated_links_for_file = [link for link in existing_links if link.get('teamid') != team_id]
        
        added_links_count = 0
        for idx, player_data in enumerate(player_links_info):
            current_artificial_key = max_artificial_key + 1 + idx
            link_data = {
                # Order based on user's desired output
                "isamongtopscorers": "0",
                "yellows": "0",
                "isamongtopscorersinteam": "0",
                "leaguegoals": "0",
                "jerseynumber": player_data.get("jerseynumber", str(idx + 1)),
                "position": player_data.get("position_code", "14"), # Default to CM (14) if not provided
                "artificialkey": str(current_artificial_key),
                "teamid": team_id,
                "leaguegoalsprevmatch": "0",
                "injury": "0",
                "leagueappearances": "0",
                "istopscorer": "0",
                "leaguegoalsprevthreematches": "0",
                "playerid": player_data["playerid"],
                "form": "3", # Default from example
                "reds": "0" # Changed from redcards and added
                # Removed: cups, cupgoals, leaguegames, yellowcards, redcards
            }
            updated_links_for_file.append(link_data)
            added_links_count += 1
        
        await asyncio.to_thread(save_json_file, teamplayerlinks_file_path, updated_links_for_file)
        
        # Update cache
        _teamplayerlinks_cache[teamplayerlinks_file_path] = updated_links_for_file
        
        return {
            "status": "success",
            "message": f"Successfully saved {added_links_count} team-player links for team {team_id}",
            "added_count": added_links_count
        }
        
    except Exception as e:
        print(f"[ERROR] Error in save_teamplayerlinks_with_jersey_numbers: {str(e)}")
        return {
            "status": "error",
            "message": f"Error saving team-player links: {str(e)}",
            "added_count": 0
        }
