#!/usr/bin/env python3
"""
Test script for the new Player Overall Rating and Potential system
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from endpoints.PlayerOverallPotentialRating import (
    calculate_player_rating_from_league_id,
    get_league_info_from_id,
    parse_market_value
)

def test_market_value_parsing():
    """Test market value parsing function"""
    print("=== Testing Market Value Parsing ===")
    test_cases = [
        ("€40.00m", 40_000_000),
        ("€2.50m", 2_500_000),
        ("€500k", 500_000),
        ("€50k", 50_000),
        ("€1.2m", 1_200_000),
        ("-", 0),
        ("N/A", 0),
        ("", 0)
    ]
    
    for input_val, expected in test_cases:
        result = parse_market_value(input_val)
        status = "✅" if result == expected else "❌"
        print(f"{status} {input_val:>10} -> €{result:,.0f} (expected €{expected:,.0f})")


def test_league_lookup():
    """Test league information lookup"""
    print("\n=== Testing League Information Lookup ===")
    test_league_ids = ["1", "13", "14", "16", "19", "31", "999"]  # Various league IDs
    
    for league_id in test_league_ids:
        country, division = get_league_info_from_id(league_id)
        print(f"League ID {league_id:>3}: {country} (Division {division})")


def test_player_rating_calculation():
    """Test player rating calculation with various scenarios"""
    print("\n=== Testing Player Rating Calculation ===")
    
    test_players = [
        {
            "name": "Premier League Star",
            "player_data": {
                "player_name": "Harry Kane",
                "market_value_eur": "€80.00m",
                "player_position": "ST",
                "date_of_birth_age": "Jul 28, 1993 (31)"
            },
            "league_id": "13"  # Premier League
        },
        {
            "name": "Championship Player",
            "player_data": {
                "player_name": "Championship Forward",
                "market_value_eur": "€5.00m",
                "player_position": "ST",
                "date_of_birth_age": "Mar 15, 1998 (26)"
            },
            "league_id": "14"  # Championship
        },
        {
            "name": "Young Talent",
            "player_data": {
                "player_name": "Young Star",
                "market_value_eur": "€15.00m",
                "player_position": "CAM",
                "date_of_birth_age": "Jun 5, 2004 (20)"
            },
            "league_id": "13"  # Premier League
        },
        {
            "name": "Veteran Player",
            "player_data": {
                "player_name": "Veteran Midfielder",
                "market_value_eur": "€2.00m",
                "player_position": "CM",
                "date_of_birth_age": "Jan 12, 1985 (39)"
            },
            "league_id": "31"  # Serie A
        },
        {
            "name": "Unknown League Player",
            "player_data": {
                "player_name": "Unknown Player",
                "market_value_eur": "€1.00m",
                "player_position": "CB",
                "date_of_birth_age": "Aug 20, 1995 (29)"
            },
            "league_id": "999"  # Non-existent league
        }
    ]
    
    for test_case in test_players:
        name = test_case["name"]
        player_data = test_case["player_data"]
        league_id = test_case["league_id"]
        
        # Get league info
        country, division = get_league_info_from_id(league_id)
        
        # Calculate ratings multiple times to see variance
        ratings = []
        for i in range(3):  # Calculate 3 times to see randomness
            overall, potential = calculate_player_rating_from_league_id(player_data, league_id)
            ratings.append((overall, potential))
        
        print(f"\n{name}:")
        print(f"  League: {country} (Div {division})")
        print(f"  Market Value: {player_data['market_value_eur']}")
        print(f"  Position: {player_data['player_position']}")
        print(f"  Age: {player_data.get('date_of_birth_age', 'Unknown')}")
        print(f"  Ratings (OVR/POT): {' | '.join([f'{ovr}/{pot}' for ovr, pot in ratings])}")


if __name__ == "__main__":
    print("🧪 Testing Player Overall Rating and Potential System\n")
    
    try:
        test_market_value_parsing()
        test_league_lookup()
        test_player_rating_calculation()
        
        print("\n✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()