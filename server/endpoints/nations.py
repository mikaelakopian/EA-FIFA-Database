from fastapi import APIRouter, Query, HTTPException
from .utils import load_json_file

router = APIRouter()

@router.get("/nations", tags=["nations"])
async def get_nations(project_id: str = Query(None, description="Project ID to load nations from")):
    """Get nations data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/nations.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project nations: {e.detail}")
    
    return load_json_file('../projects/3-leagues/data/fifa_ng_db/nations.json')
