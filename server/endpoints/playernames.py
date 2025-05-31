from fastapi import APIRouter, Query, HTTPException
from .utils import load_json_file, save_json_file
import os
from typing import List, Dict, Any

router = APIRouter()

async def initialize_playernames_file(project_name: str) -> bool:
    """
    Initialize playernames.json file with empty name record if it doesn't exist.
    
    Args:
        project_name: Name of the project
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        playernames_file = f'../projects/{project_name}/data/fifa_ng_db/playernames.json'
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(playernames_file), exist_ok=True)
        
        # Check if file exists and has content
        try:
            existing_data = load_json_file(playernames_file)
            # Check if empty name record exists
            has_empty_record = any(
                entry.get("nameid") == "0" and entry.get("name") == ""
                for entry in existing_data
            )
            if has_empty_record:
                return True  # Already initialized
        except HTTPException:
            existing_data = []
        
        # Add empty name record if it doesn't exist
        empty_name_entry = {
            "nameid": "0",
            "commentaryid": "900000",
            "name": ""
        }
        
        if not any(entry.get("nameid") == "0" for entry in existing_data):
            existing_data.insert(0, empty_name_entry)
            save_json_file(playernames_file, existing_data)
            print(f"    ➕ Initialized playernames.json with empty name record")
        
        return True
    except Exception as e:
        print(f"    ❌ Error initializing playernames.json: {str(e)}")
        return False

@router.get("/playernames", tags=["playernames"])
async def get_playernames(project_id: str = Query(None, description="Project ID to load playernames from")):
    """Get playernames data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/playernames.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project playernames: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/playernames.json')

@router.post("/playernames/{project_name}/initialize", tags=["playernames"])
async def initialize_playernames_endpoint(project_name: str):
    """Initialize playernames.json file for a project"""
    success = await initialize_playernames_file(project_name)
    if success:
        return {"message": "Playernames file initialized successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to initialize playernames file")
