from fastapi import APIRouter, Query, HTTPException, Path, Body, Depends
from .utils import load_json_file, save_json_file
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Tuple
from collections import OrderedDict
import os
import json
import logging

router = APIRouter()

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Constants ---
BASE_PROJECTS_DIR = "projects"
DATA_SUBDIR = os.path.join('data', 'fifa_ng_db')

# --- Pydantic Models ---

class PlayerInput(BaseModel):
    playerid: str
    overallrating: int
    preferredposition1: Optional[int] = -1

class FormationTacticInput(BaseModel):
    tactic: str = '4-4-2'

class TeamSheetInput(BaseModel):
    players: List[PlayerInput] = []
    tactic: str = '4-4-2'

class MentalitiesInput(BaseModel):
    players: List[PlayerInput] = []
    tactic: str = '4-4-2'

# --- Formation Templates ---

FORMATION_442 = OrderedDict([
    ("offset6x", "0.65"), ("offset5y", "0.5875"), ("pos0role", "4161"),
    ("position10", "26"), ("offset10x", "0.39"), ("offset2x", "0.7125"),
    ("defenders", "4"), ("pos6role", "21314"), ("formationname", "4-4-2"),
    ("offset2y", "0.175"), ("position6", "13"), ("offensiverating", "2"),
    ("offset6y", "0.5125"), ("position8", "16"), ("pos8role", "25794"),
    ("offset7x", "0.35"), ("pos4role", "8450"), ("offset3x", "0.2875"),
    ("pos7role", "21314"), ("offset8x", "0.075"), ("offset10y", "0.875"),
    ("offset3y", "0.175"), ("pos2role", "12737"), ("pos1role", "8513"),
    ("pos10role", "38275"), ("offset4x", "0.075"), ("position5", "12"),
    ("offset7y", "0.5125"), ("formationaudioid", "10"), ("offset0x", "0.5"),
    ("offset8y", "0.5875"), ("pos3role", "12737"), ("attackers", "2"),
    ("offset9x", "0.6"), ("teamid", ""), ("position2", "4"),
    ("midfielders", "4"), ("formationid", "617"), ("offset5x", "0.925"),
    ("pos9role", "38405"), ("offset0y", "0.0175"), ("pos5role", "25602"),
    ("relativeformationid", "16"), ("offset1x", "0.925"), ("position4", "7"),
    ("offset4y", "0.2"), ("offset9y", "0.875"), ("position3", "6"),
    ("formationfullnameid", "11"), ("offset1y", "0.2"), ("position0", "0"),
    ("position9", "24"), ("position7", "15"), ("position1", "3")
])

TEAMDATA_442 = OrderedDict([
    ("offset6x", "0.65"), ("offset5y", "0.5875"), ("position10", "26"),
    ("offset10x", "0.39"), ("offset2x", "0.7125"), ("defensivedepth", "50"),
    ("offset2y", "0.1543"), ("position6", "13"), ("offset6y", "0.5125"),
    ("position8", "16"), ("offset7x", "0.35"), ("offset3x", "0.2875"),
    ("offset8x", "0.075"), ("offset10y", "0.875"), ("offset3y", "0.1535"),
    ("offset4x", "0.075"), ("position5", "12"), ("offset7y", "0.5125"),
    ("offset0x", "0.497"), ("offset8y", "0.5875"), ("offset9x", "0.6"),
    ("teamid", ""), ("position2", "4"), ("offset5x", "0.925"),
    ("offset0y", "0.015"), ("offset1x", "0.925"), ("position4", "7"),
    ("offset4y", "0.2"), ("offset9y", "0.875"), ("position3", "6"),
    ("formationfullnameid", "11"), ("offset1y", "0.2"), ("position0", "0"),
    ("position9", "24"), ("position7", "15"), ("position1", "3")
])

TEAMSHEET_BASE = OrderedDict([
    ("playerid35", "-1"), ("playerid0", "-1"), ("playerid9", "-1"),
    ("customsub0in", "-1"), ("playerid36", "-1"), ("rightfreekicktakerid", "-1"),
    ("playerid44", "-1"), ("playerid27", "-1"), ("playerid1", "-1"),
    ("playerid38", "-1"), ("playerid31", "-1"), ("playerid7", "-1"),
    ("playerid20", "-1"), ("playerid39", "-1"), ("playerid42", "-1"),
    ("playerid48", "-1"), ("playerid13", "-1"), ("playerid6", "-1"),
    ("customsub0out", "-1"), ("playerid37", "-1"), ("playerid5", "-1"),
    ("playerid45", "-1"), ("playerid8", "-1"), ("playerid14", "-1"),
    ("playerid46", "-1"), ("longkicktakerid", "-1"), ("playerid12", "-1"),
    ("playerid2", "-1"), ("rightcornerkicktakerid", "-1"), ("playerid30", "-1"),
    ("customsub1in", "-1"), ("playerid15", "-1"), ("playerid41", "-1"),
    ("playerid47", "-1"), ("playerid23", "-1"), ("playerid16", "-1"),
    ("customsub1out", "-1"), ("leftcornerkicktakerid", "-1"), ("playerid18", "-1"),
    ("playerid4", "-1"), ("playerid40", "-1"), ("playerid49", "-1"),
    ("customsub2out", "-1"), ("teamid", ""), ("playerid22", "-1"),
    ("playerid24", "-1"), ("playerid11", "-1"), ("customsub2in", "-1"),
    ("playerid3", "-1"), ("captainid", "-1"), ("playerid51", "-1"),
    ("leftfreekicktakerid", "-1"), ("playerid25", "-1"), ("playerid33", "-1"),
    ("playerid19", "-1"), ("playerid17", "-1"), ("playerid26", "-1"),
    ("playerid50", "-1"), ("playerid34", "-1"), ("penaltytakerid", "-1"),
    ("playerid32", "-1"), ("freekicktakerid", "-1"), ("playerid28", "-1"),
    ("playerid21", "-1"), ("playerid10", "-1"), ("playerid43", "-1"),
    ("playerid29", "-1")
])

MENTALITY_ACTIVE_442 = OrderedDict([
    ("offset6x", "0.65"), ("tactic_name", ""), ("offset5y", "0.5875"),
    ("pos0role", "4161"), ("playerid0", "-1"), ("playerid9", "-1"),
    ("position10", "26"), ("offset10x", "0.39"), ("offset2x", "0.7125"),
    ("pos6role", "21314"), ("defensivedepth", "50"), ("offset2y", "0.1543"),
    ("playerid1", "-1"), ("position6", "13"), ("playerid7", "-1"),
    ("offset6y", "0.5125"), ("position8", "16"), ("pos8role", "25794"),
    ("offset7x", "0.35"), ("pos4role", "8450"), ("playerid6", "-1"),
    ("buildupplay", "3"), ("playerid5", "-1"), ("offset3x", "0.2875"),
    ("pos7role", "21314"), ("sourceformationid", "0"), ("offset8x", "0.075"),
    ("offset10y", "0.875"), ("offset3y", "0.1535"), ("playerid8", "-1"),
    ("pos2role", "12737"), ("pos1role", "8513"), ("pos10role", "38275"),
    ("playerid2", "-1"), ("offset4x", "0.075"), ("position5", "12"),
    ("offset7y", "0.5125"), ("formationaudioid", "10"), ("offset0x", "0.497"),
    ("offset8y", "0.5875"), ("pos3role", "12737"), ("offset9x", "0.6"),
    ("playerid4", "-1"), ("teamid", ""), ("position2", "4"),
    ("offset5x", "0.925"), ("pos9role", "38405"), ("playerid3", "-1"),
    ("offset0y", "0.015"), ("pos5role", "25602"), ("offset1x", "0.925"),
    ("position4", "7"), ("offset4y", "0.2"), ("offset9y", "0.875"),
    ("position3", "6"), ("formationfullnameid", "11"), ("mentalityid", ""),
    ("playerid10", "-1"), ("offset1y", "0.2"), ("position0", "0"),
    ("position9", "24"), ("position7", "15"), ("position1", "3")
])

MENTALITY_INACTIVE = OrderedDict([
    ("offset6x", "0"), ("tactic_name", ""), ("offset5y", "0"), ("pos0role", "0"),
    ("playerid0", "-1"), ("playerid9", "-1"), ("position10", "-1"),
    ("offset10x", "0"), ("offset2x", "0"), ("pos6role", "0"),
    ("defensivedepth", "1"), ("offset2y", "0"), ("playerid1", "-1"),
    ("position6", "-1"), ("playerid7", "-1"), ("offset6y", "0"),
    ("position8", "-1"), ("pos8role", "0"), ("offset7x", "0"), ("pos4role", "0"),
    ("playerid6", "-1"), ("buildupplay", "0"), ("playerid5", "-1"),
    ("offset3x", "0"), ("pos7role", "0"), ("sourceformationid", "-1"),
    ("offset8x", "0"), ("offset10y", "0"), ("offset3y", "0"),
    ("playerid8", "-1"), ("pos2role", "0"), ("pos1role", "0"), ("pos10role", "0"),
    ("playerid2", "-1"), ("offset4x", "0"), ("position5", "-1"),
    ("offset7y", "0"), ("formationaudioid", "-1"), ("offset0x", "0"),
    ("offset8y", "0"), ("pos3role", "0"), ("offset9x", "0"), ("playerid4", "-1"),
    ("teamid", "-1"), ("position2", "-1"), ("offset5x", "0"), ("pos9role", "0"),
    ("playerid3", "-1"), ("offset0y", "0"), ("pos5role", "0"), ("offset1x", "0"),
    ("position4", "-1"), ("offset4y", "0"), ("offset9y", "0"),
    ("position3", "-1"), ("formationfullnameid", "-1"), ("mentalityid", ""),
    ("playerid10", "-1"), ("offset1y", "0"), ("position0", "-1"),
    ("position9", "-1"), ("position7", "-1"), ("position1", "-1")
])

# --- Helper Functions ---

def get_project_data_dir(project_name: str) -> str:
    """Constructs the path to the project's data/fifa_ng_db directory."""
    project_dir = os.path.join(BASE_PROJECTS_DIR, project_name)
    if not os.path.isdir(project_dir):
        raise HTTPException(status_code=404, detail=f"Project '{project_name}' not found.")
    data_dir = os.path.join(project_dir, DATA_SUBDIR)
    return data_dir

def read_json_file(file_path: str) -> List[Dict]:
    """Reads a JSON file and returns its content, handling file not found and errors."""
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = json.load(f)
                return content if isinstance(content, list) else []
        except json.JSONDecodeError:
            logger.warning(f"Empty or invalid JSON in {os.path.basename(file_path)}, initializing as empty list.")
            return []
        except Exception as e:
            logger.error(f"Error reading {os.path.basename(file_path)}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Error reading {os.path.basename(file_path)}")
    return []

def write_json_file(file_path: str, data: List[Dict]):
    """Writes data to a JSON file, ensuring the directory exists."""
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error writing to {os.path.basename(file_path)}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error writing to {os.path.basename(file_path)}")

def sort_players(players: List[Dict], positions_needed: Dict[int, int]) -> tuple[Dict[int, Optional[Dict]], Optional[Dict], List[Dict]]:
    """Sorts players according to the specified criteria."""
    if not players:
        return {i: None for i in range(11)}, None, []

    for p in players:
        p['overallrating'] = int(p.get('overallrating', 0))
        p['preferredposition1'] = int(p.get('preferredposition1', -1))

    players_sorted = sorted(players, key=lambda p: -p['overallrating'])
    assigned_players: Dict[int, Optional[Dict]] = {}
    available_players = players_sorted.copy()

    for index in range(11):
        position_id = positions_needed.get(index, -1)
        if position_id == -1:
            assigned_players[index] = None
            continue

        best_match = None
        best_match_rating = -1

        for player in available_players:
            if player['preferredposition1'] == position_id:
                if player['overallrating'] > best_match_rating:
                    best_match = player
                    best_match_rating = player['overallrating']

        if best_match:
            assigned_players[index] = best_match
            available_players.remove(best_match)
        else:
            assigned_players[index] = None

    temp_available = available_players.copy()
    temp_available.sort(key=lambda p: -p['overallrating'])
    for index in range(11):
        if assigned_players.get(index) is None and temp_available:
            player_to_assign = temp_available.pop(0)
            assigned_players[index] = player_to_assign
            if player_to_assign in available_players:
                available_players.remove(player_to_assign)

    goalkeepers = [player for player in available_players if player['preferredposition1'] == 0]
    backup_goalkeeper = None
    if goalkeepers:
        goalkeepers.sort(key=lambda p: -p['overallrating'])
        backup_goalkeeper = goalkeepers[0]
        available_players.remove(backup_goalkeeper)

    remaining_players = sorted(available_players, key=lambda p: -p['overallrating'])
    return assigned_players, backup_goalkeeper, remaining_players

# --- Internal Logic Functions ---

def _add_team_formation(data_dir: str, team_id: str, tactic: str = '4-4-2') -> Dict:
    """Internal logic to add a formation entry to formations.json."""
    formations_file = os.path.join(data_dir, 'formations.json')
    formations = read_json_file(formations_file)

    if any(f.get("teamid") == team_id for f in formations):
        logger.info(f"Formation for team ID '{team_id}' already exists in {formations_file}. Skipping.")
        existing = next((f for f in formations if f.get("teamid") == team_id), None)
        return existing or {"error": "Existing formation found but could not be retrieved"}

    if tactic == '4-4-2':
        new_formation = FORMATION_442.copy()
        new_formation["teamid"] = team_id
    else:
        logger.error(f"Tactic '{tactic}' not recognized for team {team_id}.")
        raise ValueError(f"Tactic '{tactic}' not recognized.")

    formations.append(new_formation)
    try:
        os.makedirs(os.path.dirname(formations_file), exist_ok=True)
        with open(formations_file, 'w', encoding='utf-8') as f:
            json.dump(formations, f, indent=4, ensure_ascii=False)
        logger.info(f"Formation '{tactic}' added successfully for team {team_id}.")
        return new_formation
    except Exception as e:
        logger.error(f"Failed to write formation for team {team_id}: {e}", exc_info=True)
        raise

def _add_default_teamdata(data_dir: str, team_id: str, tactic: str = '4-4-2') -> Dict:
    """Internal logic to add default team data to defaultteamdata.json."""
    defaultteamdata_file = os.path.join(data_dir, 'defaultteamdata.json')
    defaultteamdata = read_json_file(defaultteamdata_file)

    if any(d.get("teamid") == team_id for d in defaultteamdata):
        logger.info(f"Default team data for team ID '{team_id}' already exists in {defaultteamdata_file}. Skipping.")
        existing = next((d for d in defaultteamdata if d.get("teamid") == team_id), None)
        return existing or {"error": "Existing teamdata found but could not be retrieved"}

    if tactic == '4-4-2':
        new_teamdata = TEAMDATA_442.copy()
        new_teamdata["teamid"] = team_id
    else:
        logger.error(f"Tactic '{tactic}' not recognized for team {team_id}.")
        raise ValueError(f"Tactic '{tactic}' not recognized.")

    defaultteamdata.append(new_teamdata)
    try:
        os.makedirs(os.path.dirname(defaultteamdata_file), exist_ok=True)
        with open(defaultteamdata_file, 'w', encoding='utf-8') as f:
            json.dump(defaultteamdata, f, indent=4, ensure_ascii=False)
        logger.info(f"Default team data '{tactic}' added successfully for team {team_id}.")
        return new_teamdata
    except Exception as e:
        logger.error(f"Failed to write teamdata for team {team_id}: {e}", exc_info=True)
        raise

def _add_default_teamsheet(data_dir: str, team_id: str, players: List[Dict] = [], tactic: str = '4-4-2') -> Dict:
    """Internal logic to add a default teamsheet to default_teamsheets.json."""
    default_teamsheets_file = os.path.join(data_dir, 'default_teamsheets.json')
    teamsheets = read_json_file(default_teamsheets_file)
    
    # Debug logging
    if players:
        logger.info(f"_add_default_teamsheet: Received {len(players)} players for team {team_id}")
        logger.info(f"First 3 player IDs: {[p.get('playerid') for p in players[:3]]}")

    if any(ts.get("teamid") == team_id for ts in teamsheets):
        logger.info(f"Default teamsheet for team ID '{team_id}' already exists in {default_teamsheets_file}. Skipping.")
        existing = next((ts for ts in teamsheets if ts.get("teamid") == team_id), None)
        return existing or {"error": "Existing teamsheet found but could not be retrieved"}

    new_teamsheet = TEAMSHEET_BASE.copy()
    new_teamsheet["teamid"] = team_id

    if players:
        if tactic == '4-4-2':
            positions_template = FORMATION_442
        else:
            logger.error(f"Tactic '{tactic}' not recognized for teamsheet generation for team {team_id}.")
            raise ValueError(f"Tactic '{tactic}' not recognized for teamsheet generation.")

        positions_needed: Dict[int, int] = {}
        for key, value in positions_template.items():
            if key.startswith('position') and key[8:].isdigit():
                index = int(key[8:])
                try:
                    positions_needed[index] = int(value)
                except ValueError:
                    positions_needed[index] = -1

        processed_players = [dict(p) for p in players]
        assigned_players, backup_goalkeeper, remaining_players = sort_players(processed_players, positions_needed)

        for index in range(11):
            player_key = f'playerid{index}'
            assigned = assigned_players.get(index)
            if assigned:
                player_id = str(assigned['playerid'])
                new_teamsheet[player_key] = player_id
                if index < 3:  # Log first few assignments
                    logger.info(f"Assigning player ID {player_id} to position {index}")
            else:
                new_teamsheet[player_key] = "-1"

        new_teamsheet['playerid11'] = str(backup_goalkeeper['playerid']) if backup_goalkeeper else "-1"

        for i in range(12, 52):
            player_key = f'playerid{i}'
            player_index_in_remaining = i - 12
            if player_index_in_remaining < len(remaining_players):
                new_teamsheet[player_key] = str(remaining_players[player_index_in_remaining]['playerid'])
            else:
                new_teamsheet[player_key] = "-1"

        starting_players = [p for p in assigned_players.values() if p]
        if starting_players:
            starting_players.sort(key=lambda p: (-int(p['overallrating']), int(p.get('playerid', 0))))
            captain = starting_players[0]
            captain_id = str(captain['playerid'])
            kicker_fields = ['rightfreekicktakerid', 'leftfreekicktakerid', 'rightcornerkicktakerid',
                             'leftcornerkicktakerid', 'penaltytakerid', 'freekicktakerid', 'longkicktakerid', 'captainid']
            for field in kicker_fields:
                if field in new_teamsheet:
                    new_teamsheet[field] = captain_id

    teamsheets.append(new_teamsheet)
    try:
        os.makedirs(os.path.dirname(default_teamsheets_file), exist_ok=True)
        with open(default_teamsheets_file, 'w', encoding='utf-8') as f:
            json.dump(teamsheets, f, indent=4, ensure_ascii=False)
        logger.info(f"Default teamsheet '{tactic}' added successfully for team {team_id}.")
        return new_teamsheet
    except Exception as e:
        logger.error(f"Failed to write teamsheet for team {team_id}: {e}", exc_info=True)
        raise

def _add_default_mentalities(data_dir: str, team_id: str, players: List[Dict] = [], tactic: str = '4-4-2') -> List[Dict]:
    """Internal logic to add default mentality entries to default_mentalities.json."""
    default_mentalities_file = os.path.join(data_dir, 'default_mentalities.json')
    mentalities = read_json_file(default_mentalities_file)

    if any(m.get("teamid") == team_id and m.get("sourceformationid") == "0" for m in mentalities):
        logger.info(f"Default mentalities for team ID '{team_id}' might already exist in {default_mentalities_file}. Skipping.")
        return []

    max_mentality_id = 0
    if mentalities:
        valid_ids = [int(m['mentalityid']) for m in mentalities if m.get('mentalityid', '').isdigit()]
        if valid_ids:
            max_mentality_id = max(valid_ids)
        else:
            max_mentality_id = 414
    else:
        max_mentality_id = 414

    new_mentalities_added = []

    if tactic == '4-4-2':
        active_mentality_template = MENTALITY_ACTIVE_442
    else:
        logger.error(f"Tactic '{tactic}' not recognized for mentality generation for team {team_id}.")
        raise ValueError(f"Tactic '{tactic}' not recognized for mentality generation.")

    positions_needed: Dict[int, int] = {}
    for key, value in active_mentality_template.items():
        if key.startswith('position') and key[8:].isdigit():
            index = int(key[8:])
            try:
                positions_needed[index] = int(value)
            except ValueError:
                positions_needed[index] = -1

    processed_players = [dict(p) for p in players]
    assigned_players, _, _ = sort_players(processed_players, positions_needed) if processed_players else ({}, None, [])

    captain_id = "-1"
    if processed_players:
        starting_players = [p for p in assigned_players.values() if p]
        if starting_players:
            starting_players.sort(key=lambda p: (-int(p['overallrating']), int(p.get('playerid', 0))))
            captain = starting_players[0]
            captain_id = str(captain['playerid'])

    for i in range(5):
        mentalityid = max_mentality_id + 1 + i
        new_mentality: OrderedDict[str, str]

        if i == 2:  # Active mentality
            new_mentality = active_mentality_template.copy()
            new_mentality["teamid"] = team_id
            new_mentality["mentalityid"] = str(mentalityid)
            if processed_players:
                for index in range(11):
                    player_key = f'playerid{index}'
                    assigned = assigned_players.get(index)
                    new_mentality[player_key] = str(assigned['playerid']) if assigned else "-1"
                kicker_fields = ['rightfreekicktakerid', 'leftfreekicktakerid', 'rightcornerkicktakerid',
                                 'leftcornerkicktakerid', 'penaltytakerid', 'freekicktakerid', 'longkicktakerid']
                for field in kicker_fields:
                    if field in new_mentality:
                        new_mentality[field] = captain_id
                if 'captainid' in new_mentality:
                    new_mentality['captainid'] = captain_id
        else:  # Inactive mentalities
            new_mentality = MENTALITY_INACTIVE.copy()
            new_mentality["mentalityid"] = str(mentalityid)

        mentalities.append(new_mentality)
        new_mentalities_added.append(new_mentality)

    try:
        os.makedirs(os.path.dirname(default_mentalities_file), exist_ok=True)
        with open(default_mentalities_file, 'w', encoding='utf-8') as f:
            json.dump(mentalities, f, indent=4, ensure_ascii=False)
        logger.info(f"Default mentalities '{tactic}' added successfully for team {team_id}.")
        return new_mentalities_added
    except Exception as e:
        logger.error(f"Failed to write mentalities for team {team_id}: {e}", exc_info=True)
        raise

def calculate_team_ratings(players: List[Dict]) -> Dict[str, str]:
    """Calculate team ratings based on player ratings."""
    if not players:
        return {
            "overallrating": "65",
            "defenserating": "65",
            "midfieldrating": "65",
            "attackrating": "65",
            "matchdayoverallrating": "65",
            "matchdaydefenserating": "65",
            "matchdaymidfieldrating": "65",
            "matchdayattackrating": "65"
        }
    
    for player in players:
        if 'overallrating' in player:
            player['overallrating'] = int(player.get('overallrating', 65))
        if 'preferredposition1' in player:
            player['preferredposition1'] = int(player.get('preferredposition1', -1))
    
    sorted_players = sorted(players, key=lambda p: -p.get('overallrating', 0))
    
    defenders = []
    midfielders = []
    attackers = []
    
    for player in sorted_players:
        position = player.get('preferredposition1', -1)
        if position == -1:
            continue
        if 0 <= position <= 9:
            defenders.append(player)
        elif 10 <= position <= 19:
            midfielders.append(player)
        elif 20 <= position <= 29:
            attackers.append(player)
    
    top_defenders = defenders[:5]
    top_midfielders = midfielders[:4]
    top_attackers = attackers[:3]
    
    def calculate_avg_rating(player_list: List[Dict]) -> int:
        if not player_list:
            return 65
        return round(sum(p.get('overallrating', 65) for p in player_list) / len(player_list))
    
    defense_rating = calculate_avg_rating(top_defenders) if top_defenders else 65
    midfield_rating = calculate_avg_rating(top_midfielders) if top_midfielders else 65
    attack_rating = calculate_avg_rating(top_attackers) if top_attackers else 65
    
    overall_rating = round(
        (defense_rating * 0.33 + midfield_rating * 0.33 + attack_rating * 0.34)
    )
    
    return {
        "overallrating": str(overall_rating),
        "defenserating": str(defense_rating),
        "midfieldrating": str(midfield_rating),
        "attackrating": str(attack_rating),
        "matchdayoverallrating": str(overall_rating),
        "matchdaydefenserating": str(defense_rating),
        "matchdaymidfieldrating": str(midfield_rating),
        "matchdayattackrating": str(attack_rating)
    }

# --- API Endpoints ---

@router.post("/formations/{project_name}/{team_id}/formation", tags=["tactics"])
async def add_team_formation_endpoint(
    project_name: str = Path(..., description="The name of the project"),
    team_id: str = Path(..., description="The ID of the team"),
    tactic_input: FormationTacticInput = Body(FormationTacticInput())
) -> Dict:
    """API Endpoint: Adds a formation entry based on the tactic."""
    data_dir = get_project_data_dir(project_name)
    try:
        result = _add_team_formation(data_dir, team_id, tactic_input.tactic)
        if "error" in result:
            return {"message": f"Formation for team {team_id} already exists.", "formation": result}
        return {"message": f"Formation '{tactic_input.tactic}' added successfully for team {team_id}", "formation": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"API Error adding formation for {team_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add formation: {e}")

@router.post("/formations/{project_name}/{team_id}/teamdata", tags=["tactics"])
async def add_default_teamdata_endpoint(
    project_name: str = Path(..., description="The name of the project"),
    team_id: str = Path(..., description="The ID of the team"),
    tactic_input: FormationTacticInput = Body(FormationTacticInput())
) -> Dict:
    """API Endpoint: Adds default team data."""
    data_dir = get_project_data_dir(project_name)
    try:
        result = _add_default_teamdata(data_dir, team_id, tactic_input.tactic)
        if "error" in result:
             return {"message": f"Default team data for team {team_id} already exists.", "teamdata": result}
        return {"message": f"Default team data '{tactic_input.tactic}' added successfully for team {team_id}", "teamdata": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"API Error adding teamdata for {team_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add teamdata: {e}")

@router.post("/formations/{project_name}/{team_id}/teamsheet", tags=["tactics"])
async def add_default_teamsheet_endpoint(
    project_name: str = Path(..., description="The name of the project"),
    team_id: str = Path(..., description="The ID of the team"),
    teamsheet_input: TeamSheetInput = Body(...)
) -> Dict:
    """API Endpoint: Adds a default teamsheet, assigning players."""
    data_dir = get_project_data_dir(project_name)
    try:
        players_list = [p.model_dump() for p in teamsheet_input.players]
        result = _add_default_teamsheet(data_dir, team_id, players_list, teamsheet_input.tactic)
        if "error" in result:
             return {"message": f"Default teamsheet for team {team_id} already exists.", "teamsheet": result}
        return {"message": f"Default teamsheet '{teamsheet_input.tactic}' added successfully for team {team_id}", "teamsheet": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"API Error adding teamsheet for {team_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add teamsheet: {e}")

@router.post("/formations/{project_name}/{team_id}/mentalities", tags=["tactics"])
async def add_default_mentalities_endpoint(
    project_name: str = Path(..., description="The name of the project"),
    team_id: str = Path(..., description="The ID of the team"),
    mentalities_input: MentalitiesInput = Body(...)
) -> Dict:
    """API Endpoint: Adds default mentality entries."""
    data_dir = get_project_data_dir(project_name)
    try:
        players_list = [p.model_dump() for p in mentalities_input.players]
        result = _add_default_mentalities(data_dir, team_id, players_list, mentalities_input.tactic)
        if not result:
            return {"message": f"Default mentalities for team {team_id} might already exist. Skipped."}
        return {"message": f"Default mentalities '{mentalities_input.tactic}' added successfully for team {team_id}", "mentalities_added": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"API Error adding mentalities for {team_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add mentalities: {e}")

# --- Original endpoints ---

@router.get("/default_mentalities", tags=["tactics"])
async def get_default_mentalities(project_id: str = Query(None, description="Project ID to load default_mentalities from")):
    """Get default_mentalities data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/default_mentalities.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project default_mentalities: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/default_mentalities.json')

@router.get("/default_teamsheets", tags=["tactics"])
async def get_default_teamsheets(project_id: str = Query(None, description="Project ID to load default_teamsheets from")):
    """Get default_teamsheets data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/default_teamsheets.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project default_teamsheets: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/default_teamsheets.json')

@router.get("/defaultteamdata", tags=["tactics"])
async def get_defaultteamdata(project_id: str = Query(None, description="Project ID to load defaultteamdata from")):
    """Get defaultteamdata data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/defaultteamdata.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project defaultteamdata: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/defaultteamdata.json')

@router.get("/formations", tags=["tactics"])
async def get_formations(project_id: str = Query(None, description="Project ID to load formations from")):
    """Get formations data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/formations.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project formations: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/formations.json')

@router.get("/mentalities", tags=["tactics"])
async def get_mentalities(project_id: str = Query(None, description="Project ID to load mentalities from")):
    """Get mentalities data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/mentalities.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project mentalities: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/mentalities.json')
