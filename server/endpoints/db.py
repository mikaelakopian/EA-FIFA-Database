from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, List, Any
import json
import os

from .utils import load_json_file

router = APIRouter()

DB_DIR = os.path.join(os.path.dirname(__file__), '..', 'db') # ../db relative to current file
POSITIONS_FILE = os.path.join(DB_DIR, 'db_positions.json')
LEAGUE_RATINGS_FILE = os.path.join(DB_DIR, 'db_leagues_ratings.json')

class PositionMappingsPayload(BaseModel):
    mappings: Dict[str, List[List[str]]] # TM Name -> List of [FC Name, FC ID as string]

class LeagueRatingsPayload(BaseModel):
    ratings: Dict[str, Any] # Country ratings data

@router.get("/db/rest_of_world_teams", tags=["db"])
async def get_rest_of_world_teams():
    """Get rest of world teams data"""
    return load_json_file('../db/rest_of_world_teams.json')

@router.get("/db/teamlinks_from_tm", tags=["db"])
async def get_teamlinks_from_tm():
    """Get team links from Transfermarkt data"""
    return load_json_file('../db/teamlinks_from_tm.json')

@router.post("/db/save_position_mappings", tags=["db"])
async def save_position_mappings(payload: PositionMappingsPayload):
    """Save player position mappings to a JSON file."""
    try:
        # Ensure the db directory exists
        os.makedirs(DB_DIR, exist_ok=True)
        
        with open(POSITIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(payload.mappings, f, ensure_ascii=False, indent=4)
        return {"message": "Position mappings saved successfully.", "file_path": POSITIONS_FILE}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save position mappings: {str(e)}")

@router.get("/db/load_position_mappings", tags=["db"])
async def load_position_mappings():
    """Load player position mappings from a JSON file."""
    try:
        if not os.path.exists(POSITIONS_FILE):
            return {"message": "Position mappings file not found. Returning empty mappings.", "mappings": {}}
        
        with open(POSITIONS_FILE, 'r', encoding='utf-8') as f:
            mappings = json.load(f)
        return {"message": "Position mappings loaded successfully.", "mappings": mappings}
    except Exception as e:
        # If file is corrupted or not valid JSON, return empty mappings
        # You might want to log this error on the server for debugging
        print(f"Error loading position mappings: {str(e)}. Returning empty mappings.")
        return {"message": f"Error loading mappings: {str(e)}. Returning empty mappings.", "mappings": {}}

@router.get("/db/tm_fifa_nation_map", tags=["db"])
async def get_tm_fifa_nation_map():
    """Get nation mapping between Transfermarkt and FIFA"""
    return load_json_file('../db/tm_fifa_nation_map.json')

@router.get("/db/leagues_from_transfermarkt", tags=["db"])
async def get_leagues_from_transfermarkt():
    """Get leagues data from Transfermarkt"""
    return load_json_file('../db/LeaguesFromTransfermarkt.json')

@router.get("/db/fc25_countries", tags=["db"])
async def get_fc25_countries(project_id: str = Query(None, description="Project ID to load FC25 data from")):
    """Get FC25 countries mapping"""
    try:
        # Load data using existing file loading logic
        if project_id:
            try:
                nations = load_json_file(f'../projects/{project_id}/data/fifa_ng_db/nations.json')
            except:
                # Fallback to default FC25 data
                nations = load_json_file('../fc25/data/fifa_ng_db/nations.json')
        else:
            # Use default FC25 data
            nations = load_json_file('../fc25/data/fifa_ng_db/nations.json')
        
        # Create mapping of country ID to country name
        country_mapping = {}
        for nation in nations:
            country_id = str(nation.get('nationid', ''))
            country_name = nation.get('nationname', '')
            if country_id and country_name:
                country_mapping[country_id] = country_name
        
        return country_mapping
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get FC25 countries: {str(e)}")

@router.get("/db/fc25_league_ratings", tags=["db"])
async def get_fc25_league_ratings(project_id: str = Query(None, description="Project ID to load FC25 data from")):
    """Get FC25 league ratings calculated from team ratings"""
    try:
        # Load data using existing file loading logic
        if project_id:
            try:
                leagueteamlinks = load_json_file(f'../projects/{project_id}/data/fifa_ng_db/leagueteamlinks.json')
                teams = load_json_file(f'../projects/{project_id}/data/fifa_ng_db/teams.json')
                leagues = load_json_file(f'../projects/{project_id}/data/fifa_ng_db/leagues.json')
            except:
                # Fallback to default FC25 data
                leagueteamlinks = load_json_file('../fc25/data/fifa_ng_db/leagueteamlinks.json')
                teams = load_json_file('../fc25/data/fifa_ng_db/teams.json')
                leagues = load_json_file('../fc25/data/fifa_ng_db/leagues.json')
        else:
            # Use default FC25 data
            leagueteamlinks = load_json_file('../fc25/data/fifa_ng_db/leagueteamlinks.json')
            teams = load_json_file('../fc25/data/fifa_ng_db/teams.json')
            leagues = load_json_file('../fc25/data/fifa_ng_db/leagues.json')
        
        # Load Transfermarkt to FC25 nation mapping
        tm_fifa_nation_map = load_json_file('../db/tm_fifa_nation_map.json')
        
        # Create mappings
        team_ratings = {}
        league_info = {}
        
        # Map team ratings by teamid
        for team in teams:
            team_id = str(team.get('teamid', ''))
            overall_rating = team.get('overallrating', 0)
            if team_id and overall_rating:
                team_ratings[team_id] = int(overall_rating)
        
        # Map league info by leagueid (only men's leagues)
        for league in leagues:
            league_id = str(league.get('leagueid', ''))
            is_women = league.get('iswomencompetition', '0') == '1'
            
            if league_id and not is_women:  # Only include men's leagues
                league_info[league_id] = {
                    'leaguename': league.get('leaguename', f'League {league_id}'),
                    'countryid': str(league.get('countryid', '')),
                    'level': int(league.get('level', 1))
                }
        
        # Calculate average ratings per league
        league_ratings = {}
        
        for link in leagueteamlinks:
            league_id = str(link.get('leagueid', ''))
            team_id = str(link.get('teamid', ''))
            
            if league_id and team_id in team_ratings and league_id in league_info:
                if league_id not in league_ratings:
                    league_ratings[league_id] = []
                league_ratings[league_id].append(team_ratings[team_id])
        
        # Create reverse mapping from FC25 country ID to Transfermarkt country name
        # Handle cases where multiple TM countries map to same FC25 ID
        fc25_to_tm_country = {}
        for tm_country, fc25_country_id in tm_fifa_nation_map.items():
            fc25_id_str = str(fc25_country_id)
            if fc25_id_str not in fc25_to_tm_country:
                fc25_to_tm_country[fc25_id_str] = []
            fc25_to_tm_country[fc25_id_str].append(tm_country)
        
        # Group by country and level
        country_level_ratings = {}
        
        for league_id, ratings in league_ratings.items():
            if ratings and league_id in league_info:
                league_data = league_info[league_id]
                fc25_country_id = league_data['countryid']
                level = league_data['level']
                
                # Convert FC25 country ID to Transfermarkt country names
                tm_country_names = fc25_to_tm_country.get(fc25_country_id, [])
                if not tm_country_names:
                    continue  # Skip if no mapping found
                
                # Add ratings to all mapped countries
                for tm_country_name in tm_country_names:
                    if tm_country_name not in country_level_ratings:
                        country_level_ratings[tm_country_name] = {}
                    
                    if level not in country_level_ratings[tm_country_name]:
                        country_level_ratings[tm_country_name][level] = []
                    
                    country_level_ratings[tm_country_name][level].extend(ratings)
        
        # Calculate final averages by country and level
        result = {}
        for tm_country_name, levels in country_level_ratings.items():
            result[tm_country_name] = {}
            for level, all_ratings in levels.items():
                if all_ratings:
                    avg_rating = sum(all_ratings) / len(all_ratings)
                    result[tm_country_name][level] = {
                        'average_rating': round(avg_rating, 1),
                        'team_count': len(all_ratings),
                        'min_rating': min(all_ratings),
                        'max_rating': max(all_ratings),
                        'level': level
                    }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate FC25 league ratings: {str(e)}")

@router.post("/db/save_league_ratings", tags=["db"])
async def save_league_ratings(payload: LeagueRatingsPayload):
    """Save league ratings data to a JSON file."""
    try:
        # Ensure the db directory exists
        os.makedirs(DB_DIR, exist_ok=True)
        
        with open(LEAGUE_RATINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(payload.ratings, f, ensure_ascii=False, indent=4)
        return {"message": "League ratings saved successfully.", "file_path": LEAGUE_RATINGS_FILE}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save league ratings: {str(e)}")

@router.get("/db/load_league_ratings", tags=["db"])
async def load_league_ratings():
    """Load league ratings data from a JSON file."""
    try:
        if not os.path.exists(LEAGUE_RATINGS_FILE):
            return {"message": "League ratings file not found.", "ratings": {}}
        
        with open(LEAGUE_RATINGS_FILE, 'r', encoding='utf-8') as f:
            ratings = json.load(f)
        return {"message": "League ratings loaded successfully.", "ratings": ratings}
    except Exception as e:
        print(f"Error loading league ratings: {str(e)}. Returning empty ratings.")
        return {"message": f"Error loading ratings: {str(e)}. Returning empty ratings.", "ratings": {}} 