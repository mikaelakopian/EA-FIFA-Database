from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List
import json
import os

from .utils import load_json_file

router = APIRouter()

DB_DIR = os.path.join(os.path.dirname(__file__), '..', 'db') # ../db relative to current file
POSITIONS_FILE = os.path.join(DB_DIR, 'db_positions.json')

class PositionMappingsPayload(BaseModel):
    mappings: Dict[str, List[List[str]]] # TM Name -> List of [FC Name, FC ID as string]

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