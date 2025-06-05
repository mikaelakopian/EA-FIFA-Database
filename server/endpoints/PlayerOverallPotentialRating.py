"""
Player Overall Rating and Potential Calculation Module

This module calculates overall rating and potential for players based on:
- League average rating (from db_leagues_ratings.json)
- Player market value
- Player position
- Player age
- Player attributes (if available)
"""

import json
import os
import re
from typing import Dict, Any, Optional, Tuple
from pathlib import Path


def parse_player_age(player_data: Dict[str, Any], default_age: int = 25) -> int:
    """
    Parse player age from various data formats
    
    Args:
        player_data: Player data dictionary
        default_age: Default age if parsing fails
        
    Returns:
        Parsed age or default age
    """
    age_field = player_data.get("date_of_birth_age", "")
    
    # Also check for 'age' field as fallback
    if not age_field:
        age_field = player_data.get("age", "")
    
    if age_field:
        try:
            # Try different formats
            if "(" in age_field and ")" in age_field:
                # Format like "Jan 15, 1995 (29)"
                age_match = re.search(r'\((\d+)\)', age_field)
                if age_match:
                    return int(age_match.group(1))
            else:
                # Direct age like "20" or "25"
                age_match = re.search(r'(\d+)', age_field)
                if age_match:
                    return int(age_match.group(1))
        except:
            pass
    
    return default_age


def load_league_ratings() -> Dict[str, Any]:
    """Load league ratings from db_leagues_ratings.json"""
    try:
        ratings_file = Path(__file__).parent.parent / "db" / "db_leagues_ratings.json"
        with open(ratings_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not load league ratings: {e}")
        return {}


def load_leagues_data(project_id: str = None) -> Dict[str, Any]:
    """Load leagues data from project or fc25 data"""
    try:
        if project_id:
            # Try to load from project first
            leagues_file = Path(__file__).parent.parent / "projects" / project_id / "data" / "fifa_ng_db" / "leagues.json"
            if leagues_file.exists():
                with open(leagues_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        
        # Fallback to fc25 data
        leagues_file = Path(__file__).parent.parent / "fc25" / "data" / "fifa_ng_db" / "leagues.json"
        with open(leagues_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not load leagues data: {e}")
        return []


def load_nations_data(project_id: str = None) -> Dict[str, Any]:
    """Load nations data from project or fc25 data"""
    try:
        if project_id:
            # Try to load from project first
            nations_file = Path(__file__).parent.parent / "projects" / project_id / "data" / "fifa_ng_db" / "nations.json"
            if nations_file.exists():
                with open(nations_file, 'r', encoding='utf-8-sig') as f:  # Use utf-8-sig to handle BOM
                    return json.load(f)
        
        # Fallback to fc25 data
        nations_file = Path(__file__).parent.parent / "fc25" / "data" / "fifa_ng_db" / "nations.json"
        with open(nations_file, 'r', encoding='utf-8-sig') as f:  # Use utf-8-sig to handle BOM
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not load nations data: {e}")
        return []


def get_league_info_from_id(league_id: str, project_id: str = None) -> Tuple[str, str]:
    """
    Get country name and division from league_id
    
    Args:
        league_id: League ID from FIFA database
        project_id: Project ID to load data from
        
    Returns:
        Tuple of (country_name, division_level)
    """
    if not league_id or league_id == "":
        return ("Unknown", "1")
    
    try:
        leagues = load_leagues_data(project_id)
        nations = load_nations_data(project_id)
        
        
        # Create nation lookup by ID
        nation_lookup = {nation.get("nationid"): nation.get("nationname", "Unknown") for nation in nations}
        
        # Find league by ID
        for league in leagues:
            league_id_in_data = league.get("leagueid")
            if str(league_id_in_data) == str(league_id):  # Convert both to string for comparison
                country_id = league.get("countryid")
                division = league.get("level", "1")
                
                # Get country name from nation lookup
                country_name = nation_lookup.get(country_id, "Unknown")
                
                return (country_name, division)
        
        # Fallback if league not found
        return ("Unknown", "1")
        
    except Exception as e:
        print(f"Warning: Could not determine league info for ID {league_id}: {e}")
        return ("Unknown", "1")


def parse_market_value(market_value_str: str) -> float:
    """
    Parse market value string to numeric value in euros
    
    Examples:
    - "�40.00m" -> 40000000
    - "�2.50m" -> 2500000
    - "�500k" -> 500000
    - "�50k" -> 50000
    """
    if not market_value_str or market_value_str in ["-", "N/A", ""]:
        return 0.0
    
    # Remove currency symbols and spaces - handle multiple Euro symbol representations
    clean_value = market_value_str.replace("€", "").replace("�", "").replace("$", "").replace("£", "").replace(",", "").strip()
    
    try:
        if "m" in clean_value.lower():
            # Millions
            numeric_part = float(clean_value.lower().replace("m", "").strip())
            return numeric_part * 1_000_000
        elif "k" in clean_value.lower():
            # Thousands
            numeric_part = float(clean_value.lower().replace("k", "").strip())
            return numeric_part * 1_000
        else:
            # Direct numeric value
            return float(clean_value)
    except (ValueError, TypeError) as e:
        print(f"Warning: Could not parse market value '{market_value_str}': {e}")
        return 0.0


def get_league_average_rating(country: str, division: str, league_ratings: Dict[str, Any]) -> float:
    """
    Get average rating for a specific league division
    
    Args:
        country: Country name (e.g., "England", "Spain")
        division: Division number as string (e.g., "1", "2")
        league_ratings: League ratings data
    
    Returns:
        Average rating for the league, or default value if not found
    """
    if not league_ratings:
        return 50.0  # Default fallback
    
    # Try to find exact country match
    if country in league_ratings:
        country_data = league_ratings[country]
        if division in country_data:
            return country_data[division].get("average_rating", 50.0)
        # If specific division not found, try division "1"
        if "1" in country_data:
            return country_data["1"].get("average_rating", 50.0)
    
    # Try case-insensitive search
    for country_key in league_ratings.keys():
        if country_key.lower() == country.lower():
            country_data = league_ratings[country_key]
            if division in country_data:
                return country_data[division].get("average_rating", 50.0)
            if "1" in country_data:
                return country_data["1"].get("average_rating", 50.0)
    
    # Default fallback for unknown leagues
    return 50.0


def get_position_rating_modifier(position: str) -> float:
    """
    Get position-based rating modifier
    Higher value positions tend to have slightly higher ratings
    """
    position_modifiers = {
        # Goalkeepers - specialized position
        "GK": 1.0,
        
        # Defenders - solid base ratings
        "CB": 1.0,
        "LB": 1.0,
        "RB": 1.0,
        "LWB": 1.05,
        "RWB": 1.05,
        
        # Midfielders - varies by role
        "CDM": 1.02,
        "CM": 1.03,
        "CAM": 1.08,
        "LM": 1.02,
        "RM": 1.02,
        
        # Forwards - higher valued positions
        "LW": 1.10,
        "RW": 1.10,
        "CF": 1.12,
        "ST": 1.15
    }
    
    return position_modifiers.get(position.upper(), 1.0)


def get_age_rating_modifier(age: int) -> float:
    """
    Get age-based modifier for base rating with minimal age influence
    Market value is the primary factor, age has very minimal impact
    
    Args:
        age: Player age
        
    Returns:
        Age modifier multiplier (0.95 to 1.05) - very small range
    """
    if age <= 15:
        # Academy youth - minimal penalty
        return 0.95
    elif age == 16:
        # Young academy - minimal penalty
        return 0.96
    elif age == 17:
        # Late academy - minimal penalty
        return 0.97
    elif age == 18:
        # First year professional - tiny penalty
        return 0.98
    elif age == 19:
        # Young professional - tiny penalty
        return 0.99
    elif age == 20:
        # Developing player - neutral
        return 1.00
    elif age == 21:
        # Emerging talent - tiny bonus
        return 1.01
    elif age == 22:
        # Young talent - tiny bonus
        return 1.02
    elif age == 23:
        # Rising player - small bonus
        return 1.03
    elif age == 24:
        # Pre-peak talent - small bonus
        return 1.04
    elif age == 25:
        # Near peak - peak bonus
        return 1.05
    elif age == 26:
        # Early peak - peak bonus
        return 1.05
    elif age == 27:
        # Prime peak - peak bonus
        return 1.05
    elif age == 28:
        # Absolute peak - peak bonus
        return 1.05
    elif age == 29:
        # Late prime - peak bonus
        return 1.05
    elif age == 30:
        # Late peak - small bonus
        return 1.04
    elif age == 31:
        # Early decline - small bonus
        return 1.03
    elif age == 32:
        # Gradual decline - tiny bonus
        return 1.02
    elif age == 33:
        # Decline - tiny bonus
        return 1.01
    elif age == 34:
        # Notable decline - neutral
        return 1.00
    elif age == 35:
        # Veteran decline - tiny penalty
        return 0.99
    elif age == 36:
        # Senior veteran - tiny penalty
        return 0.98
    elif age == 37:
        # Late career - minimal penalty
        return 0.97
    elif age == 38:
        # Very late career - minimal penalty
        return 0.96
    elif age == 39:
        # End of career - minimal penalty
        return 0.95
    elif age == 40:
        # Exceptional longevity - minimal penalty
        return 0.95
    else:
        # Beyond typical career - minimal penalty
        return 0.95


def get_base_rating_from_market_value(market_value: float, age: int = 28) -> float:
    """
    Get base rating (BR) based on market value and age using detailed rating table
    
    Uses a comprehensive 55-tier rating system from 45 to 99 based on market value,
    then applies age-based modifiers. Peak performance is at ages 26-30.
    
    Args:
        market_value: Player market value in euros
        age: Player age (default 28 - peak age)
    
    Examples:
    - €300m+ at peak (28 years): 99
    - €300m+ young (20 years): 99 * 0.80 = 79
    - €50m+ at peak (28 years): 88
    - €50m+ young (22 years): 88 * 0.85 = 75
    - €1m+ at peak (28 years): 68
    - €1m+ veteran (35 years): 68 * 0.85 = 58
    """
    # Detailed rating table from highest to lowest (peak performance values)
    rating_table = [
        (99, 300_000_000), (98, 200_000_000), (97, 150_000_000), (96, 125_000_000),
        (95, 100_000_000), (94, 93_750_000), (93, 87_500_000), (92, 75_000_000),
        (91, 71_875_000), (90, 68_750_000), (89, 62_500_000), (88, 50_000_000),
        (87, 45_000_000), (86, 40_000_000), (85, 30_000_000), (84, 27_500_000),
        (83, 25_000_000), (82, 20_000_000), (81, 18_750_000), (80, 17_500_000),
        (79, 15_000_000), (78, 10_000_000), (77, 8_750_000), (76, 7_500_000),
        (75, 5_000_000), (74, 4_500_000), (73, 4_000_000), (72, 3_500_000),
        (71, 2_000_000), (70, 1_750_000), (69, 1_500_000), (68, 1_000_000),
        (67, 875_000), (66, 750_000), (65, 500_000), (64, 425_000),
        (63, 350_000), (62, 200_000), (61, 187_500), (60, 175_000),
        (59, 150_000), (58, 100_000), (57, 87_500), (56, 75_000),
        (55, 50_000), (54, 42_500), (53, 35_000), (52, 20_000),
        (51, 17_500), (50, 15_000), (49, 10_000), (48, 7_500),
        (47, 5_000), (46, 2_500), (45, 0)
    ]
    
    # Find the base rating for the market value (peak performance)
    base_rating = 45.0
    for rating, min_value in rating_table:
        if market_value >= min_value:
            base_rating = float(rating)
            break
    
    # Special handling for players with zero market value
    # Give them a slightly higher base rating based on age if they're young
    if market_value == 0 and age <= 22:
        if age <= 18:
            base_rating = 50.0  # Young prospects
        elif age <= 20:
            base_rating = 48.0  # Developing players
        elif age <= 22:
            base_rating = 47.0  # Young talents
    elif market_value == 0:
        base_rating = 45.0  # Standard minimum for older players with no value
    
    # Apply age modifier
    age_modifier = get_age_rating_modifier(age)
    final_rating = base_rating * age_modifier
    
    # Ensure rating stays within reasonable bounds (but allow low ratings for young/old players)
    return max(25.0, min(99.0, final_rating))


def get_league_influence_coefficient(market_value: float) -> float:
    """
    Calculate League Influence Coefficient (LIC) based on market value
    
    Formula: LIC = 1.0 × (0.05 / 1.0)^(MV / 100,000,000)
    
    Args:
        market_value: Market value in euros
        
    Returns:
        League Influence Coefficient (0.0 to 1.0)
    """
    if market_value <= 0:
        return 1.0  # Maximum league influence for players with no market value
    
    # Calculate LIC using exponential decay formula
    # LIC = 1.0 × (0.05)^(MV / 100,000,000)
    exponent = market_value / 100_000_000
    lic = 1.0 * (0.05 ** exponent)
    
    # Ensure LIC is between 0.0 and 1.0
    return max(0.0, min(1.0, lic))


def get_age_potential_modifier(age: int, market_value: float = 0) -> int:
    """
    Get age-based modifier for potential rating that considers both age and market value
    
    Args:
        age: Player age
        market_value: Player market value in euros
        
    Returns:
        Potential modifier as integer (always >= 0)
    """
    # Base age modifiers
    if age <= 18:
        # Very young players - highest potential
        base_modifier = 12
    elif age <= 21:
        # Young players - high potential
        base_modifier = 8
    elif age <= 23:
        # Prime development age - good potential
        base_modifier = 6
    elif age <= 25:
        # Still developing - moderate potential
        base_modifier = 4
    elif age <= 27:
        # Peak years - low potential
        base_modifier = 2
    elif age <= 29:
        # Late peak - minimal potential
        base_modifier = 1
    elif age <= 32:
        # Experienced - very minimal potential
        base_modifier = 0
    else:
        # Veteran - no potential growth
        base_modifier = 0
    
    # Market value bonus for young talents
    # High value young players have more potential
    if age <= 23 and market_value > 0:
        if market_value >= 50_000_000:  # €50m+
            base_modifier += 3
        elif market_value >= 20_000_000:  # €20m+
            base_modifier += 2
        elif market_value >= 5_000_000:  # €5m+
            base_modifier += 1
    
    # Reduce potential for older expensive players (they're already near peak)
    if age >= 28 and market_value >= 30_000_000:
        base_modifier = max(0, base_modifier - 1)
    
    return base_modifier


def calculate_overall_rating_and_potential(
    player_data: Dict[str, Any],
    league_country: str = None,
    league_division: str = "1",
    player_age: int = None
) -> Tuple[int, int]:
    """
    Calculate overall rating and potential for a player using new formula
    
    New Formula: FR = BR × (1 - LIC) + ((BR + LR) / 2) × LIC
    Where:
    - BR = Base Rating (from market value)
    - LR = League Rating (from db_leagues_ratings.json)
    - LIC = League Influence Coefficient (based on market value)
    
    Args:
        player_data: Player data dictionary containing market value, position, etc.
        league_country: Country of the league (for league rating lookup)
        league_division: Division number (default "1")
        player_age: Player age (if not provided, will be estimated)
    
    Returns:
        Tuple of (overall_rating, potential)
    """
    # Load league ratings
    league_ratings = load_league_ratings()
    
    # Parse market value
    market_value_str = player_data.get("market_value_eur", player_data.get("value", "0"))
    market_value = parse_market_value(str(market_value_str))
    
    # Parse age if not provided (needed for base rating calculation)
    if player_age is None:
        player_age = parse_player_age(player_data)
    
    # Get Base Rating (BR) from market value and age
    base_rating = get_base_rating_from_market_value(market_value, player_age)
    
    # Get League Rating (LR)
    if league_country:
        league_rating = get_league_average_rating(league_country, league_division, league_ratings)
    else:
        league_rating = 50.0  # Default for unknown leagues
    
    # Get League Influence Coefficient (LIC)
    league_influence_coefficient = get_league_influence_coefficient(market_value)
    
    # Calculate Final Rating using new formula
    # FR = BR × (1 - LIC) + ((BR + LR) / 2) × LIC
    br_component = base_rating * (1 - league_influence_coefficient)
    league_component = ((base_rating + league_rating) / 2) * league_influence_coefficient
    final_rating = br_component + league_component
    
    # Calculate potential (add age-based potential modifier with market value consideration)
    age_potential_mod = get_age_potential_modifier(player_age, market_value)
    potential = final_rating + age_potential_mod
    
    # Ensure ratings are within FIFA bounds
    overall_rating = max(45, min(99, int(round(final_rating))))
    potential = max(0, min(99, int(round(potential))))
    
    # Ensure potential is at least equal to overall rating
    potential = max(overall_rating, potential)
    
    return overall_rating, potential


def get_rating_breakdown_details(
    player_data: Dict[str, Any],
    league_id: str = None,
    player_age: int = None,
    project_id: str = None,
    existing_rating: int = None
) -> Dict[str, Any]:
    """
    Get detailed breakdown of how player rating was calculated using new formula
    
    Returns a dictionary with all calculation components for UI display
    """
    # Get league info from ID
    league_country, league_division = get_league_info_from_id(league_id, project_id) if league_id else ("Unknown", "1")
    
    # Load league ratings
    league_ratings = load_league_ratings()
    
    # Parse market value
    market_value_str = player_data.get("market_value_eur", player_data.get("value", "0"))
    market_value = parse_market_value(str(market_value_str))
    
    # Parse age if not provided (needed for base rating calculation)
    if player_age is None:
        player_age = parse_player_age(player_data)
    
    # Get Base Rating (BR) from market value and age
    base_rating = get_base_rating_from_market_value(market_value, player_age)
    
    # Get League Rating (LR)
    league_rating = get_league_average_rating(league_country, league_division, league_ratings)
    
    # Get League Influence Coefficient (LIC)
    league_influence_coefficient = get_league_influence_coefficient(market_value)
    
    # Calculate the rating using the new formula for breakdown display
    calculated_overall_rating, calculated_potential_rating = calculate_overall_rating_and_potential(
        player_data=player_data,
        league_country=league_country,
        league_division=league_division,
        player_age=player_age
    )
    
    # Calculate formula components
    br_component = base_rating * (1 - league_influence_coefficient)
    league_component = ((base_rating + league_rating) / 2) * league_influence_coefficient
    final_rating = br_component + league_component
    
    # Calculate potential modifier with market value
    age_potential_mod = get_age_potential_modifier(player_age, market_value)
    
    # Calculate base rating details for breakdown
    base_rating_peak = base_rating / get_age_rating_modifier(player_age)  # What the rating would be at peak
    age_modifier = get_age_rating_modifier(player_age)
    
    return {
        "overall_rating": calculated_overall_rating,
        "potential_rating": calculated_potential_rating,
        "breakdown": {
            "base_rating": base_rating,
            "base_rating_peak": base_rating_peak,
            "age_modifier": age_modifier,
            "league_rating": league_rating,
            "league_country": league_country,
            "league_division": league_division,
            "market_value": market_value,
            "market_value_str": market_value_str,
            "league_influence_coefficient": league_influence_coefficient,
            "br_component": br_component,
            "league_component": league_component,
            "final_rating": final_rating,
            "player_age": player_age,
            "age_potential_mod": age_potential_mod,
            "components": [
                {
                    "name": "Базовый рейтинг на пике",
                    "value": round(base_rating_peak, 1),
                    "description": f"Рейтинг для стоимости {market_value_str} в возрасте 26-30 лет"
                },
                {
                    "name": "Возрастной модификатор",
                    "value": f"×{age_modifier:.2f}",
                    "description": f"Возраст {player_age} лет (пик: 26-30 лет)"
                },
                {
                    "name": "Базовый рейтинг (BR)",
                    "value": round(base_rating, 1),
                    "description": f"{round(base_rating_peak, 1)} × {age_modifier:.2f} = {round(base_rating, 1)}"
                },
                {
                    "name": "Рейтинг лиги (LR)",
                    "value": round(league_rating, 1),
                    "description": f"{league_country}, дивизион {league_division}"
                },
                {
                    "name": "Влияние лиги (LIC)",
                    "value": f"{round(league_influence_coefficient * 100, 1)}%",
                    "description": f"Зависит от рыночной стоимости игрока"
                },
                {
                    "name": "BR × (1 - LIC)",
                    "value": round(br_component, 1),
                    "description": f"{round(base_rating, 1)} × (1 - {round(league_influence_coefficient, 3)}) = {round(br_component, 1)}"
                },
                {
                    "name": "((BR + LR) / 2) × LIC",
                    "value": round(league_component, 1),
                    "description": f"(({round(base_rating, 1)} + {round(league_rating, 1)}) / 2) × {round(league_influence_coefficient, 3)} = {round(league_component, 1)}"
                },
                {
                    "name": "Финальный рейтинг",
                    "value": round(final_rating, 1),
                    "description": f"{round(br_component, 1)} + {round(league_component, 1)} = {round(final_rating, 1)}"
                }
            ]
        }
    }


def calculate_player_rating_from_league_id(
    player_data: Dict[str, Any],
    league_id: str = None,
    player_age: int = None,
    project_id: str = None
) -> Tuple[int, int]:
    """
    Calculate overall rating and potential for a player using league_id
    
    Args:
        player_data: Player data dictionary containing market value, position, etc.
        league_id: League ID to lookup country and division
        player_age: Player age (if not provided, will be estimated)
        project_id: Project ID to load data from
    
    Returns:
        Tuple of (overall_rating, potential)
    """
    # Get league info from ID
    league_country, league_division = get_league_info_from_id(league_id, project_id) if league_id else ("Unknown", "1")
    
    # Call the main calculation function
    return calculate_overall_rating_and_potential(
        player_data=player_data,
        league_country=league_country,
        league_division=league_division,
        player_age=player_age
    )


def calculate_rating_from_attributes(player_attributes: Dict[str, Any], position: str) -> int:
    """
    Calculate overall rating based on individual player attributes
    Used when detailed attribute data is available
    
    Args:
        player_attributes: Dictionary of player attributes (pace, shooting, etc.)
        position: Player position for weighting calculation
    
    Returns:
        Calculated overall rating
    """
    # Position-based attribute weights
    position_weights = {
        "GK": {
            "gkdiving": 0.20, "gkhandling": 0.20, "gkkicking": 0.15,
            "gkpositioning": 0.20, "gkreflexes": 0.25
        },
        "CB": {
            "pace": 0.10, "shooting": 0.05, "passing": 0.15,
            "dribbling": 0.10, "defending": 0.35, "physical": 0.25
        },
        "LB": {
            "pace": 0.20, "shooting": 0.05, "passing": 0.20,
            "dribbling": 0.15, "defending": 0.25, "physical": 0.15
        },
        "RB": {
            "pace": 0.20, "shooting": 0.05, "passing": 0.20,
            "dribbling": 0.15, "defending": 0.25, "physical": 0.15
        },
        "CDM": {
            "pace": 0.10, "shooting": 0.10, "passing": 0.25,
            "dribbling": 0.15, "defending": 0.25, "physical": 0.15
        },
        "CM": {
            "pace": 0.15, "shooting": 0.15, "passing": 0.25,
            "dribbling": 0.20, "defending": 0.15, "physical": 0.10
        },
        "CAM": {
            "pace": 0.15, "shooting": 0.20, "passing": 0.25,
            "dribbling": 0.25, "defending": 0.05, "physical": 0.10
        },
        "LW": {
            "pace": 0.25, "shooting": 0.20, "passing": 0.15,
            "dribbling": 0.25, "defending": 0.05, "physical": 0.10
        },
        "RW": {
            "pace": 0.25, "shooting": 0.20, "passing": 0.15,
            "dribbling": 0.25, "defending": 0.05, "physical": 0.10
        },
        "ST": {
            "pace": 0.20, "shooting": 0.30, "passing": 0.10,
            "dribbling": 0.20, "defending": 0.05, "physical": 0.15
        }
    }
    
    # Default weights if position not found
    default_weights = {
        "pace": 0.17, "shooting": 0.17, "passing": 0.17,
        "dribbling": 0.17, "defending": 0.17, "physical": 0.15
    }
    
    weights = position_weights.get(position.upper(), default_weights)
    
    # Calculate weighted average
    total_rating = 0
    total_weight = 0
    
    for attr, weight in weights.items():
        if attr in player_attributes:
            value = player_attributes[attr]
            if isinstance(value, str) and value.isdigit():
                value = int(value)
            elif isinstance(value, (int, float)):
                value = float(value)
            else:
                continue
            
            total_rating += value * weight
            total_weight += weight
    
    if total_weight > 0:
        return int(round(total_rating / total_weight))
    else:
        return 50  # Default if no attributes found


# Example usage and testing
if __name__ == "__main__":
    # Test with sample players using new formula
    
    # Example 1: Young talent in weak league (high LIC)
    test_player1 = {
        "player_name": "Young Talent",
        "market_value_eur": "€50,000",
        "player_position": "CM",
        "date_of_birth_age": "Jan 15, 2005 (19)"
    }
    
    overall1, potential1 = calculate_overall_rating_and_potential(
        test_player1,
        league_country="Poland",
        league_division="3"
    )
    
    print(f"Young Talent (€50k, Poland 3rd div, age 19) - Overall: {overall1}, Potential: {potential1}")
    print(f"  BR (peak): {get_base_rating_from_market_value(50000, 28):.1f}, BR (age 19): {get_base_rating_from_market_value(50000, 19):.1f}, LIC: {get_league_influence_coefficient(50000):.3f}, Age Mod: {get_age_potential_modifier(19, 50000)}")
    
    # Example 2: Star in top league (low LIC)
    test_player2 = {
        "player_name": "Top Star",
        "market_value_eur": "€50,000,000",
        "player_position": "ST",
        "date_of_birth_age": "Jan 15, 1995 (29)"
    }
    
    overall2, potential2 = calculate_overall_rating_and_potential(
        test_player2,
        league_country="England",
        league_division="1"
    )
    
    print(f"Top Star (€50m, Premier League, age 29) - Overall: {overall2}, Potential: {potential2}")
    print(f"  BR (peak): {get_base_rating_from_market_value(50000000, 28):.1f}, BR (age 29): {get_base_rating_from_market_value(50000000, 29):.1f}, LIC: {get_league_influence_coefficient(50000000):.3f}, Age Mod: {get_age_potential_modifier(29, 50000000)}")
    
    # Example 3: Medium player in medium league (moderate LIC)
    test_player3 = {
        "player_name": "Medium Player",
        "market_value_eur": "€2,000,000",
        "player_position": "CM",
        "date_of_birth_age": "Jan 15, 1990 (34)"
    }
    
    overall3, potential3 = calculate_overall_rating_and_potential(
        test_player3,
        league_country="Italy",
        league_division="2"
    )
    
    print(f"Medium Player (€2m, Serie B, age 34) - Overall: {overall3}, Potential: {potential3}")
    print(f"  BR (peak): {get_base_rating_from_market_value(2000000, 28):.1f}, BR (age 34): {get_base_rating_from_market_value(2000000, 34):.1f}, LIC: {get_league_influence_coefficient(2000000):.3f}, Age Mod: {get_age_potential_modifier(34, 2000000)}")
    
    # Example 4: Young expensive talent
    test_player4 = {
        "player_name": "Young Star",
        "market_value_eur": "€25,000,000",
        "player_position": "CAM",
        "date_of_birth_age": "Jan 15, 2002 (22)"
    }
    
    overall4, potential4 = calculate_overall_rating_and_potential(
        test_player4,
        league_country="Spain",
        league_division="1"
    )
    
    print(f"Young Star (€25m, La Liga, age 22) - Overall: {overall4}, Potential: {potential4}")
    print(f"  BR (peak): {get_base_rating_from_market_value(25000000, 28):.1f}, BR (age 22): {get_base_rating_from_market_value(25000000, 22):.1f}, LIC: {get_league_influence_coefficient(25000000):.3f}, Age Mod: {get_age_potential_modifier(22, 25000000)}")
    
    # Example 5: Same player at different ages
    print("\n--- Age Impact Demonstration ---")
    market_val = 10_000_000  # €10M player
    for test_age in [18, 22, 25, 28, 31, 35]:
        test_player = {
            "player_name": f"Player at {test_age}",
            "market_value_eur": f"€{market_val:,}",
            "player_position": "CM",
            "date_of_birth_age": f"Jan 1, {2024-test_age} ({test_age})"
        }
        
        overall, potential = calculate_overall_rating_and_potential(
            test_player,
            league_country="England",
            league_division="1"
        )
        
        br_at_age = get_base_rating_from_market_value(market_val, test_age)
        br_at_peak = get_base_rating_from_market_value(market_val, 28)
        age_modifier = get_age_rating_modifier(test_age)
        pot_modifier = get_age_potential_modifier(test_age, market_val)
        
        print(f"  Age {test_age}: Overall {overall}, Potential {potential} | BR: {br_at_peak:.0f} → {br_at_age:.0f} (×{age_modifier:.2f}) | Pot Mod: +{pot_modifier}")