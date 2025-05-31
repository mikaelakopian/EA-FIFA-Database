# This file makes the 'utils' directory a Python package 

import json
import os
from fastapi import HTTPException

def load_json_file(relative_path: str):
    """
    Load JSON file with error handling and logging.
    Paths are relative to the server/endpoints/ directory.
    """
    try:
        base_dir = os.path.dirname(__file__)  # server/endpoints/utils/
        # Adjust base_dir to be server/endpoints/ for correct relative path resolution
        # The __file__ in __init__.py will be .../utils/__init__.py
        # We need to go up one level to make 'relative_path' work as intended (relative to 'endpoints')
        endpoints_dir = os.path.dirname(base_dir) 
        abs_path = os.path.abspath(os.path.join(endpoints_dir, relative_path))
        
        
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"File not found: {abs_path}")
            
        with open(abs_path, 'r', encoding='utf-8-sig') as file:
            data = json.load(file)
            return data
            
    except FileNotFoundError:
        print(f"[ERROR] File not found: {relative_path}")
        raise HTTPException(status_code=404, detail=f"File {relative_path} not found")
    except json.JSONDecodeError:
        print(f"[ERROR] JSON decode error in: {relative_path}")
        raise HTTPException(status_code=500, detail=f"File {relative_path} is corrupted")
    except Exception as e:
        print(f"[ERROR] Unexpected error loading {relative_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading {relative_path}")

def save_json_file(relative_path: str, data):
    """
    Save JSON file with error handling and logging.
    Paths are relative to the server/endpoints/ directory.
    """
    try:
        base_dir = os.path.dirname(__file__)  # server/endpoints/utils/
        # Adjust base_dir similarly for saving
        endpoints_dir = os.path.dirname(base_dir)
        abs_path = os.path.abspath(os.path.join(endpoints_dir, relative_path))
        
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        
        with open(abs_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=4, ensure_ascii=False)
            
    except Exception as e:
        print(f"[ERROR] Unexpected error saving {relative_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving {relative_path}: {str(e)}") 