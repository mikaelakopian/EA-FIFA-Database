from fastapi import APIRouter, Query, HTTPException
from .utils import load_json_file, save_json_file
from typing import List, Optional, Dict, Any
import asyncio
import time
from .websocket import send_progress_sync
import random
from datetime import datetime
import os
import requests
from PIL import Image
from io import BytesIO
from pathlib import Path
# Import the new save function from teamplayerlinks endpoint
from .teamplayerlinks import save_teamplayerlinks_with_jersey_numbers as save_tpl_extended
from .playernames import initialize_playernames_file
# Import ML prediction functionality
from .PlayerParametersPredictionsModel import enhance_player_data_with_predictions
# Import player attributes calculation functionality  
from .PlayerAttributesCalculationModel import generate_player_attributes, calculate_balance

router = APIRouter()

# Cache for loaded data to avoid repeated file reads
_players_cache = {}
_teamplayerlinks_cache = {} # This cache remains for the GET /players endpoint's internal use if needed

# Load nationality mapping
_nationality_map = None
def get_nationality_map():
    global _nationality_map
    if _nationality_map is None:
        try:
            _nationality_map = load_json_file('../db/tm_fifa_nation_map.json')
        except:
            _nationality_map = {}
    return _nationality_map

# Function to get or create name ID
async def get_or_create_nameid(project_name: str, name_string: str) -> int:
    """
    Gets existing name ID or creates new one for the given name.
    
    Args:
        project_name: Name of the project
        name_string: Name to get/create ID for
    
    Returns:
        int: Name ID
    """
    if not name_string or name_string.strip() == "":
        return 0  # Default ID for empty names
    
    playernames_file = f'../projects/{project_name}/data/fifa_ng_db/playernames.json'
    
    try:
        # Initialize playernames file if needed
        await initialize_playernames_file(project_name)
        
        # Load existing playernames
        playernames = await asyncio.to_thread(load_json_file, playernames_file)
        
        # Create name to ID mapping
        name_to_id_map = {}
        max_nameid = 999  # Start below 1000
        
        for entry in playernames:
            try:
                name_str = entry.get("name", "")
                name_id_val = int(entry.get("nameid", -1))
                
                if name_id_val == 0 and name_str == "":
                    name_to_id_map[""] = 0
                    continue
                elif name_str:
                    name_lower = name_str.lower()
                    if name_lower not in name_to_id_map:
                        name_to_id_map[name_lower] = name_id_val
                    max_nameid = max(max_nameid, name_id_val)
            except (ValueError, TypeError):
                continue
        
        # Check if name already exists
        name_lower = name_string.lower()
        if name_lower in name_to_id_map:
            return name_to_id_map[name_lower]
        
        # Create new name ID
        new_id = max_nameid + 1
        new_entry = {
            "nameid": str(new_id),
            "commentaryid": "900000",
            "name": name_string
        }
        
        # Only append and save if name doesn't exist
        playernames.append(new_entry)
        
        # Re-read the current file to make sure we don't overwrite other changes
        try:
            current_playernames = await asyncio.to_thread(load_json_file, playernames_file)
            # Check if our new name was already added by another process
            name_exists_in_current = any(
                entry.get("name", "").lower() == name_lower 
                for entry in current_playernames
            )
            
            if name_exists_in_current:
                # Name was added by another process, find its ID
                for entry in current_playernames:
                    if entry.get("name", "").lower() == name_lower:
                        return int(entry.get("nameid", 0))
            else:
                # Add our new entry to the current list
                current_playernames.append(new_entry)
                await asyncio.to_thread(save_json_file, playernames_file, current_playernames)
                print(f"    ✨ Added new name to playernames.json: '{name_string}' (ID: {new_id})")
        except Exception as save_error:
            print(f"    ⚠️ Error saving name '{name_string}': {str(save_error)}")
            # Return the ID anyway, as we generated it
        
        return new_id
        
    except Exception as e:
        print(f"    ❌ Error managing name ID for '{name_string}': {str(e)}")
        return 0

# Function to download and process player image
async def download_player_image(url: str, project_name: str, player_id: str) -> bool:
    """
    Downloads player image from URL and saves it to project folder.
    
    Args:
        url: URL of the player image
        project_name: Name of the project
        player_id: Player ID (will be saved as p{player_id}.png)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create path to heads folder
        heads_dir = Path("projects") / project_name / "images" / "heads"
        
        # Create folder if it doesn't exist
        heads_dir.mkdir(parents=True, exist_ok=True)
        
        # Filename format: p{player_id}.png
        filename = f"p{player_id}.png"
        file_path = heads_dir / filename
        
        # Download image asynchronously
        response = await asyncio.to_thread(requests.get, url, timeout=30)
        response.raise_for_status()
        
        # Process image
        image_bytes = BytesIO(response.content)
        image = await asyncio.to_thread(Image.open, image_bytes)
        
        # Reduce size by 10%
        reduced_width = int(image.width * 1.2)
        reduced_height = int(image.height * 1.2)
        image = await asyncio.to_thread(image.resize, (reduced_width, reduced_height), Image.LANCZOS)
        
        # Create new transparent 180x180 image
        final_image = Image.new('RGBA', (180, 180), (255, 255, 255, 0))
        
        # Calculate offsets for centering horizontally and aligning to bottom
        insert_x = (180 - reduced_width) // 2
        insert_y = 180 - reduced_height
        
        # Paste resized image
        final_image.paste(image, (insert_x, insert_y))
        
        # Save image
        await asyncio.to_thread(final_image.save, file_path)
        
        print(f"    ✅ Player image {filename} successfully downloaded and saved")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"    ❌ Error downloading image from {url}: {str(e)}")
        return False
    except (IOError, OSError) as e:
        print(f"    ❌ Error processing or saving image p{player_id}.png: {str(e)}")
        return False
    except Exception as e:
        print(f"    ❌ Unexpected error with image p{player_id}.png: {str(e)}")
        return False

# Load position mapping
_position_map = None
def get_position_map():
    global _position_map
    if _position_map is None:
        try:
            _position_map = load_json_file('../db/db_positions.json')
        except:
            _position_map = {}
    return _position_map


def get_cached_players(file_path: str):
    """Get players from cache or load from file"""
    if file_path not in _players_cache:
        _players_cache[file_path] = load_json_file(file_path)
    return _players_cache[file_path]

def get_cached_teamplayerlinks(file_path: str):
    """Get teamplayerlinks from cache or load from file"""
    if file_path not in _teamplayerlinks_cache:
        _teamplayerlinks_cache[file_path] = load_json_file(file_path)
    return _teamplayerlinks_cache[file_path]

@router.get("/players", tags=["players"])
async def get_players(
    project_id: str = Query(None, description="Project ID to load players from"),
    team_id: str = Query(None, description="Filter players by team ID"),
    limit: Optional[int] = Query(None, description="Number of players to return (optional)", ge=1, le=500)
):
    """Get players data with optional filtering and limits"""
    
    # Determine file paths
    if project_id:
        try:
            players_file = f'../projects/{project_id}/data/fifa_ng_db/players.json'
            teamplayerlinks_file = f'../projects/{project_id}/data/fifa_ng_db/teamplayerlinks.json'
        except:
            players_file = '../fc25/data/fifa_ng_db/players.json'
            teamplayerlinks_file = '../fc25/data/fifa_ng_db/teamplayerlinks.json'
    else:
        players_file = '../fc25/data/fifa_ng_db/players.json'
        teamplayerlinks_file = '../fc25/data/fifa_ng_db/teamplayerlinks.json'
    
    try:
        # If filtering by team_id, use teamplayerlinks to get player IDs first
        if team_id:
            try:
                teamplayerlinks = get_cached_teamplayerlinks(teamplayerlinks_file)
                # Get player IDs for this team
                team_player_ids = [link['playerid'] for link in teamplayerlinks if link['teamid'] == team_id]
                
                if not team_player_ids:
                    return []
                
                # Apply limit only if specified
                if limit is not None:
                    team_player_ids = team_player_ids[:limit]
                
                # Load players and filter only needed ones
                all_players = get_cached_players(players_file)
                team_players = [player for player in all_players if player['playerid'] in team_player_ids]
                
                return team_players
                
            except Exception as e:
                print(f"[WARNING] Could not use teamplayerlinks optimization: {e}")
                # Fallback to loading all players and filtering
                all_players = get_cached_players(players_file)
                filtered_players = [player for player in all_players if player.get('teamid') == team_id]
                return filtered_players[:limit] if limit is not None else filtered_players
        else:
            # No team filter - return all players or limited number
            all_players = get_cached_players(players_file)
            return all_players[:limit] if limit is not None else all_players
            
    except HTTPException as e:
        if project_id and e.status_code == 404:
            print(f"[WARNING] Project players not found, falling back to default")
            # Retry with default files
            return await get_players(None, team_id, limit)
        raise e

@router.delete("/players/cache", tags=["players"])
async def clear_players_cache():
    """Clear players cache (useful for development)"""
    global _players_cache, _teamplayerlinks_cache
    _players_cache.clear()
    _teamplayerlinks_cache.clear()
    return {"message": "Players cache cleared successfully"}

@router.get("/players/lazy", tags=["players"])
async def get_players_lazy(
    project_id: str = Query(None, description="Project ID to load players from"),
    batch_size: int = Query(1000, description="Batch size for lazy loading", ge=100, le=2000),
    team_id: str = Query(None, description="Filter players by team ID")
):
    """Get all players data with lazy loading and WebSocket progress updates"""
    
    function_name = "load_players_lazy"
    
    # Determine file paths
    if project_id:
        try:
            players_file = f'../projects/{project_id}/data/fifa_ng_db/players.json'
            teamplayerlinks_file = f'../projects/{project_id}/data/fifa_ng_db/teamplayerlinks.json'
        except:
            players_file = '../fc25/data/fifa_ng_db/players.json'
            teamplayerlinks_file = '../fc25/data/fifa_ng_db/teamplayerlinks.json'
    else:
        players_file = '../fc25/data/fifa_ng_db/players.json'
        teamplayerlinks_file = '../fc25/data/fifa_ng_db/teamplayerlinks.json'
    
    try:
        # Send initial progress
        send_progress_sync({
            "type": "progress",
            "current": 0,
            "total": 100,  # Will update when we know actual count
            "status": "starting",
            "percentage": 0,
            "message": "Loading players data...",
            "function_name": function_name
        })
        
        # Load all players first
        all_players = get_cached_players(players_file)
        total_players = len(all_players)
        
        # If filtering by team_id, get player IDs first
        if team_id:
            try:
                teamplayerlinks = get_cached_teamplayerlinks(teamplayerlinks_file)
                team_player_ids = set(link['playerid'] for link in teamplayerlinks if link['teamid'] == team_id)
                
                if not team_player_ids:
                    send_progress_sync({
                        "type": "progress",
                        "current": 0,
                        "total": 0,
                        "status": "completed",
                        "percentage": 100,
                        "message": "No players found for this team",
                        "function_name": function_name
                    })
                    return []
                
                # Filter players for this team
                filtered_players = [player for player in all_players if player['playerid'] in team_player_ids]
                all_players = filtered_players
                total_players = len(all_players)
                
            except Exception as e:
                print(f"[WARNING] Could not use teamplayerlinks optimization: {e}")
        
        # Update total count
        send_progress_sync({
            "type": "progress",
            "current": 0,
            "total": total_players,
            "status": "processing",
            "percentage": 0,
            "message": f"Processing {total_players} players...",
            "function_name": function_name
        })
        
        # Process players in batches
        processed_players = []
        start_time = time.time()
        
        for i in range(0, total_players, batch_size):
            batch_end = min(i + batch_size, total_players)
            batch = all_players[i:batch_end]
            
            # Add batch to results
            processed_players.extend(batch)
            
            # Calculate progress
            current_count = len(processed_players)
            percentage = round((current_count / total_players) * 100, 1)
            elapsed_time = time.time() - start_time
            
            # Estimate remaining time
            if current_count > 0:
                avg_time_per_player = elapsed_time / current_count
                remaining_players = total_players - current_count
                estimated_remaining_seconds = remaining_players * avg_time_per_player
                estimated_remaining_str = f"{int(estimated_remaining_seconds // 60)}m {int(estimated_remaining_seconds % 60)}s"
            else:
                estimated_remaining_str = "Calculating..."
            
            # Send progress update
            send_progress_sync({
                "type": "progress",
                "current": current_count,
                "total": total_players,
                "status": "processing",
                "percentage": percentage,
                "message": f"Loaded {current_count} of {total_players} players",
                "batch_start": i,
                "batch_end": batch_end,
                "batch_size": len(batch),
                "estimated_time_remaining": estimated_remaining_str,
                "elapsed_time": f"{int(elapsed_time // 60)}m {int(elapsed_time % 60)}s",
                "function_name": function_name
            })
            
            # Small delay to prevent overwhelming the WebSocket
            await asyncio.sleep(0.05)  # 50ms delay between batches
        
        # Send completion message
        total_elapsed = time.time() - start_time
        send_progress_sync({
            "type": "progress",
            "current": total_players,
            "total": total_players,
            "status": "completed",
            "percentage": 100,
            "message": f"Successfully loaded {total_players} players",
            "total_elapsed_time": f"{int(total_elapsed // 60)}m {int(total_elapsed % 60)}s",
            "function_name": function_name
        })
        
        return processed_players
        
    except HTTPException as e:
        if project_id and e.status_code == 404:
            print(f"[WARNING] Project players not found, falling back to default")
            # Retry with default files
            return await get_players_lazy(None, batch_size, team_id)
        
        # Send error through WebSocket
        send_progress_sync({
            "type": "error",
            "message": f"Failed to load players: {str(e)}",
            "status": "error",
            "function_name": function_name
        })
        raise e
    except Exception as e:
        # Send error through WebSocket
        send_progress_sync({
            "type": "error",
            "message": f"Error loading players: {str(e)}",
            "status": "error",
            "function_name": function_name
        })
        raise HTTPException(status_code=500, detail=str(e))

def get_next_player_id(players_list: List[Dict]) -> str:
    """Generate next player ID based on existing players"""
    if not players_list:
        return "300000"  # Start from 300000 for custom players
    
    # Find the highest player ID
    max_id = 0
    for player in players_list:
        try:
            player_id = int(player.get('playerid', 0))
            if player_id >= 300000:  # Only consider custom player IDs
                max_id = max(max_id, player_id)
        except:
            continue
    
    return str(max_id + 1) if max_id >= 300000 else "300000"

def map_transfermarkt_position_to_fifa(tm_position: str) -> Dict[str, str]:
    """Map Transfermarkt position to FIFA position codes"""
    position_mapping = get_position_map()
    
    # Look up the position in the mapping
    if tm_position in position_mapping:
        # The db_positions.json format is: {"Position": [["Abbreviation", "Code"], ...]}
        positions = position_mapping[tm_position]
        if positions and len(positions) > 0:
            # Use the first mapping's code
            primary_code = positions[0][1] if len(positions[0]) > 1 else "14"
            return {
                "preferredposition1": primary_code,
                "preferredposition2": "-1",
                "preferredposition3": "-1",
                "preferredposition4": "-1"
            }
    
    # Default to CM (14) if position not found
    return {"preferredposition1": "14", "preferredposition2": "-1", "preferredposition3": "-1", "preferredposition4": "-1"}

async def save_players_to_project(project_name: str, players_data: List[Dict[str, Any]], team_id: str, team_name: str = "") -> Dict[str, Any]:
    """Save player data to project's players.json file with progress tracking"""
    if not project_name:
        return {"status": "error", "message": "Project name is required"}
    
    players_file_path = f'../projects/{project_name}/data/fifa_ng_db/players.json'
    
    try:
        # Load existing players or create empty list
        try:
            existing_players = load_json_file(players_file_path)
        except:
            existing_players = []
            # Ensure directory exists
            os.makedirs(os.path.dirname(players_file_path), exist_ok=True)
        
        # Clear cache for this file
        if players_file_path in _players_cache:
            del _players_cache[players_file_path]
        
        added_players_details = [] # To store details needed for teamplayerlinks
        players_processing_progress = {}
        
        # Send initial progress
        send_progress_sync({
            "type": "progress",
            "function_name": "add_teams",
            "operation": "add_teams",
            "current_team": team_name,
            "message": f"Starting to process {len(players_data)} players for {team_name}",
            "players_processing_progress": players_processing_progress
        })
        
        all_created_player_objects = [] # To update existing_players list before saving

        for i, tm_player in enumerate(players_data):
            player_name = tm_player.get('player_name', f'Player {i+1}')
            player_number = tm_player.get('player_number', str(i + 1))
            player_key = f"{player_number}-{player_name}"
            
            players_processing_progress[player_key] = {
                "status": "processing",
                "progress": 0,
                "message": "Generating player attributes..."
            }
            
            send_progress_sync({
                "type": "progress",
                "function_name": "add_teams",
                "operation": "add_teams",
                "current_team": team_name,
                "current_processing_player": player_key,
                "message": f"Saving player {i+1}/{len(players_data)}: {player_name}",
                "players_processing_progress": players_processing_progress,
                "player_index": i,
                "total_players": len(players_data)
            })
            
            await asyncio.sleep(0.1)
            
            new_player_id = get_next_player_id(existing_players + all_created_player_objects)
            
            players_processing_progress[player_key]["progress"] = 20
            players_processing_progress[player_key]["message"] = "Mapping position..."
            
            position_data = map_transfermarkt_position_to_fifa(tm_player.get('player_position', 'CM'))
            
            age = random.randint(18, 35)
            birth_year = datetime.now().year - age
            birthdate = f"{random.randint(1, 365)}{birth_year % 100:02d}" 
            
            is_goalkeeper = position_data["preferredposition1"] == "0"
            
            players_processing_progress[player_key]["progress"] = 40
            players_processing_progress[player_key]["message"] = "Generating physical attributes..."
            
            send_progress_sync({
                "type": "progress",
                "function_name": "add_teams",
                "operation": "add_teams",
                "current_team": team_name,
                "current_processing_player": player_key,
                "players_processing_progress": players_processing_progress,
                "player_index": i,
                "total_players": len(players_data)
            })
            
            player_full_name = tm_player.get('player_name', f'Player {i+1}')
            name_parts = player_full_name.split(' ', 1)
            first_name = name_parts[0] if len(name_parts) > 0 else player_full_name
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            
            players_processing_progress[player_key]["progress"] = 60
            players_processing_progress[player_key]["message"] = "Processing player names..."
            
            # Generate name IDs
            firstname_id = await get_or_create_nameid(project_name, first_name)
            lastname_id = await get_or_create_nameid(project_name, last_name)
            # For commonname, use lastname_id (don't create separate record for full name)
            commonname_id = lastname_id if lastname_id != 0 else firstname_id
            # Jersey name typically uses last name
            jerseyname_id = lastname_id if lastname_id != 0 else firstname_id
            
            players_processing_progress[player_key]["progress"] = 70
            players_processing_progress[player_key]["message"] = "Calculating skill attributes..."
            
            # Generate target overall rating for player
            overall_rating = random.randint(60, 75)
            potential_rating = random.randint(overall_rating + 5, 85)
            
            # Use our calculation model to generate attributes based on position and overall rating
            calculated_attributes = generate_player_attributes(
                preferred_position=position_data["preferredposition1"],
                target_overall=overall_rating,
                international_reputation=random.randint(1, 3)
            )
            
            # Create base player data with calculated attributes
            player_data = {
                # Physical appearance attributes
                "haircolorcode": str(random.randint(1, 10)),
                "facialhairtypecode": str(random.randint(0, 300)),
                "hairtypecode": str(random.randint(1, 1100)),
                "hairstylecode": "0",
                "headtypecode": str(random.randint(1, 30)),
                "headassetid": new_player_id,
                "skintonecode": str(random.randint(1, 10)),
                "skintypecode": "0",
                "eyecolorcode": str(random.randint(1, 5)),
                "eyebrowcode": str(random.randint(60000, 70000)),
                "eyedetail": str(random.randint(1, 3)),
                "lipcolor": "0",
                "skinmakeup": "0",
                "skinsurfacepack": "223101",
                "skincomplexion": str(random.randint(1, 3)),
                "headclasscode": str(random.randint(0, 2)),
                "headvariation": "0",
                "bodytypecode": str(random.randint(1, 8)),
                "muscularitycode": "0",
                "faceposerpreset": str(random.randint(0, 10)),
                "emotion": str(random.randint(1, 5)),
                "height": str(random.randint(165, 195) if not is_goalkeeper else random.randint(180, 200)),
                "weight": str(random.randint(60, 90) if not is_goalkeeper else random.randint(70, 95)),
                
                # Basic player information
                "birthdate": birthdate,
                "playerid": new_player_id,
                "firstnameid": str(firstname_id),
                "lastnameid": str(lastname_id),
                "commonnameid": str(commonname_id),
                "playerjerseynameid": str(jerseyname_id),
                "contractvaliduntil": str(datetime.now().year + random.randint(1, 5)),
                "playerjointeamdate": f"{random.randint(1, 365)}{(datetime.now().year - random.randint(0, 5)) % 100:02d}",
                "nationality": get_nationality_map().get(tm_player.get('player_nationality', 'England'), "21"),
                
                # Position data (will be updated from calculated_attributes)
                **position_data,
                
                # Overall ratings (will be updated from calculated_attributes)
                "overallrating": str(calculated_attributes.get('overall_rating', overall_rating)),
                "potential": str(potential_rating),
                
                # All skill attributes from our calculation model (convert to strings as expected by FIFA)
                "acceleration": str(calculated_attributes.get('acceleration', 50)),
                "sprintspeed": str(calculated_attributes.get('sprintSpeed', 50)),
                "agility": str(calculated_attributes.get('agility', 50)),
                "balance": str(calculate_balance(
                    position_data["preferredposition1"],
                    calculated_attributes.get('agility', 50),
                    calculated_attributes.get('strength', 50),
                    calculated_attributes.get('dribbling', 50),
                    calculated_attributes.get('ballControl', 50),
                    calculated_attributes.get('overall_rating', overall_rating)
                )),
                "stamina": str(calculated_attributes.get('stamina', 50)),
                "strength": str(calculated_attributes.get('strength', 50)),
                "jumping": str(calculated_attributes.get('jumping', 50)),
                "crossing": str(calculated_attributes.get('crossing', 50)),
                "finishing": str(calculated_attributes.get('finishing', 50)),
                "headingaccuracy": str(calculated_attributes.get('heading', 50)),
                "shortpassing": str(calculated_attributes.get('shortPassing', 50)),
                "volleys": str(calculated_attributes.get('volleys', 50)),
                "dribbling": str(calculated_attributes.get('dribbling', 50)),
                "curve": str(calculated_attributes.get('curve', 50)),
                "freekickaccuracy": str(calculated_attributes.get('fkAccuracy', 50)),
                "longpassing": str(calculated_attributes.get('longPassing', 50)),
                "ballcontrol": str(calculated_attributes.get('ballControl', 50)),
                "shotpower": str(calculated_attributes.get('shotPower', 50)),
                "longshots": str(calculated_attributes.get('longShots', 50)),
                "interceptions": str(calculated_attributes.get('interceptions', 50)),
                "positioning": str(calculated_attributes.get('positioning', 50)),
                "vision": str(calculated_attributes.get('vision', 50)),
                "penalties": str(calculated_attributes.get('penalties', 50)),
                "composure": str(calculated_attributes.get('composure', 50)),
                "defensiveawareness": str(calculated_attributes.get('marking', 50)),
                "standingtackle": str(calculated_attributes.get('standingTackle', 50)),
                "slidingtackle": str(calculated_attributes.get('slidingTackle', 50)),
                "aggression": str(calculated_attributes.get('aggression', 50)),
                "reactions": str(calculated_attributes.get('reactions', 50)),
                
                # Goalkeeper attributes
                "gkdiving": str(calculated_attributes.get('gkDiving', 10)),
                "gkhandling": str(calculated_attributes.get('gkHandling', 10)),
                "gkkicking": str(calculated_attributes.get('gkKicking', 10)),
                "gkpositioning": str(calculated_attributes.get('gkPositioning', 10)),
                "gkreflexes": str(calculated_attributes.get('gkReflexes', 10)),
                
                # Calculated composite attributes
                "pacdiv": str((calculated_attributes.get('acceleration', 50) + calculated_attributes.get('sprintSpeed', 50)) // 2),
                "shohan": str((calculated_attributes.get('finishing', 50) + calculated_attributes.get('shotPower', 50)) // 2),
                "paskic": str((calculated_attributes.get('shortPassing', 50) + calculated_attributes.get('longPassing', 50)) // 2),
                "driref": str((calculated_attributes.get('dribbling', 50) + calculated_attributes.get('ballControl', 50)) // 2),
                "defspe": str((calculated_attributes.get('marking', 50) + calculated_attributes.get('standingTackle', 50)) // 2),
                "phypos": str((calculated_attributes.get('strength', 50) + calculated_attributes.get('positioning', 50)) // 2),
                
                # Player traits and preferences
                "trait1": str(random.choice([0, 1024, 2048, 4096, 8192])),
                "trait2": "0",
                "icontrait1": "0",
                "icontrait2": "0",
                "skillmoves": str(random.randint(1, 2) if is_goalkeeper else random.randint(1, 4)),
                "weakfootabilitytypecode": str(random.randint(2, 4)),
                "skillmoveslikelihood": "1",
                "preferredfoot": str(random.randint(1, 2)),
                
                # Kit and appearance
                "jerseyfit": "0",
                "jerseystylecode": str(random.randint(0, 1)),
                "jerseysleevelengthcode": "0",
                "shortstyle": "0",
                "undershortstyle": "0",
                "socklengthcode": str(random.randint(0, 2)),
                "shoetypecode": str(random.randint(1, 500)),
                "shoecolorcode1": str(random.randint(1, 50)),
                "shoecolorcode2": str(random.randint(1, 50)),
                "shoedesigncode": "0",
                "gkglovetypecode": str(random.randint(1, 10) if is_goalkeeper else "0"),
                
                # Animation codes
                "gksavetype": "0",
                "gkkickstyle": "0",
                "runstylecode": "0",
                "runningcode1": "0",
                "runningcode2": "0",
                "finishingcode1": "0",
                "finishingcode2": "0",
                "animfreekickstartposcode": "0",
                "animpenaltiesstartposcode": "0",
                
                # Accessories and tattoos
                "accessorycode1": "0",
                "accessorycode2": "0", 
                "accessorycode3": "0",
                "accessorycode4": "0",
                "accessorycolourcode1": "0",
                "accessorycolourcode2": "0",
                "accessorycolourcode3": "0",
                "accessorycolourcode4": "0",
                "tattoohead": "0",
                "tattooleftarm": "0",
                "tattoorightarm": "0",
                "tattooleftleg": "0",
                "tattoorightleg": "0",
                "tattooback": "0",
                "tattoofront": "0",
                "sideburnscode": "0",
                "facialhaircolorcode": str(random.randint(1, 10)),
                
                # Misc attributes
                "modifier": "0",
                "gender": "0",
                "hashighqualityhead": "0",
                "hasseasonaljersey": "0",
                "personality": str(random.randint(1, 5)),
                "isretiring": "0",
                "iscustomized": "0",
                "usercaneditname": "0",
                "avatarpomid": "0",
                "internationalrep": str(calculated_attributes.get('international_reputation', 1)),
                "role1": str(random.randint(1, 50)),
                "role2": str(random.randint(1, 50)),
                "role3": str(random.randint(1, 50)),
                "smallsidedshoetypecode": str(random.randint(400, 600)),
            }
            
            # Update the actual overall rating from our calculation
            overall_rating = calculated_attributes.get('overall_rating', overall_rating)
            
            
            players_processing_progress[player_key]["progress"] = 75
            players_processing_progress[player_key]["message"] = "Preparing player data..."
            players_processing_progress[player_key]["overall_rating"] = overall_rating
            players_processing_progress[player_key]["potential"] = potential_rating
            players_processing_progress[player_key]["position"] = tm_player.get('player_position', 'CM')
            
            send_progress_sync({
                "type": "progress",
                "function_name": "add_teams",
                "operation": "add_teams",
                "current_team": team_name,
                "current_processing_player": player_key,
                "current_player": player_name,
                "player_index": i,
                "total_players": len(players_data),
                "player_overall_rating": overall_rating,
                "player_potential": potential_rating,
                "player_position": tm_player.get('player_position', 'CM'),
                "players_processing_progress": players_processing_progress
            })
            
            added_players_details.append({
                "playerid": new_player_id,
                "jerseynumber": player_number, 
                "position_code": position_data["preferredposition1"]
            })
            
            # Download player photo if URL is available
            player_photo_url = tm_player.get('player_photo_url', '')
            if player_photo_url and player_photo_url != 'N/A':
                players_processing_progress[player_key]["progress"] = 80
                players_processing_progress[player_key]["message"] = "Downloading player photo..."
                
                send_progress_sync({
                    "type": "progress",
                    "function_name": "add_teams",
                    "operation": "add_teams",
                    "current_team": team_name,
                    "current_processing_player": player_key,
                    "current_player": player_name,
                    "message": f"Downloading photo for {player_name}",
                    "players_processing_progress": players_processing_progress
                })
                
                try:
                    photo_success = await download_player_image(player_photo_url, project_name, str(new_player_id))
                    if photo_success:
                        print(f"        📷 Successfully downloaded photo for {player_name} (ID: {new_player_id})")
                        
                        # Now apply ML predictions after successful photo download
                        players_processing_progress[player_key]["progress"] = 85
                        players_processing_progress[player_key]["message"] = "Applying ML predictions..."
                        
                        send_progress_sync({
                            "type": "progress",
                            "function_name": "add_teams",
                            "operation": "add_teams",
                            "current_team": team_name,
                            "current_processing_player": player_key,
                            "current_player": player_name,
                            "message": f"Analyzing photo for {player_name} with AI...",
                            "players_processing_progress": players_processing_progress
                        })
                        
                        # Check if downloaded image exists and apply ML
                        heads_dir = Path("projects") / project_name / "images" / "heads"
                        image_path = heads_dir / f"p{new_player_id}.png"
                        
                        if image_path.exists():
                            try:
                                # Use ML to enhance player data
                                enhanced_player_data = await enhance_player_data_with_predictions(
                                    player_data, 
                                    str(image_path)
                                )
                                player_data = enhanced_player_data
                            except Exception as e:
                                print(f"        ❌ ML предсказание не удалось для {player_name}: {str(e)}")
                        
                    else:
                        print(f"        ⚠️ Failed to download photo for {player_name}")
                except Exception as e:
                    print(f"        ❌ Error downloading photo for {player_name}: {str(e)}")
            
            # IMPORTANT: Add player_data to list AFTER potential ML enhancement
            all_created_player_objects.append(player_data)
            
            players_processing_progress[player_key]["progress"] = 100
            players_processing_progress[player_key]["status"] = "completed"
            players_processing_progress[player_key]["message"] = f"Player saved (OVR: {overall_rating})"
            
            send_progress_sync({
                "type": "progress",
                "function_name": "add_teams",
                "operation": "add_teams",
                "current_team": team_name,
                "current_processing_player": player_key,
                "current_player": player_name,
                "player_index": i,
                "total_players": len(players_data),
                "player_overall_rating": overall_rating,
                "player_potential": potential_rating,
                "player_position": tm_player.get('player_position', 'CM'),
                "player_status": "saved",
                "players_processing_progress": players_processing_progress
            })
            
            await asyncio.sleep(0.05)
        
        # Add all newly created players to the existing (or new) list
        existing_players.extend(all_created_player_objects)
        await asyncio.to_thread(save_json_file, players_file_path, existing_players)
        
        # Note: Player names are now automatically saved during name ID generation
        print(f"        📋 Player names processed and saved automatically during ID generation")
        
        if added_players_details:
            links_result = await save_tpl_extended(project_name, team_id, added_players_details)
            print(f"        📋 Team-player links save result (extended): {links_result}")
        
        send_progress_sync({
            "type": "progress",
            "function_name": "add_teams",
            "operation": "add_teams",
            "current_team": team_name,
            "message": f"All {len(all_created_player_objects)} players saved successfully",
            "players_processing_progress": players_processing_progress
        })
        
        player_ids_list = [p["playerid"] for p in all_created_player_objects]
        print(f"        ✅ Returning {len(player_ids_list)} player IDs")
        if player_ids_list:
            print(f"        🆔 First 3 player IDs: {player_ids_list[:3]}")
        
        return {
            "status": "success",
            "message": f"Successfully saved {len(all_created_player_objects)} players",
            "added_count": len(all_created_player_objects),
            "player_ids": player_ids_list
        }
        
    except Exception as e:
        # Ensure to log the error in detail or handle it appropriately
        print(f"[CRITICAL ERROR] save_players_to_project for team {team_name} ({team_id}) failed: {str(e)}")
        import traceback
        traceback.print_exc() # Print full traceback for debugging
        return {
            "status": "error",
            "message": f"Error saving players: {str(e)}",
            "added_count": 0
        }
    
async def save_playernames_to_project(project_name: str, player_names_data: List[Dict[str, str]]) -> Dict[str, Any]:
    """Save player names to project's playernames.json file"""
    if not project_name:
        return {"status": "error", "message": "Project name is required"}
    
    playernames_file_path = f'../projects/{project_name}/data/fifa_ng_db/playernames.json'
    
    try:
        try:
            existing_names = load_json_file(playernames_file_path)
        except:
            existing_names = []
            os.makedirs(os.path.dirname(playernames_file_path), exist_ok=True)
        
        added_names_count = 0
        # Use a set for efficient lookup of existing name IDs
        existing_name_ids = {n["nameid"] for n in existing_names if "nameid" in n}

        for name_data in player_names_data:
            name_id = name_data["nameid"]
            if name_id not in existing_name_ids:
                name_entry = {
                    "nameid": name_id,
                    "commentaryid": str(900000 + int(name_id)),
                    "name": name_data["name"]
                }
                existing_names.append(name_entry)
                existing_name_ids.add(name_id) # Add to set to prevent duplicates in the same batch
                added_names_count +=1
        
        await asyncio.to_thread(save_json_file, playernames_file_path, existing_names)
        
        return {
            "status": "success",
            "message": f"Successfully saved {added_names_count} player names",
            "added_count": added_names_count
        }
        
    except Exception as e:
        print(f"[ERROR] Error saving player names: {str(e)}")
        return {
            "status": "error",
            "message": f"Error saving player names: {str(e)}",
            "added_count": 0
        }

@router.post("/players/process-team-players", tags=["players"])
async def process_team_players(
    project_id: str,
    team_id: str,
    team_name: str,
    players_data: List[Dict[str, Any]]
):
    """Process and save team players with individual progress tracking"""
    try:
        result = await save_players_to_project(project_id, players_data, team_id, team_name)
        return result
    except Exception as e:
        # Log the exception for server-side debugging
        print(f"[CRITICAL ERROR] process_team_players endpoint for team {team_name} ({team_id}) failed: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return a generic error to the client
        raise HTTPException(status_code=500, detail=f"Internal server error processing team players: {str(e)}")
