import { useState, useEffect, useMemo } from "react";
import { Card, CardBody, Chip, Tooltip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

interface FootballPitchProps {
  formation: any; // Formation data from defaultteamdata.json
  teamSheet: any; // Team sheet data from default_teamsheets.json
  players: any[]; // Player data array (not used, using API instead)
  teamName: string;
  playerNames: { [nameId: string]: string }; // Player names mapping
  projectId?: string;
  teamId: string; // FIFA team ID
  displayTeamId?: string; // Team ID to display in the header (from AddTeams)
}

interface Player {
  playerId: string;
  nameid: string;
  position: string;
  overallrating: number;
  preferredposition1: number;
  age: number;
  name?: string;
}

interface PositionMapping {
  [key: string]: string;
}

const FootballPitch = ({ 
  formation, 
  teamSheet, 
  teamName, 
  playerNames, 
  projectId, 
  teamId,
  displayTeamId 
}: FootballPitchProps) => {
  const [detailedPlayers, setDetailedPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Position mappings - all FIFA positions
  const positionMapping: PositionMapping = useMemo(() => ({
    "0": "GK",    // Вратарь
    "1": "SW",    // Либеро/«свипер»
    "2": "RWB",   // Правый латераль (wing-back)
    "3": "RB",    // Правый защитник
    "4": "RCB",   // Правый центральный защитник
    "5": "CB",    // Центральный защитник
    "6": "LCB",   // Левый центральный защитник
    "7": "LB",    // Левый защитник
    "8": "LWB",   // Левый латераль
    "9": "RDM",   // Правый опорный полузащитник
    "10": "CDM",  // Опорный (центр)
    "11": "LDM",  // Левый опорный
    "12": "RM",   // Правый полузащитник
    "13": "LCM",  // Левый центральный хав
    "14": "CM",   // Центральный полузащитник
    "15": "RCM",  // Правый центральный хав
    "16": "LM",   // Левый полузащитник
    "17": "RAM",  // Правый атакующий полузащитник
    "18": "CAM",  // Центральный атакующий полузащитник («десятка»)
    "19": "LAM",  // Левый атакующий полузащитник
    "20": "RF",   // Правый форвард/второй нападающий
    "21": "CF",   // Центральный форвард (под нападающим)
    "22": "LF",   // Левый форвард
    "23": "RW",   // Правый вингер
    "24": "RS",   // Правый наконечник атаки
    "25": "ST",   // Центральный нападающий
    "26": "LS",   // Левый наконечник
    "27": "LW"    // Левый вингер
  }), []);

  // Fetch detailed player data from the API
  useEffect(() => {
    if (!projectId) return;

    const fetchPlayers = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // CRITICAL FIX: Use the actual team ID from teamSheet if available
        const actualTeamId = teamSheet?.teamid || displayTeamId || teamId;
        
        console.log(`[FootballPitch] Fetching players for team ${teamName}`, {
          projectId,
          teamId, // FIFA team ID for teamSheet matching
          displayTeamId, // Team ID for API calls and display
          actualTeamId, // The team ID we'll actually use
          teamSheetTeamId: teamSheet?.teamid,
          teamSheetFifaTeamId: teamSheet?.fifaTeamId,
          teamSheetOriginalTeamId: teamSheet?.originalTeamId,
          teamSheetTransfermarktTeamId: teamSheet?.transfermarktTeamId,
          receivedTeamSheet: teamSheet ? {
            teamid: teamSheet.teamid,
            playerid0: teamSheet.playerid0,
            playerid1: teamSheet.playerid1,
            playerid2: teamSheet.playerid2
          } : null
        });
        
        // Get the list of specific player IDs from the team sheet for this team
        const teamPlayerIds: string[] = [];
        if (teamSheet) {
          console.log(`[FootballPitch] TeamSheet validation:`, {
            teamSheetTeamId: teamSheet.teamid,
            originalTeamId: teamSheet.originalTeamId,
            passedTeamId: teamId,
            displayTeamId: displayTeamId,
            actualTeamId: actualTeamId,
            teamSheetTeamIdMatches: teamSheet.teamid === teamId,
            originalTeamIdMatches: teamSheet.originalTeamId === teamId,
            displayTeamIdMatches: teamSheet.teamid === displayTeamId,
            actualTeamIdMatches: teamSheet.teamid === actualTeamId
          });
          
          // SIMPLIFIED: If we have a teamSheet, use it (it should be the correct one from fetchFormationData)
          // The AddTeams component is responsible for fetching the correct teamSheet
          console.log(`[FootballPitch] Using teamSheet data for team ${teamSheet.teamid}, actual team: ${actualTeamId}`);
          
          // Collect all player IDs from positions 0-51 (including substitutes)
          for (let i = 0; i <= 51; i++) {
            const playerId = teamSheet[`playerid${i}`];
            if (playerId && playerId !== "-1") {
              teamPlayerIds.push(playerId);
            }
          }
          console.log(`[FootballPitch] Found ${teamPlayerIds.length} players in teamSheet for team ${teamSheet.teamid}`);
        }
        
        console.log(`[FootballPitch] Found ${teamPlayerIds.length} player IDs in teamsheet:`, teamPlayerIds.slice(0, 5));
        
        // Use the actual team ID from teamSheet for API call
        console.log(`[FootballPitch] Making API call with team_id: ${actualTeamId}`);
        
        const response = await fetch(`http://localhost:8000/players?project_id=${projectId}&team_id=${actualTeamId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch players: ${response.status}`);
        }
        
        const allPlayersData = await response.json();
        console.log(`[FootballPitch] Received ${allPlayersData.length} total players from API`);
        
        // Filter players to only include those that are in this team's sheet
        const filteredPlayers = teamPlayerIds.length > 0 
          ? allPlayersData.filter((player: Player) => teamPlayerIds.includes(player.playerId))
          : allPlayersData;
        
        console.log(`[FootballPitch] Filtered to ${filteredPlayers.length} players for team ${teamName} (teamid: ${actualTeamId})`);
        
        setDetailedPlayers(filteredPlayers);
      } catch (error) {
        console.error(`[FootballPitch] Error fetching players:`, error);
        setError(error instanceof Error ? error.message : 'Failed to fetch players');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [projectId, teamId, teamName, teamSheet, displayTeamId]);

  // Get player by ID from the detailed players data
  const getPlayerById = (playerId: string): Player | null => {
    if (playerId === "-1") return null;
    return detailedPlayers.find(p => p.playerId === playerId) || null;
  };

  // Get player name from multiple sources
  const getPlayerName = (player: Player | null): string => {
    if (!player) return "";
    
    // Try player names mapping first
    if (player.nameid && playerNames[player.nameid]) {
      return playerNames[player.nameid];
    }
    
    // Fallback to name property if available
    if (player.name) {
      return player.name;
    }
    
    return `Player ${player.playerId}`;
  };

  // Get position abbreviation
  const getPositionAbbreviation = (positionId: string): string => {
    return positionMapping[positionId] || "UN";
  };

  // Render starting XI (positions 0-10)
  const renderStartingXI = () => {
    const startingPlayers = [];
    
    // Debug logging for team sheet validation
    console.log(`[FootballPitch] Rendering starting XI for team ${teamName}`, {
      teamId,
      teamSheetTeamId: teamSheet?.teamid,
      teamSheetOriginalTeamId: teamSheet?.originalTeamId,
      teamSheetMatches: teamSheet?.teamid === teamId || teamSheet?.originalTeamId === teamId,
      formationExists: !!formation,
      teamSheetExists: !!teamSheet,
      detailedPlayersCount: detailedPlayers.length,
      samplePlayerIds: teamSheet ? [
        teamSheet.playerid0,
        teamSheet.playerid1,
        teamSheet.playerid2
      ] : []
    });
    
    // Info: Log which team data we're using
    const actualDisplayTeamId = teamSheet?.teamid || displayTeamId || teamId;
    console.log(`[FootballPitch] Rendering formation for team ${actualDisplayTeamId}`, {
      teamSheetTeamId: teamSheet?.teamid,
      formationTeamId: formation?.teamid,
      displayTeamId,
      teamId,
      actualDisplayTeamId
    });
    
    for (let i = 0; i <= 10; i++) {
      const playerId = teamSheet[`playerid${i}`];
      const player = getPlayerById(playerId);
      const positionId = formation[`position${i}`];
      const xOffset = parseFloat(formation[`offset${i}x`]) * 100; // Convert to percentage
      const yOffset = (1 - parseFloat(formation[`offset${i}y`])) * 100; // Invert Y coordinate so goalkeeper is at bottom
      
      const playerName = getPlayerName(player);
      const position = getPositionAbbreviation(positionId);
      
      // Debug logging for first few players
      if (i < 3) {
        console.log(`[FootballPitch] Player ${i}:`, {
          playerId,
          playerFound: !!player,
          playerName,
          position,
          positionId,
          xOffset,
          yOffset,
          fromTeamSheet: teamSheet?.teamid,
          fromFormation: formation?.teamid,
          expectedDisplayTeamId: actualDisplayTeamId
        });
      }
      
      startingPlayers.push(
        <Tooltip
          key={`starting-${i}`}
          content={
            <div className="p-2">
              <div className="font-semibold">{playerName || "Empty Position"}</div>
              <div className="text-xs text-default-500">
                Position Slot: playerid{i}
                <br />Formation Position: {position} (ID: {positionId})
                <br />Player ID: {playerId}
                {player && (
                  <>
                    <br />Overall: {player.overallrating}
                    <br />Age: {player.age}
                    <br />Preferred Position: {getPositionAbbreviation(player.preferredposition1?.toString() || "14")}
                  </>
                )}
                <br />X: {xOffset.toFixed(1)}%, Y: {yOffset.toFixed(1)}%
              </div>
            </div>
          }
          placement="top"
          showArrow
        >
          <div
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:scale-110 ${
              player ? 'opacity-100' : 'opacity-50'
            }`}
            style={{
              left: `${xOffset}%`,
              top: `${yOffset}%`,
            }}
          >
            <div className={`relative ${player ? 'hover:z-10' : ''}`}>
              {/* Player circle */}
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  player
                    ? positionId === "0" // Goalkeeper
                      ? 'bg-yellow-400 border-yellow-600 text-yellow-900'
                      : 'bg-blue-500 border-blue-700 text-white'
                    : 'bg-gray-300 border-gray-400 text-gray-600'
                }`}
              >
                {position}
              </div>
              
              {/* Player name and ID */}
              {player && (
                <div className="absolute top-9 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-black/90 px-1 py-0.5 rounded text-[10px] font-medium whitespace-nowrap border shadow-sm">
                  <div>{playerName}</div>
                  <div className="text-[8px] text-gray-500">ID: {playerId}</div>
                </div>
              )}
              
              {/* Overall rating */}
              {player && (
                <div className="absolute -top-2 -right-1 bg-green-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {player.overallrating}
                </div>
              )}
            </div>
          </div>
        </Tooltip>
      );
    }
    
    return startingPlayers;
  };

  // Render substitutes (positions 11-51, only show filled positions)
  const renderSubstitutes = () => {
    const substitutes = [];
    
    for (let i = 11; i <= 51; i++) {
      const playerId = teamSheet[`playerid${i}`];
      
      // Skip empty positions with "-1"
      if (playerId === "-1") continue;
      
      const player = getPlayerById(playerId);
      const playerName = player ? getPlayerName(player) : `Player ${playerId}`;
      const position = player ? getPositionAbbreviation(player.preferredposition1?.toString() || "14") : "N/A";
      
      substitutes.push(
        <Tooltip
          key={`sub-${i}`}
          content={
            <div className="p-2">
              <div className="font-semibold">{playerName}</div>
              <div className="text-xs text-default-500">
                Position: {position}
                <br />Player ID: {playerId}
                {player && (
                  <>
                    <br />Overall: {player.overallrating}
                    <br />Age: {player.age}
                  </>
                )}
                <br />Reserve #{i - 10}
              </div>
            </div>
          }
          placement="top"
          showArrow
        >
          <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 cursor-pointer transition-colors">
            <div className="w-6 h-6 rounded-full bg-orange-400 border-orange-600 border-2 flex items-center justify-center text-[10px] font-bold text-white">
              {position}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{playerName}</div>
              <div className="text-xs text-default-500">Reserve #{i - 10} • ID: {playerId}</div>
            </div>
            {player && (
              <Chip size="sm" color="success" variant="flat" className="text-[10px]">
                {player.overallrating}
              </Chip>
            )}
          </div>
        </Tooltip>
      );
    }
    
    return substitutes;
  };

  if (isLoading) {
    return (
      <Card>
        <CardBody className="p-8">
          <div className="flex items-center justify-center gap-2">
            <Spinner size="sm" />
            <span className="text-sm text-default-500">Loading formation...</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="flex items-center justify-center gap-2 text-danger">
            <Icon icon="lucide:alert-circle" className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  const formationName = formation?.formationname || "Unknown Formation";
  
  // Debug log to see exactly what formation and teamSheet we received
  console.log(`[FootballPitch] Final data for rendering:`, {
    teamName,
    displayTeamId,
    formationData: formation ? {
      teamid: formation.teamid,
      formationname: formation.formationname,
      position0: formation.position0,
      offset0x: formation.offset0x,
      offset0y: formation.offset0y
    } : null,
    teamSheetData: teamSheet ? {
      teamid: teamSheet.teamid,
      playerid0: teamSheet.playerid0,
      playerid1: teamSheet.playerid1,
      playerid2: teamSheet.playerid2
    } : null,
    detailedPlayersCount: detailedPlayers.length
  });
  
  return (
    <div className="space-y-4">
      {/* Formation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="lucide:users" className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{formationName}</span>
          <span className="text-xs text-default-500">• {teamName}</span>
          <Chip size="sm" color="secondary" variant="flat" className="text-[10px]">
            Team ID: {teamSheet?.teamid || displayTeamId || teamId}
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          <Chip size="sm" color="primary" variant="flat">
            Основной состав
          </Chip>
          <Chip size="sm" color="warning" variant="flat">
            Резерв: {renderSubstitutes().length} игроков
          </Chip>
        </div>
      </div>

      {/* Football Pitch */}
      <Card>
        <CardBody className="p-0">
          <div className="relative w-full bg-green-950 rounded-lg overflow-hidden">
            {/* Pitch background pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="w-full h-full" style={{
                backgroundImage: `
                  linear-gradient(90deg, rgba(255,255,255,0.1) 50%, transparent 50%),
                  linear-gradient(rgba(255,255,255,0.1) 50%, transparent 50%)
                `,
                backgroundSize: '20px 20px'
              }} />
            </div>
            
            {/* Pitch dimensions - using 16:10 aspect ratio for better display */}
            <div className="relative w-full" style={{ paddingBottom: '62.5%' }}>
              {/* Pitch markings */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 62.5"
                preserveAspectRatio="none"
              >
                {/* Outer boundary */}
                <rect x="2" y="2" width="96" height="58.5" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
                
                {/* Center circle */}
                <circle cx="50" cy="31.25" r="8" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
                <circle cx="50" cy="31.25" r="0.5" fill="white" opacity="0.8" />
                
                {/* Center line - horizontal */}
                <line x1="2" y1="31.25" x2="98" y2="31.25" stroke="white" strokeWidth="0.3" opacity="0.8" />
                
                {/* Goal areas - bottom (home) and top (away) */}
                <rect x="37.5" y="52" width="25" height="8.5" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
                <rect x="37.5" y="2" width="25" height="8.5" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
                
                {/* Penalty areas - bottom (home) and top (away) */}
                <rect x="25" y="45" width="50" height="15.5" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
                <rect x="25" y="2" width="50" height="15.5" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
                
                {/* Penalty spots */}
                <circle cx="50" cy="52" r="0.5" fill="white" opacity="0.8" />
                <circle cx="50" cy="10.5" r="0.5" fill="white" opacity="0.8" />
                
                {/* Goals - bottom (home) and top (away) */}
                <rect x="42.5" y="60.5" width="15" height="2" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
                <rect x="42.5" y="0" width="15" height="2" fill="none" stroke="white" strokeWidth="0.3" opacity="0.8" />
              </svg>
              
              {/* Players on pitch */}
              <div className="absolute inset-0">
                {renderStartingXI()}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Starting XI List Section */}
      <Card>
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="lucide:users" className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Основной состав</span>
            <Chip size="sm" color="primary" variant="flat">
              {(() => {
                let filledCount = 0;
                for (let i = 0; i <= 10; i++) {
                  const playerId = teamSheet[`playerid${i}`];
                  if (playerId && playerId !== "-1") {
                    filledCount++;
                  }
                }
                return filledCount;
              })()} игроков
            </Chip>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {(() => {
              const startingPlayers = [];
              for (let i = 0; i <= 10; i++) {
                const playerId = teamSheet[`playerid${i}`];
                
                // Skip empty positions with "-1"
                if (playerId === "-1") continue;
                
                const player = getPlayerById(playerId);
                const positionId = formation[`position${i}`];
                
                const playerName = player ? getPlayerName(player) : `Player ${playerId}`;
                const position = getPositionAbbreviation(positionId || "14");
                
                startingPlayers.push(
                  <Tooltip
                    key={`starter-list-${i}`}
                    content={
                      <div className="p-2">
                        <div className="font-semibold">{playerName}</div>
                        <div className="text-xs text-default-500">
                          Position Slot: playerid{i}
                          <br />Formation Position: {position} (ID: {positionId})
                          <br />Player ID: {playerId}
                          {player && (
                            <>
                              <br />Overall: {player.overallrating}
                              <br />Age: {player.age}
                              <br />Preferred Position: {getPositionAbbreviation(player.preferredposition1?.toString() || "14")}
                            </>
                          )}
                        </div>
                      </div>
                    }
                    placement="top"
                    showArrow
                  >
                    <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 cursor-pointer transition-colors">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                        positionId === "0" // Goalkeeper
                          ? 'bg-yellow-400 border-yellow-600 text-yellow-900'
                          : 'bg-blue-500 border-blue-700 text-white'
                      }`}>
                        {position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{playerName}</div>
                        <div className="text-xs text-default-500">Позиция #{i} • ID: {playerId}</div>
                      </div>
                      {player && (
                        <Chip size="sm" color="success" variant="flat" className="text-[10px]">
                          {player.overallrating}
                        </Chip>
                      )}
                    </div>
                  </Tooltip>
                );
              }
              return startingPlayers;
            })()}
          </div>
        </CardBody>
      </Card>

      {/* Substitutes Section - Always show all 41 reserve positions */}
      <Card>
        <CardBody className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="lucide:users-2" className="w-4 h-4 text-warning" />
            <span className="font-semibold text-sm">Резервный состав</span>
            <Chip size="sm" color="warning" variant="flat">
              {(() => {
                let filledCount = 0;
                for (let i = 11; i <= 51; i++) {
                  const playerId = teamSheet[`playerid${i}`];
                  if (playerId && playerId !== "-1") {
                    filledCount++;
                  }
                }
                return filledCount;
              })()} игроков
            </Chip>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {renderSubstitutes()}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default FootballPitch;