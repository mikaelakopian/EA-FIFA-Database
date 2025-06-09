import json

with open('/root/EA/server/projects/armenia/data/fifa_ng_db/default_teamsheets.json') as f:
    data = json.load(f)

# Find team with playerid0='300559' (Livyi Bereg Kyiv)
for team in data:
    if team.get('playerid0') == '300559':
        print('Team:', team.get('teamid'))
        
        # Get all players (starting 11 + subs)
        all_players = []
        for i in range(52):  # Check all possible playerid slots
            pid = team.get(f'playerid{i}')
            if pid and pid != "-1":
                all_players.append((i, pid))
        
        print(f'Total players in teamsheet: {len(all_players)}')
        print('Starting XI:')
        for pos, pid in all_players[:11]:
            print(f'  playerid{pos}: {pid}')
        print('Substitutes:')
        for pos, pid in all_players[11:]:
            print(f'  playerid{pos}: {pid}')
        
        # Get just the player IDs
        player_ids = [pid for pos, pid in all_players]
        print(f'\nAll player IDs: {player_ids}')
        break