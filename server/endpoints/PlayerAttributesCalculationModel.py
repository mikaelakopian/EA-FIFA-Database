import random
import math
from typing import Dict, Any, Tuple


class PlayerAttributesCalculator:
    """
    Calculates player attributes based on position and target overall rating.
    Based on FIFA position calculation formulas.
    """
    
    def __init__(self):
        # Position groups mapping
        self.position_groups = {
            'gk': ['0'],                          # Goalkeeper
            'sw': ['1'],                          # Sweeper
            'rwb': ['2', '8'],                    # Right/Left Wing Back
            'rb': ['3', '7'],                     # Right/Left Back
            'rcb': ['4', '5', '6'],              # Center Backs
            'rdm': ['9', '10', '11'],            # Defensive Midfielders
            'rm': ['12', '16'],                  # Right/Left Midfielders
            'rcm': ['13', '14', '15'],           # Center Midfielders
            'ram': ['17', '18', '19'],           # Attacking Midfielders
            'rf': ['20', '21', '22'],            # Center Forwards
            'rw': ['23', '27'],                  # Right/Left Wingers
            'rs': ['24', '25', '26']             # Strikers
        }
        
        # Position calculation weights
        self.position_weights = {
            'gk': {
                'reactions': 0.11,
                'gkDiving': 0.21,
                'gkHandling': 0.21,
                'gkKicking': 0.05,
                'gkPositioning': 0.21,
                'gkReflexes': 0.21
            },
            'sw': {
                'jumping': 0.04,
                'strength': 0.10,
                'reactions': 0.05,
                'aggression': 0.08,
                'interceptions': 0.08,
                'ballControl': 0.05,
                'heading': 0.10,
                'shortPassing': 0.05,
                'marking': 0.15,
                'standingTackle': 0.15,
                'slidingTackle': 0.15
            },
            'rwb': {
                'acceleration': 0.04,
                'sprintSpeed': 0.06,
                'stamina': 0.10,
                'reactions': 0.08,
                'interceptions': 0.12,
                'ballControl': 0.08,
                'crossing': 0.12,
                'dribbling': 0.04,
                'shortPassing': 0.10,
                'marking': 0.07,
                'standingTackle': 0.08,
                'slidingTackle': 0.11
            },
            'rb': {
                'acceleration': 0.05,
                'sprintSpeed': 0.07,
                'stamina': 0.08,
                'reactions': 0.08,
                'interceptions': 0.12,
                'ballControl': 0.07,
                'crossing': 0.09,
                'heading': 0.04,
                'shortPassing': 0.07,
                'marking': 0.08,
                'standingTackle': 0.11,
                'slidingTackle': 0.14
            },
            'rcb': {
                'sprintSpeed': 0.02,
                'jumping': 0.03,
                'strength': 0.10,
                'reactions': 0.05,
                'aggression': 0.07,
                'interceptions': 0.13,
                'ballControl': 0.04,
                'heading': 0.10,
                'shortPassing': 0.05,
                'marking': 0.14,
                'standingTackle': 0.17,
                'slidingTackle': 0.10
            },
            'rdm': {
                'stamina': 0.06,
                'strength': 0.04,
                'reactions': 0.07,
                'aggression': 0.05,
                'interceptions': 0.14,
                'vision': 0.04,
                'ballControl': 0.10,
                'longPassing': 0.10,
                'shortPassing': 0.14,
                'marking': 0.09,
                'standingTackle': 0.12,
                'slidingTackle': 0.05
            },
            'rm': {
                'acceleration': 0.07,
                'sprintSpeed': 0.06,
                'stamina': 0.05,
                'reactions': 0.07,
                'positioning': 0.08,
                'vision': 0.07,
                'ballControl': 0.13,
                'crossing': 0.10,
                'dribbling': 0.15,
                'finishing': 0.06,
                'longPassing': 0.05,
                'shortPassing': 0.11
            },
            'rcm': {
                'stamina': 0.06,
                'reactions': 0.08,
                'interceptions': 0.05,
                'positioning': 0.06,
                'vision': 0.13,
                'ballControl': 0.14,
                'dribbling': 0.07,
                'finishing': 0.02,
                'longPassing': 0.13,
                'shortPassing': 0.17,
                'longShots': 0.04,
                'standingTackle': 0.05
            },
            'ram': {
                'acceleration': 0.04,
                'sprintSpeed': 0.03,
                'agility': 0.03,
                'reactions': 0.07,
                'positioning': 0.09,
                'vision': 0.14,
                'ballControl': 0.15,
                'dribbling': 0.13,
                'finishing': 0.07,
                'longPassing': 0.04,
                'shortPassing': 0.16,
                'longShots': 0.05
            },
            'rf': {
                'acceleration': 0.05,
                'sprintSpeed': 0.05,
                'reactions': 0.09,
                'positioning': 0.13,
                'vision': 0.08,
                'ballControl': 0.15,
                'dribbling': 0.14,
                'finishing': 0.11,
                'heading': 0.02,
                'shortPassing': 0.09,
                'shotPower': 0.05,
                'longShots': 0.04
            },
            'rw': {
                'acceleration': 0.07,
                'sprintSpeed': 0.06,
                'agility': 0.03,
                'reactions': 0.07,
                'positioning': 0.09,
                'vision': 0.06,
                'ballControl': 0.14,
                'crossing': 0.09,
                'dribbling': 0.16,
                'finishing': 0.10,
                'shortPassing': 0.09,
                'longShots': 0.04
            },
            'rs': {
                'acceleration': 0.04,
                'sprintSpeed': 0.05,
                'strength': 0.05,
                'reactions': 0.08,
                'positioning': 0.13,
                'ballControl': 0.10,
                'dribbling': 0.07,
                'finishing': 0.18,
                'heading': 0.10,
                'shortPassing': 0.05,
                'shotPower': 0.10,
                'longShots': 0.03,
                'volleys': 0.02
            }
        }
        
        # All possible attributes
        self.all_attributes = [
            'acceleration', 'sprintSpeed', 'agility', 'reactions', 'ballControl', 'dribbling',
            'finishing', 'heading', 'shortPassing', 'volleys', 'curve', 'fkAccuracy',
            'longPassing', 'shotPower', 'longShots', 'crossing', 'jumping', 'stamina',
            'strength', 'aggression', 'interceptions', 'positioning', 'vision', 'penalties',
            'composure', 'marking', 'standingTackle', 'slidingTackle', 'gkDiving', 'gkHandling',
            'gkKicking', 'gkPositioning', 'gkReflexes'
        ]

    def get_position_group(self, position: str) -> str:
        """Get position group key for given position number."""
        for group, positions in self.position_groups.items():
            if position in positions:
                return group
        return 'rcm'  # Default to center midfielder

    def calculate_international_reputation_bonus(self, position: str, base_rating: int, international_reputation: int = 1) -> int:
        """Calculate international reputation bonus."""
        # Attacking positions get less bonus
        attacking_positions = ['20', '21', '22', '23', '27']
        max_bonus = 2 if position in attacking_positions else 3
        
        if international_reputation > 2:
            bonus = 3
        else:
            bonus = 2
            
        return min(max_bonus, bonus)

    def generate_attributes_for_position(self, preferred_position: str, target_overall: int, international_reputation: int = 1) -> Dict[str, Any]:
        """
        Generate player attributes based on position and target overall rating.
        
        Args:
            preferred_position: Position number as string (0-27)
            target_overall: Target overall rating (1-99)
            international_reputation: International reputation (1-5)
            
        Returns:
            Dictionary with all player attributes
        """
        position_group = self.get_position_group(preferred_position)
        weights = self.position_weights.get(position_group, self.position_weights['rcm'])
        
        # Calculate IR bonus
        ir_bonus = self.calculate_international_reputation_bonus(preferred_position, target_overall, international_reputation)
        base_target = target_overall - ir_bonus
        
        # Initialize attributes
        attributes = {}
        
        # Generate base attributes for non-position specific ones
        for attr in self.all_attributes:
            if attr not in weights:
                # Generate random base value for non-weighted attributes
                if attr.startswith('gk') and position_group != 'gk':
                    # Non-GK gets low GK stats
                    attributes[attr] = random.randint(1, 15)
                elif not attr.startswith('gk') and position_group == 'gk':
                    # GK gets varied outfield stats
                    attributes[attr] = random.randint(15, 65)
                else:
                    # Regular attributes
                    attributes[attr] = random.randint(25, 85)
        
        # Use iterative approach to reach target rating
        max_iterations = 1000
        tolerance = 1
        
        for iteration in range(max_iterations):
            # Generate weighted attributes
            total_weighted = 0
            for attr, weight in weights.items():
                if iteration == 0:
                    # Initial generation
                    if attr.startswith('gk') and position_group != 'gk':
                        attributes[attr] = random.randint(1, 15)
                    elif not attr.startswith('gk') and position_group == 'gk':
                        attributes[attr] = random.randint(15, 65)
                    else:
                        attributes[attr] = random.randint(30, 95)
                        
                total_weighted += attributes[attr] * weight
            
            current_rating = round(total_weighted)
            difference = base_target - current_rating
            
            if abs(difference) <= tolerance:
                break
                
            # Adjust attributes based on difference
            adjustment_factor = difference / len(weights)
            
            for attr in weights.keys():
                current_val = attributes[attr]
                adjustment = random.uniform(0.5, 1.5) * adjustment_factor
                new_val = current_val + adjustment
                
                # Keep within bounds
                if attr.startswith('gk') and position_group != 'gk':
                    attributes[attr] = max(1, min(15, int(new_val)))
                else:
                    attributes[attr] = max(1, min(99, int(new_val)))
        
        # Final calculation with IR bonus
        final_weighted = sum(attributes[attr] * weight for attr, weight in weights.items())
        final_rating = round(final_weighted) + ir_bonus
        
        # Add calculated ratings
        result = {
            'overall_rating': min(99, max(1, final_rating)),
            'preferred_position1': preferred_position,
            'international_reputation': international_reputation,
        }
        
        # Add all attributes
        for attr in self.all_attributes:
            result[attr] = max(1, min(99, int(attributes[attr])))
            
        return result

    def calculate_position_rating(self, attributes: Dict[str, int], position: str) -> int:
        """Calculate rating for a specific position given attributes."""
        position_group = self.get_position_group(position)
        weights = self.position_weights.get(position_group, self.position_weights['rcm'])
        
        rating = sum(attributes.get(attr, 50) * weight for attr, weight in weights.items())
        return round(rating)


# Global instance
calculator = PlayerAttributesCalculator()


def calculate_balance(position: str, agility: int, strength: int, dribbling: int, ball_control: int, overall_rating: int) -> int:
    """
    Calculate balance attribute based on position and other player attributes.
    
    Balance is important for:
    - Technical players (dribbling, ball control)
    - Agile players who need stability while moving
    - Position-specific requirements
    
    Args:
        position: FIFA position code (0-27)
        agility: Player agility rating
        strength: Player strength rating  
        dribbling: Player dribbling rating
        ball_control: Player ball control rating
        overall_rating: Player overall rating
        
    Returns:
        int: Balance rating (1-99)
    """
    
    # Position-based balance importance multipliers
    position_multipliers = {
        # Goalkeepers - moderate balance for distribution
        "0": 0.7,
        
        # Defenders - need balance for aerial duels and tackling
        "1": 0.8,   # Sweeper
        "2": 0.85,  # RWB
        "3": 0.8,   # RB
        "4": 0.75,  # CB
        "5": 0.75,  # CB
        "6": 0.75,  # CB
        "7": 0.8,   # LB
        "8": 0.85,  # LWB
        
        # Defensive Midfielders - need balance for pressing and passing
        "9": 0.85,   # CDM
        "10": 0.85,  # CDM
        "11": 0.85,  # CDM
        
        # Wide Midfielders - high balance for dribbling and crossing
        "12": 0.9,   # RM
        "16": 0.9,   # LM
        
        # Central Midfielders - very important for ball control and pressing
        "13": 0.9,   # CM
        "14": 0.9,   # CM
        "15": 0.9,   # CM
        
        # Attacking Midfielders - crucial for dribbling and tight spaces
        "17": 0.95,  # CAM
        "18": 0.95,  # CAM
        "19": 0.95,  # CAM
        
        # Forwards - important for ball control and finishing
        "20": 0.85,  # CF
        "21": 0.85,  # CF
        "22": 0.85,  # CF
        
        # Wingers - very high balance for dribbling and agility
        "23": 0.95,  # RW
        "27": 0.95,  # LW
        
        # Strikers - need balance for finishing and holding up play
        "24": 0.8,   # ST
        "25": 0.8,   # ST
        "26": 0.8,   # ST
    }
    
    # Get position multiplier (default to 0.8 if position not found)
    pos_multiplier = position_multipliers.get(position, 0.8)
    
    # Calculate base balance from related attributes
    # Formula: weighted average of agility, dribbling, ball_control with strength factor
    # Agility is most important (40%), then dribbling (25%), ball_control (25%), strength adds stability (10%)
    technical_component = (agility * 0.4 + dribbling * 0.25 + ball_control * 0.25 + strength * 0.1)
    
    # Apply position multiplier
    position_adjusted_balance = technical_component * pos_multiplier
    
    # Ensure balance correlates somewhat with overall rating (but not too strictly)
    # Higher overall players should generally have better balance
    overall_factor = 0.3 + (overall_rating / 100) * 0.4  # Factor between 0.3 and 0.7
    
    # Final calculation
    final_balance = position_adjusted_balance * overall_factor + overall_rating * 0.3
    
    # Add small random variation for realism (±3 points)
    variation = random.randint(-3, 3)
    final_balance += variation
    
    # Ensure balance stays within FIFA bounds (1-99)
    final_balance = max(1, min(99, int(final_balance)))
    
    return final_balance


def generate_player_attributes(preferred_position: str, target_overall: int, international_reputation: int = 1) -> Dict[str, Any]:
    """
    Generate player attributes for given position and overall rating.
    
    Args:
        preferred_position: Position number as string (0-27)
        target_overall: Target overall rating (1-99) 
        international_reputation: International reputation (1-5)
        
    Returns:
        Dictionary with all player attributes
    """
    return calculator.generate_attributes_for_position(preferred_position, target_overall, international_reputation)