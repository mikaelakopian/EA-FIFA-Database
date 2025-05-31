from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os

router = APIRouter()

@router.get("/images/leagues/{league_id}", tags=["images"])
async def get_league_logo(league_id: str):
    """Get league logo image"""
    
    image_path = f'../fc25/images/leagues/l{league_id}.png'
    
    # Build absolute path relative to endpoints directory
    base_dir = os.path.dirname(__file__)
    abs_path = os.path.abspath(os.path.join(base_dir, image_path))
    
    # If logo not found, use fallback
    if not os.path.exists(abs_path):
        fallback_path = f'../fc25/images/leagues/notfound.png'
        abs_path = os.path.abspath(os.path.join(base_dir, fallback_path))
        
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail=f"League logo and fallback not found for ID: {league_id}")
    
    return FileResponse(
        abs_path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"}
    )

@router.get("/images/teams/{team_id}", tags=["images"])
async def get_team_logo(team_id: str):
    """Get team logo image"""
    
    base_dir = os.path.dirname(__file__)
    
    # 1. Check standard path
    standard_image_path_rel = f'../fc25/images/teams/l{team_id}.png'
    standard_abs_path = os.path.abspath(os.path.join(base_dir, standard_image_path_rel))
    
    if os.path.exists(standard_abs_path):
        return FileResponse(
            standard_abs_path,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"}
        )
        
    # 2. Check project-specific paths
    # Path to 'server/projects/' from 'server/endpoints/'
    projects_root_rel = '../projects' 
    projects_root_abs = os.path.abspath(os.path.join(base_dir, projects_root_rel))
    
    if os.path.isdir(projects_root_abs):
        for project_name in os.listdir(projects_root_abs):
            project_dir_abs = os.path.join(projects_root_abs, project_name)
            if os.path.isdir(project_dir_abs):
                crest_dir_in_project = os.path.join("images", "crest")
                
                # Check for l{team_id}.png
                project_logo_l_filename = f"l{team_id}.png"
                project_logo_l_abs_path = os.path.join(project_dir_abs, crest_dir_in_project, project_logo_l_filename)
                if os.path.exists(project_logo_l_abs_path):
                    return FileResponse(
                        project_logo_l_abs_path,
                        media_type="image/png",
                        headers={"Cache-Control": "public, max-age=3600"}
                    )
                
                # Check for {team_id}.png
                project_logo_plain_filename = f"{team_id}.png"
                project_logo_plain_abs_path = os.path.join(project_dir_abs, crest_dir_in_project, project_logo_plain_filename)
                if os.path.exists(project_logo_plain_abs_path):
                    return FileResponse(
                        project_logo_plain_abs_path,
                        media_type="image/png",
                        headers={"Cache-Control": "public, max-age=3600"}
                    )

    # 3. If logo not found in standard or project paths, use fallback
    fallback_path_rel = f'../fc25/images/teams/notfound.png'
    fallback_abs_path = os.path.abspath(os.path.join(base_dir, fallback_path_rel))
    
    if os.path.exists(fallback_abs_path):
        return FileResponse(
            fallback_abs_path,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"}
        )
    
    # 4. If fallback also not found
    raise HTTPException(status_code=404, detail=f"Team logo, project logos, and fallback not found for ID: {team_id}")

@router.get("/images/flags/{country_id}", tags=["images"])
async def get_country_flag(country_id: str):
    """Get country flag image"""
    
    image_path = f'../fc25/images/flages/f_{country_id}.png'
    
    # Build absolute path relative to endpoints directory
    base_dir = os.path.dirname(__file__)
    abs_path = os.path.abspath(os.path.join(base_dir, image_path))
    
    # If flag not found, use fallback (Rest of World flag)
    if not os.path.exists(abs_path):
        fallback_path = f'../fc25/images/flages/f_211.png'
        abs_path = os.path.abspath(os.path.join(base_dir, fallback_path))
        
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail=f"Country flag and fallback not found for ID: {country_id}")
    
    return FileResponse(
        abs_path,
        media_type="image/png", 
        headers={"Cache-Control": "public, max-age=3600"}
    )

@router.get("/images/players/{player_id}", tags=["images"])
async def get_player_photo(player_id: str):
    """Get player photo image"""
    
    image_path = f'../fc25/images/heads/p{player_id}.png'
    
    # Build absolute path relative to endpoints directory
    base_dir = os.path.dirname(__file__)
    abs_path = os.path.abspath(os.path.join(base_dir, image_path))
    
    # If photo not found, use fallback
    if not os.path.exists(abs_path):
        fallback_path = f'../fc25/images/heads/notfound_0.png'
        abs_path = os.path.abspath(os.path.join(base_dir, fallback_path))
        
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail=f"Player photo and fallback not found for ID: {player_id}")
    
    return FileResponse(
        abs_path,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"}
    ) 