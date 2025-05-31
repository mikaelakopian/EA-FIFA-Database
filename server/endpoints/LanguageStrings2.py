from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
import re
from typing import List, Dict, Optional

router = APIRouter()

def create_abbreviated_name(team_name: str, max_length: int) -> str:
    """Create abbreviated team name with specified max length."""
    if len(team_name) <= max_length:
        return team_name
        
    # Split into words
    words = team_name.split()
    
    if max_length <= 3:
        # For very short abbreviations, take first letters
        abbr = ''.join(word[0] for word in words if word)
        return abbr[:max_length].upper()
        
    if len(words) == 1:
        # Single word - just truncate
        return team_name[:max_length]
        
    # Try abbreviating each word except the last
    abbr = ''
    for i, word in enumerate(words):
        if i < len(words) - 1:
            abbr += word[0]
        else:
            # Add as much of the last word as possible
            remaining = max_length - len(abbr)
            if remaining > 0:
                abbr += ' ' + word[:remaining]
                
    return abbr.strip()

async def add_team_language_strings(
    team_id: str,
    team_name: str,
    project_name: str
) -> bool:
    """Add or update team name entries in LanguageStrings2.json."""
    try:
        language_strings2_file = Path("projects") / project_name / "data/loc/LanguageStrings2.json"
        
        # Ensure directory exists
        language_strings2_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing language strings or create empty list
        language_strings2 = []
        if language_strings2_file.exists():
            try:
                with open(language_strings2_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if content.strip():
                        language_strings2 = json.loads(content)
            except Exception as e:
                print(f"Error reading LanguageStrings2.json: {str(e)}. Starting with empty file.")
        
        # Remove " (number)" from the end of team_name if it exists
        team_name_clean = re.sub(r'\s*\(\d+\)$', '', team_name)
        
        # Create entries for different formats
        team_entries = [
            {
                "stringid": f"TeamName_{team_id}",
                "sourcetext": team_name_clean,
                "hashid": "1"
            },
            {
                "stringid": f"TeamName_Abbr15_{team_id}",
                "sourcetext": create_abbreviated_name(team_name_clean, 15),
                "hashid": "1"
            },
            {
                "stringid": f"TeamName_Abbr10_{team_id}",
                "sourcetext": create_abbreviated_name(team_name_clean, 10),
                "hashid": "1"
            },
            {
                "stringid": f"TeamName_Abbr3_{team_id}",
                "sourcetext": create_abbreviated_name(team_name_clean, 3),
                "hashid": "1"
            }
        ]
        
        # Update or add each entry
        for entry in team_entries:
            existing_entry = next((e for e in language_strings2 if e['stringid'] == entry['stringid']), None)
            if existing_entry:
                existing_entry.update(entry)
            else:
                language_strings2.append(entry)
        
        # Save the updated language strings
        with open(language_strings2_file, 'w', encoding='utf-8') as f:
            json.dump(language_strings2, f, ensure_ascii=False, indent=2)
            
        return True
        
    except Exception as e:
        print(f"Error processing language strings: {str(e)}")
        return False

@router.get("/language-strings/{project_id}")
async def get_language_strings(project_id: str) -> List[Dict]:
    """Get all language strings for a project."""
    try:
        language_strings2_file = Path("projects") / project_id / "data/loc/LanguageStrings2.json"
        if not language_strings2_file.exists():
            return []
            
        with open(language_strings2_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading language strings: {str(e)}")
