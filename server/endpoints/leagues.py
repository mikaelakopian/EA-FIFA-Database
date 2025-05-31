from fastapi import APIRouter, Query, HTTPException, Body
from .utils import load_json_file, save_json_file
from pydantic import BaseModel
from typing import Optional
import os

router = APIRouter()

class LeagueCreate(BaseModel):
    leagueid: str
    leaguename: str
    countryid: str
    level: str = "1"
    leaguetype: str = "0"
    iswomencompetition: str = "0"
    isinternationalleague: str = "0"
    iscompetitionscarfenabled: str = "2"
    isbannerenabled: str = "2"
    iscompetitionpoleflagenabled: str = "2"
    iscompetitioncrowdcardsenabled: str = "2"
    leaguetimeslice: str = "6"
    iswithintransferwindow: str = "0"

@router.get("/leagues", tags=["leagues"])
async def get_leagues(project_id: str = Query(None, description="Project ID to load leagues from")):
    """Get leagues data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/leagues.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project leagues: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/leagues.json')

@router.get("/leagues/original", tags=["leagues"])
async def get_original_leagues():
    """Get original leagues data from fc25 folder"""
    return load_json_file('../fc25/data/fifa_ng_db/leagues.json')

@router.get("/leagues/validate", tags=["leagues"])
async def validate_league_combination(
    country_id: str = Query(..., description="Country ID to check"),
    level: str = Query(..., description="League level to check"),
    project_id: str = Query(None, description="Project ID to check leagues in")
):
    """Validate if a country+level combination is available"""
    
    # Determine the file path
    if project_id:
        file_path = f'../projects/{project_id}/data/fifa_ng_db/leagues.json'
    else:
        file_path = '../fc25/data/fifa_ng_db/leagues.json'
    
    try:
        # Load existing leagues
        try:
            leagues = load_json_file(file_path)
        except HTTPException as e:
            if e.status_code == 404:
                # If file doesn't exist, combination is available
                return {"available": True, "message": "Combination is available"}
            else:
                raise e
        
        # Check if country+level combination already exists
        existing_league = next(
            (league for league in leagues 
             if league.get("countryid") == country_id and league.get("level") == level),
            None
        )
        
        if existing_league:
            return {
                "available": False,
                "message": f"A league already exists for this country and division level",
                "existing_league": {
                    "leagueid": existing_league.get("leagueid"),
                    "leaguename": existing_league.get("leaguename")
                }
            }
        else:
            return {"available": True, "message": "Combination is available"}
            
    except Exception as e:
        print(f"[ERROR] Error validating league combination: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to validate combination: {str(e)}")

@router.post("/leagues", tags=["leagues"])
async def add_league(
    league_data: LeagueCreate,
    project_id: str = Query(None, description="Project ID to add league to")
):
    """Add a new league to the specified project or default file"""
    
    # Determine the file path
    if project_id:
        file_path = f'../projects/{project_id}/data/fifa_ng_db/leagues.json'
        # Ensure the directory exists
        dir_path = os.path.dirname(file_path)
        abs_dir_path = os.path.abspath(os.path.join(os.path.dirname(__file__), dir_path))
        os.makedirs(abs_dir_path, exist_ok=True)
    else:
        file_path = '../fc25/data/fifa_ng_db/leagues.json'
    
    try:
        # Load existing leagues
        try:
            leagues = load_json_file(file_path)
        except HTTPException as e:
            if e.status_code == 404:
                # If file doesn't exist, start with empty list
                leagues = []
            else:
                raise e
        
        # Check if league ID already exists
        existing_ids = [league.get("leagueid") for league in leagues]
        if league_data.leagueid in existing_ids:
            raise HTTPException(status_code=400, detail=f"League ID {league_data.leagueid} already exists")
        
        # Check if country+level combination already exists
        existing_combinations = [
            (league.get("countryid"), league.get("level")) 
            for league in leagues
        ]
        if (league_data.countryid, league_data.level) in existing_combinations:
            # Find the existing league with this combination
            existing_league = next(
                league for league in leagues 
                if league.get("countryid") == league_data.countryid and league.get("level") == league_data.level
            )
            raise HTTPException(
                status_code=400, 
                detail=f"A league already exists for this country and division level. Existing league: '{existing_league.get('leaguename')}' (ID: {existing_league.get('leagueid')})"
            )
        
        # Create the new league object using the exact leagueid from the form
        new_league = {
            "leagueid": league_data.leagueid,  # Use the leagueid from form
            "leaguename": league_data.leaguename,
            "countryid": league_data.countryid,
            "level": league_data.level,
            "leaguetype": league_data.leaguetype,
            "iswomencompetition": league_data.iswomencompetition,
            "isinternationalleague": league_data.isinternationalleague,
            "iscompetitionscarfenabled": league_data.iscompetitionscarfenabled,
            "isbannerenabled": league_data.isbannerenabled,
            "iscompetitionpoleflagenabled": league_data.iscompetitionpoleflagenabled,
            "iscompetitioncrowdcardsenabled": league_data.iscompetitioncrowdcardsenabled,
            "leaguetimeslice": league_data.leaguetimeslice,
            "iswithintransferwindow": league_data.iswithintransferwindow,
        }
        
        
        # Add the new league to the list
        leagues.append(new_league)
        
        # Sort leagues by leagueid to maintain order (convert to int for proper sorting)
        try:
            leagues.sort(key=lambda x: int(x.get("leagueid", 0)))
        except ValueError:
            # If leagueid is not numeric, sort as string
            leagues.sort(key=lambda x: x.get("leagueid", "0"))
        
        # Save the updated leagues list
        save_json_file(file_path, leagues)
        
        
        return new_league
        
    except HTTPException:
        # Re-raise HTTPException as is
        raise
    except Exception as e:
        print(f"[ERROR] Error adding league: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add league: {str(e)}")

@router.get("/leagues/transfermarkt", tags=["leagues"])
async def get_transfermarkt_leagues(
    country: str = Query(..., description="Country name to search for"),
    tier: int = Query(None, description="Tier/division level to filter by")
):
    """Get Transfermarkt leagues by country and optionally by tier"""
    
    try:
        # Load Transfermarkt leagues data
        transfermarkt_data = load_json_file('../db/LeaguesFromTransfermarkt.json')
        
        matching_leagues = []
        
        # Search through all confederations
        for confederation in transfermarkt_data.get('confederations', []):
            for league in confederation.get('leagues', []):
                # Case-insensitive country matching
                if league.get('country', '').lower() == country.lower():
                    # If tier is specified, filter by tier as well
                    if tier is None or league.get('tier') == tier:
                        matching_leagues.append(league)
        
        return {"leagues": matching_leagues}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Transfermarkt data: {str(e)}")

@router.get("/leagues/transfermarkt-mapped", tags=["leagues"])
async def get_transfermarkt_leagues_mapped(
    country_id: str = Query(..., description="FIFA country ID to map to Transfermarkt"),
    tier: str = Query(..., description="Tier/division level to filter by")
):
    """Get Transfermarkt leagues using FIFA nation ID mapping"""
    try:
        # Load the FIFA to Transfermarkt nation mapping
        tm_fifa_map = load_json_file('../db/tm_fifa_nation_map.json')
        
        # Find the Transfermarkt country name by FIFA nation ID
        transfermarkt_country = None
        for tm_country, fifa_id in tm_fifa_map.items():
            if fifa_id == country_id:
                transfermarkt_country = tm_country
                break
        
        if not transfermarkt_country:
            return {"leagues": [], "message": f"No Transfermarkt mapping found for FIFA nation ID: {country_id}"}
        
        # Load Transfermarkt leagues data
        transfermarkt_data = load_json_file('../db/LeaguesFromTransfermarkt.json')
        
        # Find leagues for the country and tier
        matching_leagues = []
        tier_int = int(tier)
        
        for confederation in transfermarkt_data.get("confederations", []):
            for league in confederation.get("leagues", []):
                if (league.get("country", "").lower() == transfermarkt_country.lower() and 
                    league.get("tier") == tier_int):
                    matching_leagues.append(league)
        
        return {
            "leagues": matching_leagues,
            "fifa_country_id": country_id,
            "transfermarkt_country": transfermarkt_country,
            "tier": tier_int,
            "last_updated": transfermarkt_data.get("last_updated")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching Transfermarkt data: {str(e)}")

@router.get("/leagues/find-id", tags=["leagues"])
async def find_league_id(
    country_id: str = Query(..., description="Country ID to search for"),
    level: int = Query(..., description="League level to search for")
):
    """Find league ID from db_leagues_names.json by country and level"""
    
    try:
        # Load league names database
        leagues_db = load_json_file('../db/db_leagues_names.json')
        
        # Find matching league
        matching_league = None
        for league in leagues_db:
            if (league.get('countryid') == country_id and 
                league.get('leaguelevel') == level):
                matching_league = league
                break
        
        if matching_league:
            return {
                'found': True,
                'league': {
                    'leagueid': matching_league.get('leagueid'),
                    'leaguename': matching_league.get('leaguename'),
                    'country': matching_league.get('country'),
                    'leaguelevel': matching_league.get('leaguelevel'),
                    'iswomenleague': matching_league.get('iswomenleague', False)
                }
            }
        else:
            return {
                'found': False,
                'message': f'No league found for country ID {country_id} and level {level}'
            }
        
    except Exception as e:
        print(f"[ERROR] Error finding league ID: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to find league ID: {str(e)}")
