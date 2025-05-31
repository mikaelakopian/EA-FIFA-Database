from typing import List

def get_next_team_id(teams_data: List[dict]) -> str:
    """Get the next available team ID"""
    if not teams_data:
        return "1"
    
    # Ensure teamid is treated as an integer for max() comparison, handling potential non-numeric or missing values.
    # Default to 0 if teamid is not found or not a valid integer string.
    max_id = 0
    for team in teams_data:
        team_id_str = team.get("teamid")
        if team_id_str and team_id_str.isdigit():
            team_id_int = int(team_id_str)
            if team_id_int > max_id:
                max_id = team_id_int
        # If teamid is missing or not a digit, it won't update max_id, effectively treating it as less than or equal to current max_id.
        
    return str(max_id + 1)
