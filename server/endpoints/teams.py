from fastapi import APIRouter, Query, HTTPException
from .utils import load_json_file, save_json_file
from .websocket import send_progress_sync
from .transfermarkt import download_and_process_team_crest, parse_tm_club_url, squad_url, scrape_squad, get_scraper, return_scraper # Assuming this can be async or wrapped
from .teamkits import add_team_kits_internal
from .teamstadiumlinks import add_team_stadiums_internal
from .manager import add_managers_internal
from .utils.extract_colors import extract_dominant_colors # Assuming this might be blocking
from .utils.language_strings_utils import create_abbreviated_name, process_language_strings
from .leagueteamlinks import connect_team_to_league_direct
from .utils.teams_unit import get_next_team_id
from .players import save_players_to_project, save_playernames_to_project
from .teamplayerlinks import save_teamplayerlinks_with_jersey_numbers
from .tactics import _add_team_formation, _add_default_teamdata, _add_default_teamsheet, _add_default_mentalities, calculate_team_ratings
from pydantic import BaseModel
from typing import List, Optional, Tuple, Callable, Dict, Any
import json
import os
import time
import random
import re
from pathlib import Path
import asyncio
from datetime import datetime
import functools # For functools.partial

router = APIRouter()

# --- Models ---
class TransfermarktTeam(BaseModel):
    teamname: str
    teamlogo: str
    team_url: str
    team_id: str
    squad: int
    avg_age: float
    foreigners: int
    avg_market_value: str
    total_market_value: str

class AddTeamsRequest(BaseModel):
    teams: List[TransfermarktTeam]
    project_id: Optional[str] = None
    league_id: str

# --- Category Handler Functions ---

# Category 0: Logo Download
async def _handle_cat0_logo_download(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Optional[Dict[str, Any]]:
    # Assuming download_and_process_team_crest might be synchronous and IO-bound
    # If it's already async, the to_thread wrapper is not strictly needed but harmless.
    # If it's CPU-bound and long, to_thread is also appropriate.
    await asyncio.to_thread(download_and_process_team_crest, tm_team.teamlogo, project_name, new_team_id, tm_team.teamname)
    return {"logo_download_status": "completed", "logo_path_suggestion": f"{project_name or 'fc25'}/images/crest/l{new_team_id}.png"}


# Category 4: Team Colors (Original _generate_team_colors_data adapted)
async def _handle_cat4_team_colors(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, str]:
    logo_path_str = None
    base_path_for_logos = Path.cwd()

    search_paths = []
    if project_name:
        search_paths.extend([
            base_path_for_logos / "projects" / project_name / "images" / "crest" / f"l{new_team_id}.png",
            base_path_for_logos / "projects" / project_name / "images" / "crest" / f"{new_team_id}.png",
        ])
    search_paths.extend([
        base_path_for_logos / "fc25" / "images" / "teams" / f"l{new_team_id}.png",
        base_path_for_logos / "fc25" / "images" / "teams" / f"{new_team_id}.png"
    ])

    for p_obj in search_paths:
        if await asyncio.to_thread(p_obj.exists): # p_obj.exists() is sync
            logo_path_str = str(p_obj)
            break
            
    if logo_path_str:
        # extract_dominant_colors is likely CPU/IO bound, run in a thread
        colors = await asyncio.to_thread(extract_dominant_colors, logo_path_str)
    else:
        colors = [(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)) for _ in range(3)]
        if len(colors) < 3:
             colors.extend([(random.randint(0,255), random.randint(0,255), random.randint(0,255)) for _ in range(3 - len(colors))])

    return {
        "teamcolor1r": str(colors[0][0]), "teamcolor1g": str(colors[0][1]), "teamcolor1b": str(colors[0][2]),
        "teamcolor2r": str(colors[1][0]), "teamcolor2g": str(colors[1][1]), "teamcolor2b": str(colors[1][2]),
        "teamcolor3r": str(colors[2][0]), "teamcolor3g": str(colors[2][1]), "teamcolor3b": str(colors[2][2]),
    }

# Generic handler for simple data categories (1-3, 5-12)
async def _handle_simple_data_category(generator_func: Callable, tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, str]:
    # The original lambdas take (tm_team, new_team_id, **kwargs_for_lambda)
    # Pass project_name and league_id explicitly or let them be caught by **kwargs in lambda
    return generator_func(tm_team=tm_team, new_team_id=new_team_id, project_name=project_name, league_id=league_id)


# Category 13: League Connection
async def _handle_cat13_league_connection(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, Any]:
    data_to_return: Dict[str, Any] = {}
    if project_name and league_id:
        try:
            result = await connect_team_to_league_direct(project_name, league_id, new_team_id)
            print(f"        📋 Connection result: {result}")
            data_to_return = {
                "league_connection_status": result.get("status", "error"),
                "league_id": league_id,
                "connection_message": result.get("message", "Connection attempt finished."),
                "added_count": str(result.get("added_count", 0)),
                "processing_time": result.get("processing_time", "N/A")
            }
        except Exception as e:
            print(f"        ❌ Exception connecting team {tm_team.teamname} to league: {e}")
            data_to_return = {"league_connection_status": "error", "league_id": league_id, "connection_message": f"Exception: {str(e)}"}
    else:
        message = "Project name or league ID not specified for league connection."
        print(f"        ⚠️ {message}")
        data_to_return = {"league_connection_status": "warning", "league_id": league_id or "not_specified", "connection_message": message}
    return data_to_return

# Category 14: Stadium Link
async def _handle_cat14_stadium_link(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, Any]:
    data_to_return: Dict[str, Any] = {}
    if project_name:
        try:
            print(f"        🏟️ Adding stadium link for team {tm_team.teamname}...")
            stadium_result = await add_team_stadiums_internal(project_name, [new_team_id])
            print(f"        📋 Stadium link result: {stadium_result}")
            data_to_return = {
                "stadium_status": stadium_result.get("status", "error"),
                "stadium_message": stadium_result.get("message", "Stadium linking finished."),
                "stadium_count": str(stadium_result.get("added_count", 0))
            }
        except Exception as e:
            print(f"        ❌ Exception adding stadium link for team {tm_team.teamname}: {e}")
            data_to_return = {"stadium_status": "error", "stadium_message": f"Stadium exception: {str(e)}"}
    else:
        message = "Project name not specified for adding stadium link."
        print(f"        ⚠️ {message}")
        data_to_return = {"stadium_status": "warning", "stadium_message": message}
    return data_to_return

# Category 15: Team Kits
async def _handle_cat15_team_kits(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, Any]:
    data_to_return: Dict[str, Any] = {}
    if project_name:
        try:
            print(f"        👕 Adding team kits for team {tm_team.teamname}...")
            kits_result = await add_team_kits_internal(project_name, [new_team_id])
            print(f"        📋 Team kits result: {kits_result}")
            data_to_return = {
                "kits_status": kits_result.get("status", "error"),
                "kits_message": kits_result.get("message", "Kit processing finished."),
                "kits_count": str(kits_result.get("added_kits_count", 0)),
                "teams_processed_for_kits": str(kits_result.get("teams_processed", 0))
            }
        except Exception as e:
            print(f"        ❌ Exception adding team kits for team {tm_team.teamname}: {e}")
            data_to_return = {"kits_status": "error", "kits_message": f"Kits exception: {str(e)}"}
    else:
        message = "Project name not specified for adding team kits."
        print(f"        ⚠️ {message}")
        data_to_return = {"kits_status": "warning", "kits_message": message}
    return data_to_return

# Category 16: Team Manager
async def _handle_cat16_manager(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, Any]:
    data_to_return: Dict[str, Any] = {}
    if project_name:
        try:
            print(f"        👨‍💼 Creating team manager for team {tm_team.teamname}...")
            manager_payload = {
                "full_name": f"Manager {tm_team.teamname}", "firstname": "Manager",
                "surname": tm_team.teamname[:20], "tm_trainer_id": "",
                "nationality_name": "Unknown", "nationality_id": "0", # Placeholder
                "birth_dt": datetime(1970, 1, 1), "profile_path": ""  # Placeholder
            }
            manager_result = await add_managers_internal(project_name, [manager_payload]) # Pass team_id if needed
            print(f"        📋 Team manager result: {manager_result}")
            data_to_return = {
                "manager_status": manager_result.get("status", "error"),
                "manager_message": manager_result.get("message", "Manager creation finished."),
                "manager_count": str(manager_result.get("added_count", 0)),
                "manager_name_created": manager_payload["full_name"] if manager_result.get("status") == "success" else None
            }
        except Exception as e:
            print(f"        ❌ Exception creating team manager for team {tm_team.teamname}: {e}")
            data_to_return = {"manager_status": "error", "manager_message": f"Manager exception: {str(e)}"}
    else:
        message = "Project name not specified for creating team manager."
        print(f"        ⚠️ {message}")
        data_to_return = {"manager_status": "warning", "manager_message": message}
    return data_to_return

# Category 17: Language Strings
async def _handle_cat17_language_strings(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, Any]:
    data_to_return: Dict[str, Any] = {}
    if project_name:
        try:
            print(f"        🌐 Processing language strings for team {tm_team.teamname}...")
            await process_language_strings(tm_team.teamname, new_team_id, project_name)
            team_name_clean = re.sub(r'\s*\(\d+\)$', '', tm_team.teamname)
            # create_abbreviated_name is sync and likely fast
            abbr3 = create_abbreviated_name(team_name_clean, 3)
            abbr10 = create_abbreviated_name(team_name_clean, 10)
            abbr15 = create_abbreviated_name(team_name_clean, 15)
            data_to_return = {
                "language_strings_status": "success", "language_strings_message": "Language strings processed.",
                "abbr3": abbr3, "abbr10": abbr10, "abbr15": abbr15
            }
        except Exception as e:
            print(f"        ❌ Error processing language strings for team {tm_team.teamname}: {e}")
            data_to_return = {"language_strings_status": "error", "language_strings_message": f"Language strings error: {str(e)}"}
    else:
        message = "Project name not specified, skipping language strings."
        print(f"        ⚠️ {message}")
        data_to_return = {"language_strings_status": "skipped", "language_strings_message": message}
    return data_to_return

# --- New Handler for Player Processing - Only Parsing ---
async def _handle_cat_process_players(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, **kwargs) -> Dict[str, Any]:
    print(f"        ⚽ Parsing players for team {tm_team.teamname} (ID: {new_team_id}) using URL: {tm_team.team_url}")

    slug, vid = parse_tm_club_url(tm_team.team_url)
    if not slug or not vid:
        message = f"Could not parse club slug/ID from team URL: {tm_team.team_url}"
        print(f"        ❌ {message}")
        return {
            "player_processing_status": "error",
            "players_parsed_count": 0,
            "player_processing_message": message
        }

    team_squad_page_url = squad_url(slug, vid, tm_team.teamname)
    if not team_squad_page_url:
        message = f"Could not construct squad page URL for team: {tm_team.teamname}"
        print(f"        ❌ {message}")
        return {
            "player_processing_status": "error",
            "players_parsed_count": 0,
            "player_processing_message": message
        }

    print(f"        ℹ️  Attempting to scrape squad from: {team_squad_page_url}")
    
    scraper = None
    players_data = []
    status_message = "Unknown error"

    try:
        scraper = await asyncio.to_thread(get_scraper) # get_scraper is sync
        # scrape_squad is a synchronous function, run it in a thread
        # The "function_name" argument is for cancellation flags within scrape_squad's logic
        players_data, status_message = await asyncio.to_thread(
            scrape_squad, 
            team_squad_page_url, 
            scraper, 
            "teams_player_processing_step" 
        )
        
        print(f"        📊 Scraping result: status='{status_message}', players_count={len(players_data)}")
        
        if status_message == "Success":
            print(f"        ✅ Successfully parsed {len(players_data)} players for {tm_team.teamname}.")
            
            # Log first few players for debugging
            if players_data:
                print(f"        🔍 Sample player data (first 3):")
                for i, player in enumerate(players_data[:3]):
                    print(f"          {i+1}. {player.get('player_name', 'N/A')} - #{player.get('player_number', 'N/A')} - {player.get('player_position', 'N/A')} - {player.get('market_value_eur', 'N/A')}")
            
            # Prepare data for the table, including position and market value
            parsed_players_for_table = [
                {
                    "number": p.get("player_number", "-"),
                    "name": p.get("player_name", "N/A"),
                    "position": p.get("player_position", "N/A"), # Added position
                    "nationality": p.get("player_nationality", "N/A"), # Added nationality
                    "value": p.get("market_value_eur", "-"),
                    "player_profile_url": p.get("player_profile_url", "#"),
                    "date_of_birth_age": p.get("date_of_birth_age", "N/A"), # Added age data
                    "age": p.get("date_of_birth_age", "N/A") # Also as 'age' for easier access
                }
                for p in players_data
            ]
            
            print(f"        📋 Prepared table data with {len(parsed_players_for_table)} players")
            
            # Log first few table entries for debugging
            if parsed_players_for_table:
                print(f"        🔍 Sample table data (first 3):")
                for i, player in enumerate(parsed_players_for_table[:3]):
                    print(f"          {i+1}. {player['name']} - #{player['number']} - {player['position']} - {player['nationality']} - Age: {player.get('age', 'N/A')} - {player['value']} - URL: {player.get('player_profile_url', 'N/A')}")
            
            # Store players data for later saving
            result = {
                "player_processing_status": "success",
                "players_parsed_count": len(players_data),
                "player_processing_message": f"Successfully parsed {len(players_data)} players for {tm_team.teamname}.",
                "parsed_players_sample": [{"name": p.get("player_name"), "url": p.get("player_profile_url")} for p in players_data[:3]],
                "parsed_players_for_table": parsed_players_for_table, # New key with more detailed player data
                "parsed_players_raw_data": players_data,  # Store raw data for saving later
                "players_processing_progress": {}  # Initialize empty progress dict
            }
            
            print(f"        📤 Returning result with keys: {list(result.keys())}")
            print(f"        📤 parsed_players_for_table length: {len(result['parsed_players_for_table'])}")
            
            return result
        else:
            print(f"        ⚠️  Warning/Error during player parsing for {tm_team.teamname}: {status_message}")
            return {
                "player_processing_status": "warning" if "not found" not in status_message.lower() else "error",
                "players_parsed_count": len(players_data),
                "player_processing_message": f"Player parsing for {tm_team.teamname}: {status_message}"
            }

    except Exception as e:
        print(f"        ❌ Exception during player processing for {tm_team.teamname}: {str(e)}")
        return {
            "player_processing_status": "error",
            "players_parsed_count": 0,
            "player_processing_message": f"Exception processing players for {tm_team.teamname}: {str(e)}"
        }
    finally:
        if scraper:
            await asyncio.to_thread(return_scraper, scraper) # return_scraper is sync

# --- New Handler for Saving Players ---
async def _handle_cat_save_players(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, parsed_players_raw_data: Optional[List[Dict[str, Any]]] = None, **kwargs) -> Dict[str, Any]:
    print(f"        💾 Saving players for team {tm_team.teamname} (ID: {new_team_id})")
    
    if not parsed_players_raw_data:
        return {
            "player_save_status": "skipped",
            "player_save_message": "No player data to save"
        }
    
    if not project_name:
        return {
            "player_save_status": "skipped",
            "player_save_message": "No project name provided"
        }
    
    try:
        print(f"        💾 Saving {len(parsed_players_raw_data)} players to project '{project_name}'...")
        save_result = await save_players_to_project(project_name, parsed_players_raw_data, new_team_id, tm_team.teamname, league_id)
        print(f"        📋 Save result: {save_result}")
        
        # Prepare player data with new IDs for tactics handler
        saved_player_data = []
        if save_result.get("status") == "success" and save_result.get("player_ids"):
            # Load the saved players to get their full data including positions
            try:
                players_file = f'../projects/{project_name}/data/fifa_ng_db/players.json'
                all_players = await asyncio.to_thread(load_json_file, players_file)
                
                # Find the newly saved players by their IDs
                saved_ids = save_result.get("player_ids", [])
                for player in all_players:
                    player_id = str(player.get("playerid", ""))
                    if player_id in [str(sid) for sid in saved_ids]:
                        saved_player_data.append({
                            "playerid": player_id,  # Keep as string for tactics
                            "overallrating": int(player.get("overallrating", 65)),
                            "preferredposition1": int(player.get("preferredposition1", -1))
                        })
                print(f"        📊 Found {len(saved_player_data)} saved players for tactics")
                if saved_player_data:
                    print(f"        🔍 Sample saved player IDs: {[p['playerid'] for p in saved_player_data[:3]]}")
            except Exception as e:
                print(f"        ⚠️ Warning: Could not load saved player data for tactics: {e}")
        
        return {
            "player_save_status": save_result.get("status", "unknown"),
            "player_save_message": save_result.get("message", ""),
            "saved_player_ids": save_result.get("player_ids", []),
            "saved_players_for_tactics": saved_player_data  # New key with player data for tactics
        }
    except Exception as e:
        print(f"        ❌ Exception saving players for {tm_team.teamname}: {str(e)}")
        return {
            "player_save_status": "error",
            "player_save_message": f"Exception saving players: {str(e)}"
        }

# Category: Team formations and tactics
async def _handle_cat_tactics(tm_team: TransfermarktTeam, new_team_id: str, project_name: Optional[str], league_id: str, parsed_players_raw_data: Optional[List[Dict[str, Any]]] = None, saved_players_for_tactics: Optional[List[Dict[str, Any]]] = None, **kwargs) -> Dict[str, Any]:
    """Handle adding team formations, teamsheets, and mentalities"""
    data_to_return: Dict[str, Any] = {}
    
    if not project_name:
        message = "Project name not specified for adding tactics."
        print(f"        ⚠️ {message}")
        return {"tactics_status": "warning", "tactics_message": message}
    
    try:
        print(f"        🎯 Adding formations and tactics for team {tm_team.teamname}...")
        
        # Get project data directory
        data_dir = os.path.join("projects", project_name, "data", "fifa_ng_db")
        
        # Get players for this team - prefer saved players with new IDs
        players_data = []
        if saved_players_for_tactics:
            # Use the saved players data which already has the correct format and new IDs
            players_data = saved_players_for_tactics
            print(f"        👥 Using {len(players_data)} saved players with new IDs for tactics")
            if players_data:
                print(f"        🆔 First 3 player IDs for tactics: {[p['playerid'] for p in players_data[:3]]}")
        elif parsed_players_raw_data:
            # Fallback to raw data if saved data not available (shouldn't happen normally)
            print(f"        ⚠️ Warning: Using raw player data, tactics will have Transfermarkt IDs")
            for player in parsed_players_raw_data:
                player_dict = {
                    "playerid": player.get("player_id", ""),
                    "overallrating": player.get("overall_rating", 65),
                    "preferredposition1": player.get("preferredposition1", -1)
                }
                players_data.append(player_dict)
        
        tactic = "4-4-2"  # Default tactic
        
        # 1. Add formation
        try:
            formation_result = _add_team_formation(data_dir, new_team_id, tactic)
            data_to_return["formation_status"] = "success" if formation_result else "error"
            data_to_return["formation_message"] = f"Formation {tactic} added"
        except Exception as e:
            data_to_return["formation_status"] = "error"
            data_to_return["formation_message"] = str(e)
        
        # 2. Add default team data
        try:
            teamdata_result = _add_default_teamdata(data_dir, new_team_id, tactic)
            data_to_return["teamdata_status"] = "success" if teamdata_result else "error"
            data_to_return["teamdata_message"] = f"Team data {tactic} added"
        except Exception as e:
            data_to_return["teamdata_status"] = "error"
            data_to_return["teamdata_message"] = str(e)
        
        # 3. Add teamsheet with players
        try:
            teamsheet_result = _add_default_teamsheet(data_dir, new_team_id, players_data, tactic)
            data_to_return["teamsheet_status"] = "success" if teamsheet_result else "error"
            data_to_return["teamsheet_message"] = f"Teamsheet {tactic} added with {len(players_data)} players"
        except Exception as e:
            data_to_return["teamsheet_status"] = "error"
            data_to_return["teamsheet_message"] = str(e)
        
        # 4. Add mentalities
        try:
            mentalities_result = _add_default_mentalities(data_dir, new_team_id, players_data, tactic)
            data_to_return["mentalities_status"] = "success" if mentalities_result else "error"
            data_to_return["mentalities_message"] = f"Mentalities {tactic} added"
            data_to_return["mentalities_count"] = len(mentalities_result) if mentalities_result else 0
        except Exception as e:
            data_to_return["mentalities_status"] = "error"
            data_to_return["mentalities_message"] = str(e)
        
        # 5. Calculate team ratings based on players
        if players_data:
            ratings = calculate_team_ratings(players_data)
            data_to_return.update(ratings)
        
        print(f"        ✅ Tactics processing complete for {tm_team.teamname}")
        data_to_return["tactics_status"] = "success"
        data_to_return["tactics_message"] = f"All tactics components added successfully"
        
    except Exception as e:
        print(f"        ❌ Exception adding tactics for team {tm_team.teamname}: {e}")
        data_to_return["tactics_status"] = "error"
        data_to_return["tactics_message"] = f"Tactics exception: {str(e)}"
    
    return data_to_return

# --- Original simple data generators (used by _handle_simple_data_category) ---
# These lambdas expect tm_team, new_team_id, and **kwargs (which will catch project_name, league_id)
# Type hint for the generator functions
GeneratorFuncType = Callable[..., Dict[str, str]] # Simplified for brevity

category_data_generators: Dict[int, GeneratorFuncType] = {
    1: lambda tm_team, new_team_id, **kwargs: { # Basic team info
        "teamname": tm_team.teamname, "teamid": new_team_id, "assetid": new_team_id,
        "foundationyear": str(random.randint(1880, 1950)), "cityid": str(random.randint(1, 1000)),
        "personalityid": str(random.randint(1, 10)), "ethnicity": str(random.randint(1, 10)),
        "gender": "0", "rivalteam": "0", "latitude": str(random.randint(40, 60)),
        "longitude": str(random.randint(-10, 30)),
    },
    2: lambda tm_team, new_team_id, **kwargs: { # Stadium information
        "teamstadiumcapacity": str(random.randint(20000, 80000)), "pitchcolor": str(random.randint(0, 5)),
        "pitchwear": "0", "playsurfacetype": "0", "stadiumgoalnetstyle": "0",
        "stadiummowpattern_code": "1", "stadiumgoalnetpattern": "0", "hasstandingcrowd": "0",
        "isbannerenabled": "1", "iscompetitionpoleflagenabled": "0",
        "iscompetitioncrowdcardsenabled": "2", "iscompetitionscarfenabled": "0", "skinnyflags": "0",
    },
    3: lambda tm_team, new_team_id, **kwargs: { # Branding and visual elements
        "jerseytype": "2", "presassetone": "0", "presassettwo": "0", "genericbanner": "0",
        "hastifo": "0", "hassuncanthem": "0", "hassubstitutionboard": "0", "hasvikingclap": "0",
        "stanchionflamethrower": "0", "flamethrowercannon": "0",
    },
    # Category 4 is handled by _handle_cat4_team_colors directly
    5: lambda tm_team, new_team_id, **kwargs: { # Goal net colors and styles
        "goalnetstanchioncolor1r": "1", "goalnetstanchioncolor1g": "1", "goalnetstanchioncolor1b": "1",
        "goalnetstanchioncolor2r": "1", "goalnetstanchioncolor2g": "1", "goalnetstanchioncolor2b": "1",
    },
    6: lambda tm_team, new_team_id, **kwargs: { # Team ratings
        "attackrating": str(random.randint(65, 85)), "midfieldrating": str(random.randint(65, 85)),
        "defenserating": str(random.randint(65, 85)), "overallrating": str(random.randint(65, 85)),
        "matchdayattackrating": str(random.randint(65, 85)), "matchdaymidfieldrating": str(random.randint(65, 85)),
        "matchdaydefenserating": str(random.randint(65, 85)), "matchdayoverallrating": str(random.randint(65, 85)),
    },
    7: lambda tm_team, new_team_id, **kwargs: { # Tactics and gameplay style
        "buildupplay": "1", "defensivedepth": str(random.randint(50, 80)),
        "youthdevelopment": str(random.randint(1, 10)), "opponentweakthreshold": "3",
        "opponentstrongthreshold": "3",
    },
    8: lambda tm_team, new_team_id, **kwargs: { # Player roles
        "captainid": "0", "rightfreekicktakerid": "0", "leftfreekicktakerid": "0",
        "longkicktakerid": "0", "rightcornerkicktakerid": "0", "leftcornerkicktakerid": "0",
        "penaltytakerid": "0", "freekicktakerid": "0", "favoriteteamsheetid": "-1",
    },
    9: lambda tm_team, new_team_id, **kwargs: { # Trophies and achievements
        "leaguetitles": "0", "domesticcups": "0", "uefa_cl_wins": "0", "uefa_el_wins": "0",
        "uefa_uecl_wins": "0", "uefa_consecutive_wins": "0", "prev_el_champ": "0",
    },
    10: lambda tm_team, new_team_id, **kwargs: { # Finances and prestige
        "clubworth": str(random.randint(1000000, 100000000)), "popularity": str(random.randint(1, 10)),
        "domesticprestige": str(random.randint(1, 10)), "internationalprestige": str(random.randint(1, 10)),
        "profitability": str(random.randint(1, 5)),
    },
    11: lambda tm_team, new_team_id, **kwargs: { # Transfers
        "numtransfersin": "0",
    },
    12: lambda tm_team, new_team_id, **kwargs: { # Miscellaneous parameters
        "trait1vweak": str(random.randint(50000, 100000)), "trait1vequal": str(random.randint(100000, 150000)),
        "trait1vstrong": str(random.randint(150000, 200000)), "cksupport1": "0", "cksupport2": "0",
        "cksupport3": "0", "genericint1": "-1", "genericint2": "-1", "powid": "-1", "form": "0",
        "ballid": str(random.randint(1, 200)), "trainingstadium": str(random.randint(1, 500)),
        "utcoffset": "0", "pitchlinecolor": "0", "crowdregion": str(random.randint(1, 10)),
        "crowdskintonecode": str(random.randint(1, 10)), "haslargeflag": "0"
    },
}

# --- List of Team Processing Steps ---
# Each step has a 'name' for UI/logging and a 'handler' function.
# functools.partial is used to adapt the generic _handle_simple_data_category
# to specific generator functions from category_data_generators.

TEAM_PROCESSING_STEPS = [
    {"name": "📥 Downloading team logo", "handler": _handle_cat0_logo_download},
    {"name": "🏷️ Basic team info", "handler": functools.partial(_handle_simple_data_category, category_data_generators[1])},
    {"name": "🏟️ Stadium information", "handler": functools.partial(_handle_simple_data_category, category_data_generators[2])},
    {"name": "🧢 Branding and visual elements", "handler": functools.partial(_handle_simple_data_category, category_data_generators[3])},
    {"name": "🎨 Team colors", "handler": _handle_cat4_team_colors},
    {"name": "🥅 Goal net colors and styles", "handler": functools.partial(_handle_simple_data_category, category_data_generators[5])},
    {"name": "⚽ Processing team players", "handler": _handle_cat_process_players},
    {"name": "💾 Saving team players", "handler": _handle_cat_save_players},
    {"name": "📊 Team ratings", "handler": functools.partial(_handle_simple_data_category, category_data_generators[6])},
    {"name": "⚽ Tactics and gameplay style", "handler": functools.partial(_handle_simple_data_category, category_data_generators[7])},
    {"name": "🎯 Team formations and tactics", "handler": lambda tm_team, new_team_id, project_name, league_id, **kwargs: _handle_cat_tactics(tm_team, new_team_id, project_name, league_id, **kwargs)},
    {"name": "🧠 Player roles", "handler": functools.partial(_handle_simple_data_category, category_data_generators[8])},
    {"name": "🏆 Trophies and achievements", "handler": functools.partial(_handle_simple_data_category, category_data_generators[9])},
    {"name": "💰 Finances and prestige", "handler": functools.partial(_handle_simple_data_category, category_data_generators[10])},
    {"name": "🔁 Transfers", "handler": functools.partial(_handle_simple_data_category, category_data_generators[11])},
    {"name": "🧩 Miscellaneous parameters", "handler": functools.partial(_handle_simple_data_category, category_data_generators[12])},
    {"name": "🔗 Connecting to league", "handler": _handle_cat13_league_connection},
    {"name": "🏟️ Adding stadium link", "handler": _handle_cat14_stadium_link},
    {"name": "👕 Adding team kits", "handler": _handle_cat15_team_kits},
    {"name": "👨‍💼 Creating team manager", "handler": _handle_cat16_manager},
    {"name": "🌐 Processing language strings", "handler": _handle_cat17_language_strings},
]


def clean_team_data_for_fifa(team_data: Dict[str, Any]) -> Dict[str, Any]:
    """Clean team data to only include FIFA-needed fields, removing processing statuses"""
    
    # Define the fields that should be kept for FIFA teams.json
    fifa_team_fields = {
        # Basic team info
        'teamname', 'teamid', 'assetid', 'foundationyear', 'cityid', 'personalityid', 
        'ethnicity', 'gender', 'rivalteam', 'latitude', 'longitude',
        
        # Stadium information
        'teamstadiumcapacity', 'pitchcolor', 'pitchwear', 'playsurfacetype', 'stadiumgoalnetstyle',
        'stadiummowpattern_code', 'stadiumgoalnetpattern', 'hasstandingcrowd', 'isbannerenabled',
        'iscompetitionpoleflagenabled', 'iscompetitioncrowdcardsenabled', 'iscompetitionscarfenabled',
        'skinnyflags',
        
        # Branding and visual elements
        'jerseytype', 'presassetone', 'presassettwo', 'genericbanner', 'hastifo', 'hassuncanthem',
        'hassubstitutionboard', 'hasvikingclap', 'stanchionflamethrower', 'flamethrowercannon',
        
        # Team colors
        'teamcolor1r', 'teamcolor1g', 'teamcolor1b', 'teamcolor2r', 'teamcolor2g', 'teamcolor2b',
        'teamcolor3r', 'teamcolor3g', 'teamcolor3b',
        
        # Goal net colors
        'goalnetstanchioncolor1r', 'goalnetstanchioncolor1g', 'goalnetstanchioncolor1b',
        'goalnetstanchioncolor2r', 'goalnetstanchioncolor2g', 'goalnetstanchioncolor2b',
        
        # Team ratings
        'attackrating', 'midfieldrating', 'defenserating', 'overallrating',
        'matchdayattackrating', 'matchdaymidfieldrating', 'matchdaydefenserating', 'matchdayoverallrating',
        
        # Tactics and gameplay
        'buildupplay', 'defensivedepth', 'youthdevelopment', 'opponentweakthreshold', 'opponentstrongthreshold',
        
        # Player roles
        'captainid', 'rightfreekicktakerid', 'leftfreekicktakerid', 'longkicktakerid',
        'rightcornerkicktakerid', 'leftcornerkicktakerid', 'penaltytakerid', 'freekicktakerid',
        'favoriteteamsheetid',
        
        # Trophies and achievements
        'leaguetitles', 'domesticcups', 'uefa_cl_wins', 'uefa_el_wins', 'uefa_uecl_wins',
        'uefa_consecutive_wins', 'prev_el_champ',
        
        # Finances and prestige
        'clubworth', 'popularity', 'domesticprestige', 'internationalprestige', 'profitability',
        
        # Transfers
        'numtransfersin',
        
        # Miscellaneous
        'trait1vweak', 'trait1vequal', 'trait1vstrong', 'cksupport1', 'cksupport2', 'cksupport3',
        'genericint1', 'genericint2', 'powid', 'form', 'ballid', 'trainingstadium', 'utcoffset',
        'pitchlinecolor', 'crowdregion', 'crowdskintonecode', 'haslargeflag'
    }
    
    # Filter team data to only include FIFA fields
    cleaned_data = {}
    for field in fifa_team_fields:
        if field in team_data:
            cleaned_data[field] = team_data[field]
    
    return cleaned_data

async def generate_team_data(
    tm_team: TransfermarktTeam, 
    new_team_id: str, 
    league_id: str, 
    project_name: Optional[str] = None, 
    progress_callback: Optional[Callable] = None, 
    team_data_callback: Optional[Callable] = None
) -> Dict[str, Any]:
    """Generate FIFA team data from Transfermarkt team with categorized fields"""
    
    team_data: Dict[str, Any] = {}
    parsed_players_raw_data: Optional[List[Dict[str, Any]]] = None
    
    for i, step_config in enumerate(TEAM_PROCESSING_STEPS):
        category_name = step_config["name"]
        handler_func = step_config["handler"]
        
        if progress_callback:
            progress_callback(category_name, i, len(TEAM_PROCESSING_STEPS))
        
        # Pass parsed_players_raw_data to save handler and tactics handler
        if category_name in ["💾 Saving team players", "🎯 Team formations and tactics"]:
            if category_name == "🎯 Team formations and tactics":
                # Pass both raw data and saved player data to tactics handler
                category_result_data = await handler_func(
                    tm_team=tm_team,
                    new_team_id=new_team_id,
                    project_name=project_name,
                    league_id=league_id,
                    parsed_players_raw_data=parsed_players_raw_data,
                    saved_players_for_tactics=saved_players_for_tactics
                )
            else:
                category_result_data = await handler_func(
                    tm_team=tm_team,
                    new_team_id=new_team_id,
                    project_name=project_name,
                    league_id=league_id,
                    parsed_players_raw_data=parsed_players_raw_data
                )
        else:
            # All handlers are async and share a common signature pattern
            # (tm_team, new_team_id, project_name, league_id are passed)
            # kwargs in handler signatures are for flexibility if some need more,
            # or for functools.partial to pass pre-set arguments.
            category_result_data = await handler_func(
                tm_team=tm_team,
                new_team_id=new_team_id,
                project_name=project_name,
                league_id=league_id
                # team_data_callback is not passed to handlers in this version,
                # as the main loop handles calling it with the result.
                # If a handler needs *finer-grained* internal updates, it could be passed.
            )
        
        if category_result_data: # If the handler returned data
            # Extract parsed_players_raw_data if present
            if "parsed_players_raw_data" in category_result_data:
                parsed_players_raw_data = category_result_data.pop("parsed_players_raw_data")
            # Extract saved_players_for_tactics if present
            if "saved_players_for_tactics" in category_result_data:
                saved_players_for_tactics = category_result_data.pop("saved_players_for_tactics")
            
            team_data.update(category_result_data)
            if team_data_callback:
                # Send the data specific to this category/step
                team_data_callback(tm_team.teamname, category_result_data)
        
        await asyncio.sleep(0.1) # Maintained from original code for pacing
    
    return team_data


@router.get("/teams", tags=["teams"])
async def get_teams(project_id: str = Query(None, description="Project ID to load teams from")):
    """Get teams data from project folder or default file"""
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/teams.json')
        except HTTPException as e:
            if e.status_code != 404: # pragma: no cover
                print(f"[ERROR] Error loading project teams: {e.detail}")
            # If 404, will fall through to default
    return load_json_file('../fc25/data/fifa_ng_db/teams.json')


@router.post("/teams/add-from-transfermarkt", tags=["teams"])
async def add_teams_from_transfermarkt(request: AddTeamsRequest):
    """Add teams from Transfermarkt to the game"""
    try:
        print(f"\n🚀 Начинается создание команд")
        print(f"📊 Проект: {request.project_id if request.project_id else 'default'}")
        print(f"🏆 Лига: {request.league_id}")
        print(f"📈 Команд к обработке: {len(request.teams)}")
        
        # Показываем информацию о доступных ML моделях
        try:
            from .PlayerParametersPredictionsModelMock import get_predictor
            predictor = get_predictor()
            available_params = predictor.get_available_parameters()
            if available_params:
                print(f"🤖 ML модели доступны для: {', '.join(available_params)}")
            else:
                print(f"🤖 ML модели: не найдены в папке models/")
        except Exception:
            print(f"🤖 ML модели: недоступны")
        
        print("-" * 50)
        
        teams_file_path = f'../projects/{request.project_id}/data/fifa_ng_db/teams.json' if request.project_id else '../fc25/data/fifa_ng_db/teams.json'
        
        try:
            teams_data_list = load_json_file(teams_file_path) # Changed variable name
        except HTTPException:
            teams_data_list = []
        
        send_progress_sync({
            "type": "progress", "function_name": "add_teams", "operation": "add_teams",
            "message": f"Starting to add {len(request.teams)} teams...",
            "current": 0, "total": len(request.teams), "percentage": 0,
            "completed_teams": [], "current_team": None
        })
        
        completed_teams_log = [] # Renamed to avoid conflict
        accumulated_team_data_for_ws = {} # Renamed for clarity
        
        for i, tm_team_item in enumerate(request.teams): # Renamed loop var
            current_team_name = tm_team_item.teamname
            send_progress_sync({
                "type": "progress", "function_name": "add_teams", "operation": "add_teams",
                "message": f"Processing team {i + 1} of {len(request.teams)}: {current_team_name}",
                "current": i, "total": len(request.teams), "percentage": (i / len(request.teams)) * 100,
                "completed_teams": completed_teams_log, "current_team": current_team_name,
                "current_category": None, "category_progress": 0,
                "team_data": accumulated_team_data_for_ws # Send the whole accumulated data
            })
            
            new_team_id = get_next_team_id(teams_data_list)
            
            # Initialize this team's data in the accumulator
            if current_team_name not in accumulated_team_data_for_ws:
                accumulated_team_data_for_ws[current_team_name] = {}
            
            def category_progress_callback(category_name, category_index, total_categories):
                category_percentage = ((category_index + 1) / total_categories) * 100
                overall_percentage = ((i + (category_index + 1) / total_categories) / len(request.teams)) * 100
                
                send_progress_sync({
                    "type": "progress", "function_name": "add_teams", "operation": "add_teams",
                    "message": f"Creating {current_team_name}: {category_name}",
                    "current": i, "total": len(request.teams), "percentage": overall_percentage,
                    "completed_teams": completed_teams_log, "current_team": current_team_name,
                    "current_category": category_name, "category_progress": category_percentage,
                    "team_data": accumulated_team_data_for_ws
                })
            
            def team_data_update_callback(team_name_cb: str, new_data_for_category: Dict[str, Any]):
                # This callback is now called by generate_team_data after each step's handler returns data.
                if team_name_cb not in accumulated_team_data_for_ws: # Should be initialized already
                    accumulated_team_data_for_ws[team_name_cb] = {}
                
                accumulated_team_data_for_ws[team_name_cb].update(new_data_for_category)
                
                # Always send the update with current state
                # The progress message has already been sent by category_progress_callback
                # This is just updating the team_data

            generated_team_full_data = await generate_team_data(
                tm_team_item, new_team_id, request.league_id, request.project_id, 
                category_progress_callback, team_data_update_callback
            )
            
            # Clean team data to only include FIFA-relevant fields before saving
            cleaned_team_data = clean_team_data_for_fifa(generated_team_full_data)
            teams_data_list.append(cleaned_team_data)
            completed_teams_log.append(tm_team_item.team_id) # Using Transfermarkt's original ID for logging completion
            
            send_progress_sync({
                "type": "progress", "function_name": "add_teams", "operation": "add_teams",
                "message": f"Completed team {i + 1} of {len(request.teams)}: {current_team_name}",
                "current": i + 1, "total": len(request.teams), "percentage": ((i + 1) / len(request.teams)) * 100,
                "completed_teams": completed_teams_log, "current_team": None, # Current team finished
                "current_category": "✅ Team completed", "category_progress": 100,
                "team_data": accumulated_team_data_for_ws
            })
            await asyncio.sleep(0.2) # Maintained pause
        
        print(f"\n💾 Сохранение {len(teams_data_list)} команд...")
        try:
            # save_json_file is sync, run in thread if it's significantly blocking
            await asyncio.to_thread(save_json_file, teams_file_path, teams_data_list)
            print(f"✅ Команды успешно сохранены!")
        except Exception as e: # pragma: no cover
            print(f"❌ Ошибка сохранения: {e}")
            raise
        
        await asyncio.sleep(0.5)
        send_progress_sync({
            "status": "completed", "type": "final_status", # Added type for clarity on client
            "function_name": "add_teams", "operation": "add_teams",
            "message": f"Successfully added {len(request.teams)} teams!",
            "total_added": len(request.teams),
            "completed_teams": completed_teams_log,
            "team_data": accumulated_team_data_for_ws # Final state of all processed teams' data
        })
        await asyncio.sleep(0.3)
        
        newly_added_team_ids = [t.get("teamid", "unknown") for t in teams_data_list[-len(request.teams):]] if len(teams_data_list) >= len(request.teams) else []
        
        return {
            "status": "success", "message": f"Successfully added {len(request.teams)} teams",
            "teams_added": len(request.teams), "new_team_ids": newly_added_team_ids
        }
        
    except Exception as e: # pragma: no cover
        print(f"❌ Ошибка при создании команд: {str(e)}")
        send_progress_sync({
            "status": "error", "type": "final_status", # Added type
            "function_name": "add_teams", "operation": "add_teams",
            "message": f"Error adding teams: {str(e)}"
        })
        raise HTTPException(status_code=500, detail=f"Error adding teams: {str(e)}")