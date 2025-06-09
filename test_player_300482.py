#!/usr/bin/env python3
"""
Test script to verify player 300482 data
"""

import json
import requests
import sys

def test_player_300482():
    print("=== Testing Player 300482 ===\n")
    
    # Test 1: Check if player exists in players.json
    print("1. Checking players.json...")
    try:
        with open('/root/EA/server/projects/armenia/data/fifa_ng_db/players.json', 'r') as f:
            players = json.load(f)
        
        player_300482 = next((p for p in players if p.get('playerid') == '300482'), None)
        if player_300482:
            print("   ✅ Player 300482 found in players.json")
            print(f"   - Overall Rating: {player_300482.get('overallrating')}")
            print(f"   - Position: {player_300482.get('preferredposition1')}")
            print(f"   - First Name ID: {player_300482.get('firstnameid')}")
            print(f"   - Last Name ID: {player_300482.get('lastnameid')}")
            print(f"   - Common Name ID: {player_300482.get('commonnameid')}")
        else:
            print("   ❌ Player 300482 NOT found in players.json")
            return False
    except Exception as e:
        print(f"   ❌ Error reading players.json: {e}")
        return False
    
    # Test 2: Check playernames.json
    print("\n2. Checking playernames.json...")
    try:
        with open('/root/EA/server/projects/armenia/data/fifa_ng_db/playernames.json', 'r') as f:
            playernames = json.load(f)
        
        # Check name IDs
        name_ids = [player_300482['firstnameid'], player_300482['lastnameid'], player_300482['commonnameid']]
        names = {}
        
        for name_entry in playernames:
            if name_entry.get('nameid') in name_ids:
                names[name_entry.get('nameid')] = name_entry.get('name')
        
        print(f"   ✅ Name lookup results:")
        print(f"   - First Name ({player_300482['firstnameid']}): {names.get(player_300482['firstnameid'], 'NOT FOUND')}")
        print(f"   - Last Name ({player_300482['lastnameid']}): {names.get(player_300482['lastnameid'], 'NOT FOUND')}")
        print(f"   - Common Name ({player_300482['commonnameid']}): {names.get(player_300482['commonnameid'], 'NOT FOUND')}")
        
    except Exception as e:
        print(f"   ❌ Error reading playernames.json: {e}")
        return False
    
    # Test 3: Check teamplayerlinks.json
    print("\n3. Checking teamplayerlinks.json...")
    try:
        with open('/root/EA/server/projects/armenia/data/fifa_ng_db/teamplayerlinks.json', 'r') as f:
            teamplayerlinks = json.load(f)
        
        player_links = [link for link in teamplayerlinks if link.get('playerid') == '300482']
        if player_links:
            link = player_links[0]
            print("   ✅ Player 300482 found in teamplayerlinks.json")
            print(f"   - Team ID: {link.get('teamid')}")
            print(f"   - Jersey Number: {link.get('jerseynumber')}")
            print(f"   - Position: {link.get('position')}")
        else:
            print("   ❌ Player 300482 NOT found in teamplayerlinks.json")
            return False
    except Exception as e:
        print(f"   ❌ Error reading teamplayerlinks.json: {e}")
        return False
    
    # Test 4: Check default_teamsheets.json
    print("\n4. Checking default_teamsheets.json...")
    try:
        with open('/root/EA/server/projects/armenia/data/fifa_ng_db/default_teamsheets.json', 'r') as f:
            teamsheets = json.load(f)
        
        found_in_teamsheet = False
        for sheet in teamsheets:
            for key, value in sheet.items():
                if value == '300482':
                    print(f"   ✅ Player 300482 found in teamsheet")
                    print(f"   - Team ID: {sheet.get('teamid')}")
                    print(f"   - Position: {key}")
                    found_in_teamsheet = True
                    break
            if found_in_teamsheet:
                break
        
        if not found_in_teamsheet:
            print("   ❌ Player 300482 NOT found in any teamsheet")
            return False
    except Exception as e:
        print(f"   ❌ Error reading teamsheets.json: {e}")
        return False
    
    # Test 5: Test API endpoint
    print("\n5. Testing API endpoint...")
    try:
        url = 'http://localhost:8000/players/by-ids?project_id=armenia'
        data = {'player_ids': ['300482']}
        
        response = requests.post(url, json=data, timeout=10)
        if response.status_code == 200:
            api_players = response.json()
            if api_players and len(api_players) > 0:
                print("   ✅ Player 300482 found via API")
                api_player = api_players[0]
                print(f"   - Overall Rating: {api_player.get('overallrating')}")
                print(f"   - First Name ID: {api_player.get('firstnameid')}")
                print(f"   - Last Name ID: {api_player.get('lastnameid')}")
            else:
                print("   ❌ Player 300482 NOT found via API")
                return False
        else:
            print(f"   ❌ API request failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ⚠️ Server not running - skipping API test")
    except Exception as e:
        print(f"   ❌ Error testing API: {e}")
        return False
    
    print("\n=== All tests passed! Player 300482 data is correct ===")
    return True

if __name__ == "__main__":
    success = test_player_300482()
    sys.exit(0 if success else 1)