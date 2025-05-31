#!/usr/bin/env python3
"""
Test script for PlayerAttributesCalculationModel
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'server'))

from server.endpoints.PlayerAttributesCalculationModel import generate_player_attributes

def test_player_generation():
    """Test player attribute generation for different positions"""
    
    # Test different positions
    test_cases = [
        ("0", 85, "Goalkeeper"),
        ("14", 75, "Center Midfielder"),
        ("25", 80, "Striker"),
        ("23", 78, "Right Winger"),
        ("4", 72, "Center Back")
    ]
    
    print("Testing Player Attribute Generation")
    print("=" * 50)
    
    for position, target_rating, position_name in test_cases:
        print(f"\n🎯 Testing {position_name} (Position {position}) - Target Rating: {target_rating}")
        print("-" * 40)
        
        try:
            attributes = generate_player_attributes(
                preferred_position=position,
                target_overall=target_rating,
                international_reputation=2
            )
            
            actual_rating = attributes.get('overall_rating', 0)
            print(f"✅ Generated Rating: {actual_rating} (Target: {target_rating})")
            print(f"📍 Position: {attributes.get('preferred_position1', 'N/A')}")
            print(f"🌟 International Rep: {attributes.get('international_reputation', 'N/A')}")
            
            # Show key attributes for this position
            if position == "0":  # GK
                print(f"🥅 GK Diving: {attributes.get('gkDiving', 0)}")
                print(f"🥅 GK Handling: {attributes.get('gkHandling', 0)}")
                print(f"🥅 GK Reflexes: {attributes.get('gkReflexes', 0)}")
            elif position in ["4", "5", "6"]:  # CB
                print(f"🛡️ Marking: {attributes.get('marking', 0)}")
                print(f"🛡️ Standing Tackle: {attributes.get('standingTackle', 0)}")
                print(f"🛡️ Heading: {attributes.get('heading', 0)}")
            elif position in ["14", "15"]:  # CM
                print(f"⚽ Short Passing: {attributes.get('shortPassing', 0)}")
                print(f"⚽ Vision: {attributes.get('vision', 0)}")
                print(f"⚽ Ball Control: {attributes.get('ballControl', 0)}")
            else:  # Attacking positions
                print(f"⚽ Finishing: {attributes.get('finishing', 0)}")
                print(f"⚽ Dribbling: {attributes.get('dribbling', 0)}")
                print(f"⚽ Positioning: {attributes.get('positioning', 0)}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
    print("\n" + "=" * 50)
    print("Test completed!")

if __name__ == "__main__":
    test_player_generation()