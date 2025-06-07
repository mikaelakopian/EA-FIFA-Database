import { memo, useState, useEffect } from "react";
import { Card, CardBody, Chip, Avatar, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

interface Player {
  playerid: string;
  name?: string;
  position?: string;
  overall_rating?: number;
  potential?: number;
  commonname?: string;
  firstnameid?: string;
  lastnameid?: string;
  jerseynumber?: string;
}

interface DetailedPlayer {
  playerid: string;
  firstnameid?: string;
  lastnameid?: string;
  commonnameid?: string;
  overallrating?: string;
  potential?: string;
  preferredposition1?: string;
  jerseynumber?: string;
  height?: string;
  weight?: string;
  nationality?: string;
  [key: string]: any;
}

interface FormationData {
  formationname?: string;
  position0?: string;
  position1?: string;
  position2?: string;
  position3?: string;
  position4?: string;
  position5?: string;
  position6?: string;
  position7?: string;
  position8?: string;
  position9?: string;
  position10?: string;
  offset0x?: string;
  offset0y?: string;
  offset1x?: string;
  offset1y?: string;
  offset2x?: string;
  offset2y?: string;
  offset3x?: string;
  offset3y?: string;
  offset4x?: string;
  offset4y?: string;
  offset5x?: string;
  offset5y?: string;
  offset6x?: string;
  offset6y?: string;
  offset7x?: string;
  offset7y?: string;
  offset8x?: string;
  offset8y?: string;
  offset9x?: string;
  offset9y?: string;
  offset10x?: string;
  offset10y?: string;
}

interface TeamSheetData {
  playerid0?: string;
  playerid1?: string;
  playerid2?: string;
  playerid3?: string;
  playerid4?: string;
  playerid5?: string;
  playerid6?: string;
  playerid7?: string;
  playerid8?: string;
  playerid9?: string;
  playerid10?: string;
  playerid11?: string; // Backup goalkeeper
  [key: string]: string | undefined;
}

interface FootballPitchProps {
  formation: FormationData;
  teamSheet: TeamSheetData;
  players: Player[];
  teamName: string;
  playerNames?: { [nameId: string]: string };
  projectId?: string;
}

const POSITION_NAMES: { [key: string]: string } = {
  "0": "GK",   // Goalkeeper
  "3": "RB",   // Right Back
  "5": "CB",   // Center Back
  "7": "LB",   // Left Back
  "10": "CDM", // Central Defensive Midfielder
  "12": "RM",  // Right Midfielder
  "14": "CM",  // Central Midfielder
  "16": "LM",  // Left Midfielder
  "25": "ST",  // Striker
};

const POSITION_COLORS: { [key: string]: string } = {
  "GK": "bg-yellow-500",
  "LB": "bg-blue-500", "CB": "bg-blue-500", "RB": "bg-blue-500",
  "CDM": "bg-green-500", "LM": "bg-green-500", "CM": "bg-green-500", "RM": "bg-green-500",
  "ST": "bg-red-500",
};

function FootballPitch({ formation, teamSheet, players, teamName, playerNames = {}, projectId }: FootballPitchProps) {
  const [detailedPlayers, setDetailedPlayers] = useState<{ [playerid: string]: DetailedPlayer }>({});
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  console.log(`[FootballPitch] Rendering for team: ${teamName}`, {
    formation: formation?.formationname || 'unknown',
    playersCount: players.length,
    teamSheetPlayerIds: Object.keys(teamSheet).filter(key => key.startsWith('playerid')).slice(0, 11).map(key => ({ key, id: teamSheet[key] })),
    firstFewPlayers: players.slice(0, 3).map(p => ({ id: p.playerid, name: p.name })),
    hasPlayerNames: Object.keys(playerNames).length > 0,
    projectId,
    detailedPlayersCount: Object.keys(detailedPlayers).length,
    teamSheetTeamId: teamSheet.teamid
  });

  // Fetch detailed player information from the database
  useEffect(() => {
    const fetchDetailedPlayers = async () => {
      if (!projectId || !teamSheet) {
        console.log('[FootballPitch] Missing projectId or teamSheet, skipping detailed player fetch');
        return;
      }

      // Get all player IDs from teamsheet (starting 11 + subs)
      const playerIds = Object.keys(teamSheet)
        .filter(key => key.startsWith('playerid'))
        .map(key => teamSheet[key])
        .filter(id => id && id !== "-1")
        .slice(0, 22); // Get first 22 players (11 starting + 11 subs)

      if (playerIds.length === 0) {
        console.log('[FootballPitch] No valid player IDs found in teamsheet');
        return;
      }

      console.log(`[FootballPitch] Fetching detailed data for ${playerIds.length} players:`, playerIds.slice(0, 5));
      setIsLoadingPlayers(true);

      try {
        // Fetch all players for this project
        const response = await fetch(`http://localhost:8000/players?project_id=${projectId}&limit=500`);
        if (!response.ok) {
          throw new Error(`Failed to fetch players: ${response.status}`);
        }

        const allPlayers: DetailedPlayer[] = await response.json();
        console.log(`[FootballPitch] Received ${allPlayers.length} players from API`);

        // Create a map of relevant players
        const playersMap: { [playerid: string]: DetailedPlayer } = {};
        playerIds.forEach(playerId => {
          if (!playerId) return;
          const player = allPlayers.find(p => p.playerid === playerId);
          if (player) {
            playersMap[playerId] = player;
            console.log(`[FootballPitch] Found detailed data for player ${playerId}:`, {
              firstnameid: player.firstnameid,
              lastnameid: player.lastnameid,
              commonnameid: player.commonnameid,
              overallrating: player.overallrating,
              nationality: player.nationality
            });
          } else {
            console.log(`[FootballPitch] No detailed data found for player ${playerId}`);
          }
        });

        setDetailedPlayers(playersMap);
        console.log(`[FootballPitch] Successfully loaded detailed data for ${Object.keys(playersMap).length} players`);
      } catch (error) {
        console.error('[FootballPitch] Error fetching detailed players:', error);
      } finally {
        setIsLoadingPlayers(false);
      }
    };

    fetchDetailedPlayers();
  }, [projectId, teamSheet]);

  // Enhanced helper function to get player name using detailed database data
  const getPlayerName = (player: Player, playerId?: string): string => {
    const targetPlayerId = playerId || player.playerid;
    const detailedPlayer = detailedPlayers[targetPlayerId];
    
    console.log(`[FootballPitch] Getting name for player ${targetPlayerId}:`, {
      hasDetailedPlayer: !!detailedPlayer,
      detailedFirstNameId: detailedPlayer?.firstnameid,
      detailedLastNameId: detailedPlayer?.lastnameid,
      detailedCommonNameId: detailedPlayer?.commonnameid,
      fallbackName: player.name,
      hasPlayerNames: Object.keys(playerNames).length > 0,
      commonname: player.commonname,
      firstnameid: player.firstnameid,
      lastnameid: player.lastnameid
    });

    // If we have detailed player data, use it first
    if (detailedPlayer && Object.keys(playerNames).length > 0) {
      // Try common name first if available
      if (detailedPlayer.commonnameid && detailedPlayer.commonnameid !== "0") {
        const commonName = playerNames[detailedPlayer.commonnameid];
        if (commonName && commonName.trim()) {
          console.log(`[FootballPitch] Using detailed commonname: ${commonName}`);
          return commonName;
        }
      }
      
      // Construct name from detailed firstnameid/lastnameid
      const firstName = detailedPlayer.firstnameid ? playerNames[detailedPlayer.firstnameid] : '';
      const lastName = detailedPlayer.lastnameid ? playerNames[detailedPlayer.lastnameid] : '';
      
      if (firstName || lastName) {
        const fullName = `${firstName || ''} ${lastName || ''}`.trim();
        if (fullName) {
          console.log(`[FootballPitch] Constructed name from detailed data: ${fullName} (${detailedPlayer.firstnameid}->${firstName}, ${detailedPlayer.lastnameid}->${lastName})`);
          return fullName;
        }
      }
    }

    // Fallback to original logic if detailed data isn't available
    // First priority: Use commonname if available
    if (player.commonname && player.commonname.trim()) {
      console.log(`[FootballPitch] Using fallback commonname: ${player.commonname}`);
      return player.commonname;
    }
    
    // Second priority: Construct name from playerNames lookup (original logic)
    if (Object.keys(playerNames).length > 0 && (player.firstnameid || player.lastnameid)) {
      const firstName = player.firstnameid ? playerNames[player.firstnameid] : '';
      const lastName = player.lastnameid ? playerNames[player.lastnameid] : '';
      
      if (firstName || lastName) {
        const fullName = `${firstName || ''} ${lastName || ''}`.trim();
        console.log(`[FootballPitch] Constructed name from fallback data: ${fullName}`);
        return fullName;
      }
    }
    
    // Final fallback - only return real names, not fake ones
    console.log(`[FootballPitch] No real name data found for player ${targetPlayerId}`);
    return player.name && player.name.trim() && !player.name.startsWith('Player ') ? player.name : '';
  };

  // Enhanced helper function to get jersey number using detailed database data
  const getJerseyNumber = (player: Player, index: number, playerId?: string): string => {
    const targetPlayerId = playerId || player.playerid;
    const detailedPlayer = detailedPlayers[targetPlayerId];
    
    console.log(`[FootballPitch] Getting jersey number for player ${targetPlayerId}:`, {
      hasDetailedPlayer: !!detailedPlayer,
      detailedJersey: detailedPlayer?.jerseynumber,
      fallbackJersey: player.jerseynumber,
      index,
      allPlayerKeys: Object.keys(player)
    });
    
    // Check detailed player data first
    if (detailedPlayer) {
      const detailedJersey = detailedPlayer.jerseynumber;
      if (detailedJersey && detailedJersey !== "-1" && detailedJersey !== "0" && parseInt(detailedJersey) > 0) {
        console.log(`[FootballPitch] Using detailed jersey number: ${detailedJersey}`);
        return detailedJersey.toString();
      }
    }
    
    // Check various possible field names for jersey number in fallback player data
    const jerseyFields = ['jerseynumber', 'jersey_number', 'shirtNumber', 'shirt_number', 'number'];
    
    for (const field of jerseyFields) {
      const jerseyValue = (player as any)[field];
      if (jerseyValue && jerseyValue !== "-1" && jerseyValue !== "0" && parseInt(jerseyValue) > 0) {
        console.log(`[FootballPitch] Using fallback jersey number from ${field}: ${jerseyValue}`);
        return jerseyValue.toString();
      }
    }
    
    // No real jersey number found - return empty string instead of generating fake one
    console.log(`[FootballPitch] No real jersey number found for player ${targetPlayerId}`);
    return '';
  };

  // Enhanced helper function to get player overall rating using detailed database data
  const getPlayerOverallRating = (player: Player, playerId?: string): number | undefined => {
    const targetPlayerId = playerId || player.playerid;
    const detailedPlayer = detailedPlayers[targetPlayerId];
    
    // Try detailed player data first
    if (detailedPlayer?.overallrating) {
      const rating = parseInt(detailedPlayer.overallrating);
      if (!isNaN(rating) && rating > 0) {
        return rating;
      }
    }
    
    // Fallback to original player data
    return player.overall_rating;
  };

  // Enhanced helper function to get player potential using detailed database data
  const getPlayerPotential = (player: Player, playerId?: string): number | undefined => {
    const targetPlayerId = playerId || player.playerid;
    const detailedPlayer = detailedPlayers[targetPlayerId];
    
    // Try detailed player data first
    if (detailedPlayer?.potential) {
      const potential = parseInt(detailedPlayer.potential);
      if (!isNaN(potential) && potential > 0) {
        return potential;
      }
    }
    
    // Fallback to original player data
    return player.potential;
  };

  // Create a map of playerid to player data for quick lookup
  const playerMap = players.reduce((map, player) => {
    map[player.playerid] = player;
    return map;
  }, {} as { [key: string]: Player });

  // Get starting 11 players from teamsheet - use EXACT data from teamsheet without resorting
  const startingEleven = [];
  for (let i = 0; i <= 10; i++) {
    const playerIdKey = `playerid${i}` as keyof TeamSheetData;
    const playerId = teamSheet[playerIdKey];
    
    console.log(`[FootballPitch] Processing position ${i}: playerid=${playerId}`);
    
    if (playerId && playerId !== "-1") {
      const player = playerMap[playerId];
      const detailedPlayer = detailedPlayers[playerId];
      
      // Only include players that exist in either the players array OR detailed players from database
      if (player || detailedPlayer) {
        const positionKey = `position${i}` as keyof FormationData;
        const offsetXKey = `offset${i}x` as keyof FormationData;
        const offsetYKey = `offset${i}y` as keyof FormationData;
        
        const positionId = formation[positionKey];
        const positionName = positionId ? POSITION_NAMES[positionId] || "CM" : "CM";
        
        // Use real player data, prioritizing the players array, then detailed data
        const actualPlayer = player || {
          playerid: playerId,
          name: '',
          overall_rating: undefined,
          firstnameid: detailedPlayer?.firstnameid || '',
          lastnameid: detailedPlayer?.lastnameid || '',
          commonname: detailedPlayer?.commonnameid || ''
        };
        
        const enhancedOverallRating = getPlayerOverallRating(actualPlayer, playerId);
        const enhancedPotential = getPlayerPotential(actualPlayer, playerId);
        const enhancedPlayerName = getPlayerName(actualPlayer, playerId);
        const enhancedJerseyNumber = getJerseyNumber(actualPlayer, i, playerId);

        console.log(`[FootballPitch] Player ${i} data:`, {
          playerId,
          enhancedPlayerName,
          enhancedOverallRating,
          positionName,
          enhancedJerseyNumber
        });

        // Only add if we have meaningful data (name and rating)
        if (enhancedPlayerName && enhancedPlayerName.trim() && enhancedOverallRating) {
          startingEleven.push({
            index: i,
            player: {
              ...actualPlayer,
              overall_rating: enhancedOverallRating,
              potential: enhancedPotential || enhancedOverallRating
            },
            position: positionName,
            x: parseFloat(formation[offsetXKey] || "0.5") * 100, // Convert to percentage
            y: (1 - parseFloat(formation[offsetYKey] || "0.5")) * 100, // Invert Y and convert to percentage
            playerName: enhancedPlayerName,
            jerseyNumber: enhancedJerseyNumber,
          });
          
          console.log(`[FootballPitch] ✅ Added player ${i}: ID ${playerId}, position: ${positionName}, name: ${enhancedPlayerName}, rating: ${enhancedOverallRating}`);
        } else {
          console.log(`[FootballPitch] ❌ Skipping player ${i}: ID ${playerId}, insufficient real data (name: '${enhancedPlayerName}', rating: ${enhancedOverallRating})`);
        }
      } else {
        console.log(`[FootballPitch] ❌ Player ${i}: ID ${playerId}, no real player data found in players array or detailed players`);
      }
    } else {
      console.log(`[FootballPitch] Position ${i}: No player assigned (playerid=${playerId})`);
    }
  }

  // Get substitutes (players 11 and beyond - bench players) - only real players
  const substitutes = [];
  
  // Look for all players beyond the starting 11 in teamsheet
  for (let i = 11; i <= 30; i++) {
    const playerIdKey = `playerid${i}` as keyof TeamSheetData;
    const playerId = teamSheet[playerIdKey];
    if (playerId && playerId !== "-1") {
      const player = playerMap[playerId];
      const detailedPlayer = detailedPlayers[playerId];
      
      // Only include players that exist in either the players array OR detailed players from database
      if (player || detailedPlayer) {
        // Use real player data, prioritizing the players array, then detailed data
        const actualPlayer = player || {
          playerid: playerId,
          name: '',
          overall_rating: undefined,
          firstnameid: detailedPlayer?.firstnameid || '',
          lastnameid: detailedPlayer?.lastnameid || '',
          commonname: detailedPlayer?.commonnameid || ''
        };
        
        const enhancedOverallRating = getPlayerOverallRating(actualPlayer, playerId);
        const enhancedPotential = getPlayerPotential(actualPlayer, playerId);
        const enhancedPlayerName = getPlayerName(actualPlayer, playerId);
        const enhancedJerseyNumber = getJerseyNumber(actualPlayer, i, playerId);
        
        // Only add if we have meaningful data (name and rating)
        if (enhancedPlayerName && enhancedPlayerName.trim() && enhancedOverallRating) {
          const enhancedSubstitute = {
            ...actualPlayer,
            overall_rating: enhancedOverallRating,
            potential: enhancedPotential || enhancedOverallRating,
            enhancedName: enhancedPlayerName,
            enhancedJerseyNumber: enhancedJerseyNumber
          };
          
          substitutes.push(enhancedSubstitute);
          console.log(`[FootballPitch] Substitute ${i}: ID ${playerId}, real data found, name: ${enhancedPlayerName}, rating: ${enhancedOverallRating}`);
        } else {
          console.log(`[FootballPitch] Substitute ${i}: ID ${playerId}, insufficient real data, skipping`);
        }
      } else {
        console.log(`[FootballPitch] Substitute ${i}: ID ${playerId}, no real player data found, skipping`);
      }
    }
  }

  console.log(`[FootballPitch] Found ${substitutes.length} substitute players:`, {
    teamSheetPlayerIds: Object.keys(teamSheet).filter(key => key.startsWith('playerid')).map(key => ({ key, id: teamSheet[key] })),
    substitutePlayerIds: substitutes.map(s => ({ id: s.playerid, name: s.enhancedName })),
    totalPlayersInArray: players.length,
    startingElevenCount: startingEleven.length
  });

  return (
    <Card className="w-full">
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon icon="lucide:map" className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">
            {formation.formationname || "4-4-2"} Formation
          </h3>
          <Chip size="sm" color="primary" variant="flat">
            {teamName}
          </Chip>
          {isLoadingPlayers && (
            <Chip size="sm" color="warning" variant="flat" className="animate-pulse">
              Loading player data...
            </Chip>
          )}
          {Object.keys(detailedPlayers).length > 0 && (
            <Chip size="sm" color="success" variant="flat">
              {Object.keys(detailedPlayers).length} players loaded
            </Chip>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Football Pitch */}
          <div className="col-span-2">
            <div 
              className="relative w-full aspect-[3/4] bg-gradient-to-b from-green-400 to-green-600 rounded-xl border-4 border-white shadow-lg overflow-hidden"
              style={{
                backgroundImage: `
                  linear-gradient(90deg, rgba(255,255,255,0.1) 50%, transparent 50%),
                  linear-gradient(rgba(255,255,255,0.1) 50%, transparent 50%)
                `,
                backgroundSize: '20px 20px'
              }}
            >
              {/* Pitch markings */}
              <div className="absolute inset-0">
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-80"></div>
                <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                
                {/* Penalty areas */}
                <div className="absolute top-0 left-1/2 w-20 h-16 border-2 border-white border-t-0 transform -translate-x-1/2 opacity-80"></div>
                <div className="absolute bottom-0 left-1/2 w-20 h-16 border-2 border-white border-b-0 transform -translate-x-1/2 opacity-80"></div>
                
                {/* Goal areas */}
                <div className="absolute top-0 left-1/2 w-12 h-8 border-2 border-white border-t-0 transform -translate-x-1/2 opacity-80"></div>
                <div className="absolute bottom-0 left-1/2 w-12 h-8 border-2 border-white border-b-0 transform -translate-x-1/2 opacity-80"></div>
                
                {/* Center line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white opacity-80 transform -translate-y-1/2"></div>
              </div>

              {/* Players */}
              {startingEleven.map((playerData) => (
                <Tooltip
                  key={playerData.index}
                  content={
                    <div className="text-center">
                      <div className="font-bold">{playerData.playerName}</div>
                      <div className="text-xs text-default-500">{playerData.position} • #{playerData.jerseyNumber}</div>
                      {playerData.player.overall_rating && (
                        <div className="text-xs">OVR: {playerData.player.overall_rating}</div>
                      )}
                      {playerData.player.potential && (
                        <div className="text-xs">POT: {playerData.player.potential}</div>
                      )}
                      {teamSheet[`playerid${playerData.index}` as keyof TeamSheetData] && detailedPlayers[teamSheet[`playerid${playerData.index}` as keyof TeamSheetData] as string] && (
                        <div className="text-xs text-success-500 mt-1">
                          Enhanced data loaded ✓
                        </div>
                      )}
                    </div>
                  }
                  placement="top"
                  delay={0}
                  closeDelay={100}
                >
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:scale-110"
                    style={{
                      left: `${playerData.x}%`,
                      top: `${playerData.y}%`,
                    }}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-white ${
                      POSITION_COLORS[playerData.position] || "bg-gray-500"
                    }`}>
                      {playerData.jerseyNumber || '?'}
                    </div>
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[8px] font-bold text-white text-center whitespace-nowrap bg-black/70 px-1 rounded max-w-20 truncate">
                      {playerData.playerName.split(' ').pop()} {/* Show last name only */}
                    </div>
                  </div>
                </Tooltip>
              ))}
            </div>

            {/* Formation Info */}
            <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="w-4 h-4 bg-yellow-500 rounded-full mx-auto mb-1"></div>
                <span>GK</span>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full mx-auto mb-1"></div>
                <span>DEF</span>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-1"></div>
                <span>MID</span>
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-red-500 rounded-full mx-auto mb-1"></div>
                <span>ATT</span>
              </div>
            </div>
          </div>

          {/* Starting XI & Substitutes */}
          <div className="space-y-4">
            {/* Starting XI */}
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Icon icon="lucide:users" className="w-4 h-4" />
                Starting XI
              </h4>
              <div className="space-y-1">
                {startingEleven
                  .sort((a, b) => a.index - b.index)
                  .map((playerData) => (
                    <div
                      key={playerData.index}
                      className="flex items-center gap-2 p-2 bg-default-50 dark:bg-default-100 rounded-lg"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                        POSITION_COLORS[playerData.position] || "bg-gray-500"
                      }`}>
                        {playerData.jerseyNumber || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs truncate">
                          {playerData.playerName}
                        </div>
                        <div className="text-[10px] text-default-500 flex items-center gap-1">
                          <span>{playerData.position}</span>
                          {playerData.player.overall_rating && (
                            <span className="text-primary font-bold">
                              OVR: {playerData.player.overall_rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Substitutes */}
            {substitutes.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Icon icon="lucide:arrow-up-down" className="w-4 h-4" />
                  Substitutes ({substitutes.length})
                </h4>
                <div className="space-y-1">
                  {substitutes.map((player) => {
                    // Use the enhanced data already computed
                    const subJerseyNumber = player.enhancedJerseyNumber;
                    const subPlayerName = player.enhancedName;
                    return (
                      <div
                        key={player.playerid}
                        className="flex items-center gap-2 p-2 bg-default-50 dark:bg-default-100 rounded-lg opacity-75"
                      >
                        <div className="w-6 h-6 rounded-full bg-default-300 text-default-700 font-bold text-xs flex items-center justify-center">
                          {subJerseyNumber || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate">
                            {subPlayerName}
                          </div>
                          <div className="text-[10px] text-default-500 flex items-center gap-1">
                            <span>{player.position || "SUB"}</span>
                            {player.overall_rating && (
                              <span className="text-primary font-bold">
                                OVR: {player.overall_rating}
                              </span>
                            )}
                            {player.potential && (
                              <span className="text-secondary font-bold ml-1">
                                POT: {player.potential}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default memo(FootballPitch);