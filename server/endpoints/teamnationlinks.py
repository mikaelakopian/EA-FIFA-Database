from fastapi import APIRouter, Query, HTTPException
from .utils import load_json_file

router = APIRouter()

@router.get("/teamnationlinks", tags=["teamnationlinks"])
async def get_teamnationlinks(project_id: str = Query(None, description="Project ID to load teamnationlinks from")):
    """Get teamnationlinks data from project folder or default file"""
    
    if project_id:
        try:
            return load_json_file(f'../projects/{project_id}/data/fifa_ng_db/teamnationlinks.json')
        except HTTPException as e:
            if e.status_code != 404:
                print(f"[ERROR] Error loading project teamnationlinks: {e.detail}")
    
    return load_json_file('../fc25/data/fifa_ng_db/teamnationlinks.json')
