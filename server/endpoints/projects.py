from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
import os
import shutil
import json
import re
import tempfile
import zipfile
from pathlib import Path

router = APIRouter()

# Base paths
BASE_DIR = Path(__file__).parent.parent
FC25_DATA_DIR = BASE_DIR / "fc25" / "data"
PROJECTS_DIR = BASE_DIR / "projects"
PROJECTS_METADATA_FILE = PROJECTS_DIR / "projects_metadata.json"

# Ensure projects directory exists
PROJECTS_DIR.mkdir(exist_ok=True)

# Request/Response models
class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    
    @validator('name')
    def validate_name(cls, v):
        # Allow only alphanumeric characters, spaces, hyphens, and underscores
        if not re.match(r'^[a-zA-Z0-9\s\-_]+$', v):
            raise ValueError('Project name can only contain letters, numbers, spaces, hyphens, and underscores')
        # Remove extra spaces
        v = ' '.join(v.split())
        return v

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    path: str
    created_at: str
    updated_at: str

class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int

# Helper functions
def load_projects_metadata():
    """Load projects metadata from JSON file"""
    if PROJECTS_METADATA_FILE.exists():
        try:
            with open(PROJECTS_METADATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_projects_metadata(metadata):
    """Save projects metadata to JSON file"""
    with open(PROJECTS_METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

def format_value_for_export(value) -> str:
    """Format a value for export, replacing decimal points with commas"""
    str_val = str(value)
    # Check if it's a number with decimal point
    if isinstance(value, float):
        str_val = str_val.replace('.', ',')
    elif isinstance(value, str) and '.' in str_val:
        # Check if it's a string representation of a float
        try:
            float(str_val)
            str_val = str_val.replace('.', ',')
        except ValueError:
            # Not a number, keep as is
            pass
    return str_val

def get_expected_headers(filename: str) -> list:
    """Get expected headers for empty files based on filename"""
    expected_headers = {
        'stadiumassignments.json': ['stadiumcustomname', 'teamid'],
        'teamstadiumlinks.json': ['swapcrowdplacement', 'stadiumid', 'stadiumname', 'teamid', 'forcedhome'],
        'teamplayerlinks.json': ['playerid', 'teamid', 'jerseynumber', 'position'],
        'leagueteamlinks.json': ['leagueid', 'teamid'],
        'teamnationlinks.json': ['teamid', 'nationid'],
        'playernames.json': ['nameid', 'commentaryid', 'name'],
        'players.json': ['playerid', 'firstnameid', 'lastnameid', 'commonnameid', 'nationality', 'height', 'weight'],
        'teams.json': ['teamid', 'teamname', 'leagueid', 'nationality'],
        'leagues.json': ['leagueid', 'leaguename', 'countryid'],
        'nations.json': ['nationid', 'nationname'],
        'manager.json': ['haircolorcode', 'facialhairtypecode', 'managerid', 'accessorycode4', 'hairtypecode', 'lipcolor', 'skinsurfacepack', 'accessorycode3', 'accessorycolourcode1', 'headtypecode', 'firstname', 'height', 'seasonaloutfitid', 'birthdate', 'skinmakeup', 'weight', 'hashighqualityhead', 'eyedetail', 'gender', 'commonname', 'headassetid', 'ethnicity', 'surname', 'faceposerpreset', 'teamid', 'eyebrowcode', 'eyecolorcode', 'personalityid', 'accessorycolourcode3', 'accessorycode1', 'headclasscode', 'nationality', 'sideburnscode', 'skintypecode', 'accessorycolourcode4', 'headvariation', 'skintonecode', 'outfitid', 'skincomplexion', 'accessorycode2', 'hairstylecode', 'bodytypecode', 'managerjointeamdate', 'accessorycolourcode2', 'facialhaircolorcode'],
        'teamkits.json': ['teamid', 'kittype', 'jerseysponsorlogo'],
        'mentalities.json': ['mentalityid', 'buildupspeed', 'passingrisklevel'],
        'formations.json': ['formationid', 'formationname'],
        'defaultteamdata.json': ['teamid', 'formationid', 'mentalityid']
    }
    return expected_headers.get(filename, [])

def convert_json_to_txt(json_file_path: str, txt_file_path: str) -> bool:
    """Convert JSON file to TXT format for FC25 compdata"""
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        with open(txt_file_path, 'w', encoding='utf-8') as f:
            if isinstance(data, list):
                # Handle list data (like players.json, teams.json)
                if data and isinstance(data[0], dict):
                    # Write headers (column names) first
                    headers = list(data[0].keys())
                    f.write('\t'.join(headers) + '\n')
                    
                    # Write data rows
                    for item in data:
                        if isinstance(item, dict):
                            # Ensure values are in the same order as headers
                            values = []
                            for header in headers:
                                value = item.get(header, "")  # Use empty string if field missing
                                values.append(format_value_for_export(value))
                            f.write('\t'.join(values) + '\n')
                        else:
                            f.write(format_value_for_export(item) + '\n')
                else:
                    # Handle empty lists - try to get expected headers
                    filename = os.path.basename(json_file_path)
                    expected_headers = get_expected_headers(filename)
                    if expected_headers:
                        # Write expected headers for empty files
                        f.write('\t'.join(expected_headers) + '\n')
                    
                    # Write data for non-dict list items
                    for item in data:
                        f.write(format_value_for_export(item) + '\n')
            elif isinstance(data, dict):
                # Handle dict data (like settings)
                for key, value in data.items():
                    f.write(f"{key}\t{format_value_for_export(value)}\n")
            else:
                # Handle simple values
                f.write(format_value_for_export(data))
        
        return True
    except Exception as e:
        print(f"Error converting {json_file_path} to TXT: {e}")
        return False

def generate_project_id(name: str) -> str:
    """Generate a unique project ID from the name"""
    # Convert to lowercase and replace spaces with hyphens
    base_id = re.sub(r'[^a-z0-9\-_]', '', name.lower().replace(' ', '-'))
    
    # Ensure uniqueness
    metadata = load_projects_metadata()
    if base_id not in metadata:
        return base_id
    
    # Add number suffix if needed
    counter = 1
    while f"{base_id}-{counter}" in metadata:
        counter += 1
    return f"{base_id}-{counter}"

def create_project_directory(project_id: str) -> Path:
    """Create project directory and copy FC25 data"""
    project_path = PROJECTS_DIR / project_id
    
    # Check if directory already exists
    if project_path.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project directory '{project_id}' already exists"
        )
    
    try:
        # Create project directory
        project_path.mkdir(parents=True, exist_ok=True)
        
        # Copy FC25 data directory
        if FC25_DATA_DIR.exists():
            shutil.copytree(FC25_DATA_DIR, project_path / "data")
        else:
            # If FC25 data doesn't exist, create empty data structure
            (project_path / "data").mkdir(exist_ok=True)
            (project_path / "data" / "compdata").mkdir(exist_ok=True)
            (project_path / "data" / "fifa_ng_db").mkdir(exist_ok=True)
            (project_path / "data" / "loc").mkdir(exist_ok=True)
        
        return project_path
    except Exception as e:
        # Clean up on failure
        if project_path.exists():
            shutil.rmtree(project_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

# API Endpoints
@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, tags=["projects"])
async def create_project(project_data: CreateProjectRequest):
    """Create a new project by copying the FC25 data directory"""
    
    # Generate project ID
    project_id = generate_project_id(project_data.name)
    
    # Create project directory
    project_path = create_project_directory(project_id)
    
    # Create project metadata
    now = datetime.utcnow().isoformat()
    project_info = {
        "id": project_id,
        "name": project_data.name,
        "description": project_data.description,
        "path": str(project_path.relative_to(BASE_DIR)),
        "created_at": now,
        "updated_at": now
    }
    
    # Save to metadata file
    metadata = load_projects_metadata()
    metadata[project_id] = project_info
    save_projects_metadata(metadata)
    
    return ProjectResponse(**project_info)

@router.get("/", response_model=ProjectListResponse, tags=["projects"])
async def list_projects():
    """List all projects"""
    metadata = load_projects_metadata()
    
    # Convert to list and sort by creation date (newest first)
    projects = list(metadata.values())
    projects.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return ProjectListResponse(
        projects=projects,
        total=len(projects)
    )

@router.get("/{project_id}", response_model=ProjectResponse, tags=["projects"])
async def get_project(project_id: str):
    """Get a specific project by ID"""
    metadata = load_projects_metadata()
    
    if project_id not in metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found"
        )
    
    return ProjectResponse(**metadata[project_id])

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["projects"])
async def delete_project(project_id: str):
    """Delete a project and its data"""
    metadata = load_projects_metadata()
    
    if project_id not in metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found"
        )
    
    # Delete project directory
    project_path = PROJECTS_DIR / project_id
    if project_path.exists():
        try:
            shutil.rmtree(project_path)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete project directory: {str(e)}"
            )
    
    # Remove from metadata
    del metadata[project_id]
    save_projects_metadata(metadata)
    
    return None

@router.put("/{project_id}", response_model=ProjectResponse, tags=["projects"])
async def update_project(project_id: str, project_data: CreateProjectRequest):
    """Update project metadata (name and description only)"""
    metadata = load_projects_metadata()
    
    if project_id not in metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found"
        )
    
    # Update metadata
    project_info = metadata[project_id]
    project_info["name"] = project_data.name
    project_info["description"] = project_data.description
    project_info["updated_at"] = datetime.utcnow().isoformat()
    
    # Save updated metadata
    save_projects_metadata(metadata)
    
    return ProjectResponse(**project_info)

@router.get("/{project_name}/export-data", tags=["projects"])
async def export_project_data(project_name: str, background_tasks: BackgroundTasks):
    """
    Exports the project's 'data' folder after converting JSON files to TXT (TSV).
    The data is zipped and sent for download.
    """
    project_dir = PROJECTS_DIR / project_name
    source_data_dir = project_dir / "data"

    if not source_data_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Data directory for project '{project_name}' not found.")

    # Create a temporary directory manually
    temp_dir_path_str = tempfile.mkdtemp()
    try:
        temp_dir_path = Path(temp_dir_path_str)
        # Use the manually created temp dir path
        temp_txt_dir = temp_dir_path / "converted_data" 
        temp_zip_path = temp_dir_path / f"{project_name}_data_export.zip"

        conversion_count = 0
        # Walk through the source data directory
        for root, _, files in os.walk(source_data_dir):
            for filename in files:
                source_path = Path(root) / filename
                # Calculate relative path to maintain structure inside temp dir and zip
                relative_path = source_path.relative_to(source_data_dir)
                target_path_in_temp = temp_txt_dir / relative_path

                # Ensure target directory exists
                target_path_in_temp.parent.mkdir(parents=True, exist_ok=True)

                if filename.lower().endswith('.json'):
                    # Convert JSON to TXT
                    target_txt_path = target_path_in_temp.with_suffix('.txt')
                    if convert_json_to_txt(str(source_path), str(target_txt_path)):
                        conversion_count += 1
                else:
                    # Copy other files directly
                    try:
                        shutil.copy2(source_path, target_path_in_temp)
                        # print(f"Copied {source_path} to {target_path_in_temp}")
                    except Exception as e:
                        print(f"Error copying file {source_path}: {e}")

        print(f"Converted {conversion_count} JSON files and copied other files for project '{project_name}'")
        if not any(temp_txt_dir.iterdir()): # Check if the temp directory is actually empty
            raise HTTPException(status_code=404, detail=f"No convertible JSON files found in data directory for project '{project_name}'")

        # Create a ZIP archive of the converted TXT files
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in temp_txt_dir.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_txt_dir)
                    zipf.write(file_path, arcname=arcname)

        print(f"Created ZIP archive: {temp_zip_path}")

        # Return the ZIP file for download, add background task for cleanup
        response = FileResponse(
            path=str(temp_zip_path),
            media_type='application/zip',
            filename=f"{project_name}_data_export.zip",
            background=background_tasks # Pass background tasks instance
        )
        # Add the cleanup task *after* creating the response
        background_tasks.add_task(shutil.rmtree, temp_dir_path_str, ignore_errors=True)
        return response
    except Exception as e:
        # Clean up the temp dir if an error occurs *before* returning the response
        shutil.rmtree(temp_dir_path_str, ignore_errors=True)
        # Re-raise the exception or handle it (e.g., return an error response)
        raise HTTPException(status_code=500, detail=f"Error exporting project data: {str(e)}")

@router.get("/{project_id}/formations")
async def get_project_formations(project_id: str):
    """Get formations data for a specific project"""
    try:
        project_dir = PROJECTS_DIR / project_id / "data" / "fifa_ng_db"
        formations_file = project_dir / "formations.json"
        
        if not formations_file.exists():
            raise HTTPException(status_code=404, detail=f"Formations file not found for project {project_id}")
            
        with open(formations_file, 'r', encoding='utf-8') as f:
            formations_data = json.load(f)
            
        return formations_data
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Formations data not found for project {project_id}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Invalid JSON format in formations file for project {project_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving formations data: {str(e)}")

@router.get("/{project_id}/teamsheets")
async def get_project_teamsheets(project_id: str):
    """Get teamsheets data for a specific project"""
    try:
        project_dir = PROJECTS_DIR / project_id / "data" / "fifa_ng_db"
        teamsheets_file = project_dir / "default_teamsheets.json"
        
        if not teamsheets_file.exists():
            raise HTTPException(status_code=404, detail=f"Teamsheets file not found for project {project_id}")
            
        with open(teamsheets_file, 'r', encoding='utf-8') as f:
            teamsheets_data = json.load(f)
            
        return teamsheets_data
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Teamsheets data not found for project {project_id}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Invalid JSON format in teamsheets file for project {project_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving teamsheets data: {str(e)}")