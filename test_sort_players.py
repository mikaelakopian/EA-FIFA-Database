#!/usr/bin/env python3

"""
Test script for the improved sort_players function
"""

from typing import List, Dict, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sort_players(players: List[Dict], positions_needed: Dict[int, int]) -> tuple[Dict[int, Optional[Dict]], Optional[Dict], List[Dict]]:
    """Sorts players according to position compatibility and overall rating."""
    if not players:
        return {i: None for i in range(11)}, None, []

    for p in players:
        p['overallrating'] = int(p.get('overallrating', 0))
        p['preferredposition1'] = int(p.get('preferredposition1', -1))

    # Define position families for compatibility checking
    POSITION_FAMILIES = {
        'goalkeeper': [0],  # GK
        'defenders': [2, 3, 4, 5, 6, 7, 8, 9],  # RWB, RB, CB, CB, CB, LB, LWB, SW
        'midfielders': [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],  # CDM, ?, RM, CM, CM, CM, LM, ?, CAM, ?
        'attackers': [20, 21, 22, 23, 24, 25, 26, 27]  # RF, CF, LF, RW, ST, ST, ST, LW
    }
    
    # Reverse mapping: position_id -> family
    POSITION_TO_FAMILY = {}
    for family, positions in POSITION_FAMILIES.items():
        for pos in positions:
            POSITION_TO_FAMILY[pos] = family
    
    def get_position_compatibility_score(player_pos: int, required_pos: int) -> int:
        """Calculate compatibility score between player position and required position.
        Returns: 100 (exact match), 75 (same family), 50 (adjacent family), 25 (distant family), 0 (incompatible)
        """
        if player_pos == required_pos:
            return 100  # Exact match
        
        player_family = POSITION_TO_FAMILY.get(player_pos, 'unknown')
        required_family = POSITION_TO_FAMILY.get(required_pos, 'unknown')
        
        if player_family == 'unknown' or required_family == 'unknown':
            return 25  # Unknown position, low compatibility
        
        if player_family == required_family:
            return 75  # Same position family
        
        # Adjacent family compatibility
        family_adjacency = {
            'goalkeeper': [],
            'defenders': ['midfielders'],
            'midfielders': ['defenders', 'attackers'],
            'attackers': ['midfielders']
        }
        
        if required_family in family_adjacency.get(player_family, []):
            return 50  # Adjacent family
        
        # Special cases for versatile positions
        if player_pos == 10 and required_pos in [13, 14, 15]:  # CDM can play CM
            return 60
        if player_pos in [13, 14, 15] and required_pos == 10:  # CM can play CDM
            return 60
        if player_pos == 18 and required_pos in [13, 14, 15]:  # CAM can play CM
            return 55
        if player_pos in [20, 22] and required_pos in [23, 27]:  # RF/LF can play wings
            return 65
        if player_pos in [23, 27] and required_pos in [20, 22]:  # Wings can play forward
            return 65
        
        return 25  # Distant family or incompatible

    players_sorted = sorted(players, key=lambda p: -p['overallrating'])
    assigned_players: Dict[int, Optional[Dict]] = {}
    available_players = players_sorted.copy()

    # First pass: Exact position matches
    for index in range(11):
        position_id = positions_needed.get(index, -1)
        if position_id == -1:
            assigned_players[index] = None
            continue

        best_match = None
        best_match_rating = -1

        for player in available_players:
            if player['preferredposition1'] == position_id:
                if player['overallrating'] > best_match_rating:
                    best_match = player
                    best_match_rating = player['overallrating']

        if best_match:
            assigned_players[index] = best_match
            available_players.remove(best_match)
        else:
            assigned_players[index] = None

    # Second pass: Fill remaining positions with compatible players
    unassigned_positions = [i for i in range(11) if assigned_players.get(i) is None]
    
    for index in unassigned_positions:
        position_id = positions_needed.get(index, -1)
        if position_id == -1:
            continue
            
        best_player = None
        best_score = -1
        
        for player in available_players:
            player_pos = player['preferredposition1']
            compatibility_score = get_position_compatibility_score(player_pos, position_id)
            
            # Don't assign goalkeepers to outfield positions or vice versa
            if (player_pos == 0 and position_id != 0) or (player_pos != 0 and position_id == 0):
                continue
                
            # Combined score: compatibility (weighted heavily) + rating
            # Compatibility is more important than rating for reasonable assignments
            combined_score = (compatibility_score * 10) + (player['overallrating'] * 0.1)
            
            # Only consider players with reasonable compatibility (50+)
            if compatibility_score >= 50 and combined_score > best_score:
                best_player = player
                best_score = combined_score
        
        if best_player:
            assigned_players[index] = best_player
            available_players.remove(best_player)
            print(f"Assigned {best_player.get('name', 'Unknown')} (pos {best_player['preferredposition1']}) to position {position_id} with compatibility {get_position_compatibility_score(best_player['preferredposition1'], position_id)}")

    # Third pass: Fill any remaining spots with best available players (emergency assignments)
    unassigned_positions = [i for i in range(11) if assigned_players.get(i) is None]
    temp_available = available_players.copy()
    temp_available.sort(key=lambda p: -p['overallrating'])
    
    for index in unassigned_positions:
        position_id = positions_needed.get(index, -1)
        if position_id == -1 or not temp_available:
            continue
            
        # For emergency assignments, still avoid goalkeeper/outfield mismatches
        suitable_players = []
        for player in temp_available:
            player_pos = player['preferredposition1']
            # Skip if it's a goalkeeper mismatch
            if (player_pos == 0 and position_id != 0) or (player_pos != 0 and position_id == 0):
                continue
            suitable_players.append(player)
        
        if suitable_players:
            player_to_assign = suitable_players[0]  # Highest rated suitable player
            assigned_players[index] = player_to_assign
            available_players.remove(player_to_assign)
            temp_available.remove(player_to_assign)
            print(f"Emergency assignment: {player_to_assign.get('name', 'Unknown')} (pos {player_to_assign['preferredposition1']}) to position {position_id}")

    # Handle backup goalkeeper
    goalkeepers = [player for player in available_players if player['preferredposition1'] == 0]
    backup_goalkeeper = None
    if goalkeepers:
        goalkeepers.sort(key=lambda p: -p['overallrating'])
        backup_goalkeeper = goalkeepers[0]
        available_players.remove(backup_goalkeeper)

    remaining_players = sorted(available_players, key=lambda p: -p['overallrating'])
    return assigned_players, backup_goalkeeper, remaining_players


def test_sort_players():
    """Test the sort_players function with a problematic scenario"""
    
    # Test data simulating the problematic case: CDM being assigned to ST
    test_players = [
        {'name': 'Innocent Chiedozie Odoh', 'playerid': '16', 'overallrating': 75, 'preferredposition1': 10},  # CDM - should not go to ST
        {'name': 'Goalkeeper Player', 'playerid': '1', 'overallrating': 70, 'preferredposition1': 0},  # GK
        {'name': 'Center Back 1', 'playerid': '2', 'overallrating': 72, 'preferredposition1': 5},  # CB
        {'name': 'Center Back 2', 'playerid': '3', 'overallrating': 71, 'preferredposition1': 5},  # CB
        {'name': 'Left Back', 'playerid': '4', 'overallrating': 69, 'preferredposition1': 7},  # LB
        {'name': 'Right Back', 'playerid': '5', 'overallrating': 68, 'preferredposition1': 3},  # RB
        {'name': 'Central Midfielder 1', 'playerid': '6', 'overallrating': 73, 'preferredposition1': 14},  # CM
        {'name': 'Central Midfielder 2', 'playerid': '7', 'overallrating': 70, 'preferredposition1': 14},  # CM
        {'name': 'Right Midfielder', 'playerid': '8', 'overallrating': 67, 'preferredposition1': 12},  # RM
        {'name': 'Left Midfielder', 'playerid': '9', 'overallrating': 66, 'preferredposition1': 16},  # LM
        {'name': 'Striker 1', 'playerid': '10', 'overallrating': 74, 'preferredposition1': 25},  # ST
        {'name': 'Striker 2', 'playerid': '11', 'overallrating': 72, 'preferredposition1': 25},  # ST
        {'name': 'Winger', 'playerid': '12', 'overallrating': 65, 'preferredposition1': 23},  # RW
    ]
    
    # 4-4-2 formation positions needed (index -> position_id)
    positions_needed = {
        0: 0,   # GK
        1: 3,   # RB  
        2: 5,   # CB
        3: 5,   # CB
        4: 7,   # LB
        5: 12,  # RM
        6: 14,  # CM
        7: 14,  # CM
        8: 16,  # LM
        9: 25,  # ST
        10: 25  # ST
    }
    
    print("=== Testing Improved Player Assignment Algorithm ===")
    print("\nInput players:")
    for i, player in enumerate(test_players):
        print(f"{i+1:2d}. {player['name']:25} | OVR: {player['overallrating']:2d} | Pos: {player['preferredposition1']:2d}")
    
    print(f"\nPositions needed for 4-4-2 formation:")
    position_names = {0: 'GK', 3: 'RB', 5: 'CB', 7: 'LB', 12: 'RM', 14: 'CM', 16: 'LM', 25: 'ST'}
    for idx, pos_id in positions_needed.items():
        print(f"Position {idx}: {position_names.get(pos_id, f'Pos {pos_id}')}")
    
    # Run the algorithm
    assigned, backup_gk, remaining = sort_players(test_players, positions_needed)
    
    print(f"\n=== RESULTS ===")
    print("Starting XI assignments:")
    for i in range(11):
        player = assigned.get(i)
        if player:
            pos_name = position_names.get(positions_needed.get(i, -1), f"Pos {positions_needed.get(i, -1)}")
            print(f"Position {i} ({pos_name:2s}): {player['name']:25} | OVR: {player['overallrating']:2d} | Player Pos: {player['preferredposition1']:2d}")
        else:
            print(f"Position {i}: [UNASSIGNED]")
    
    if backup_gk:
        print(f"\nBackup GK: {backup_gk['name']} | OVR: {backup_gk['overallrating']}")
    
    print(f"\nRemaining players ({len(remaining)}):")
    for player in remaining:
        print(f"  {player['name']:25} | OVR: {player['overallrating']:2d} | Pos: {player['preferredposition1']:2d}")
    
    # Check for the specific problem: CDM assigned to ST
    print(f"\n=== VALIDATION ===")
    problems_found = False
    
    for i in range(11):
        player = assigned.get(i)
        if player:
            required_pos = positions_needed.get(i, -1)
            player_pos = player['preferredposition1']
            
            # Check for major incompatibilities
            if player_pos == 10 and required_pos == 25:  # CDM assigned to ST
                print(f"❌ PROBLEM: {player['name']} (CDM, pos {player_pos}) assigned to ST (pos {required_pos})")
                problems_found = True
            elif player_pos == 0 and required_pos != 0:  # GK assigned to outfield
                print(f"❌ PROBLEM: {player['name']} (GK, pos {player_pos}) assigned to outfield (pos {required_pos})")
                problems_found = True
            elif player_pos != 0 and required_pos == 0:  # Outfield assigned to GK
                print(f"❌ PROBLEM: {player['name']} (outfield, pos {player_pos}) assigned to GK (pos {required_pos})")
                problems_found = True
            else:
                print(f"✅ OK: {player['name']} (pos {player_pos}) assigned to (pos {required_pos})")
    
    if not problems_found:
        print(f"\n🎉 SUCCESS: No major position compatibility problems found!")
    else:
        print(f"\n⚠️  Some position compatibility issues remain.")
    
    return assigned, backup_gk, remaining


if __name__ == "__main__":
    test_sort_players()