import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Progress,
  Chip,
  Card,
  CardBody,
  Image,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import PlayerCardFromAddTeam from "./PlayerCardFromAddTeam";
import FootballPitch from "./FootballPitch";

interface TransfermarktTeam {
  teamname: string;
  teamlogo: string;
  team_url: string;
  team_id: string;
  squad: number;
  avg_age: number;
  foreigners: number;
  avg_market_value: string;
  total_market_value: string;
}

interface AddTeamsProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTeams: TransfermarktTeam[];
  projectId?: string;
  leagueId: string;
}

interface ProgressData {
  type: string;
  function_name?: string;
  message?: string;
  current?: number;
  total?: number;
  percentage?: number;
  completed_teams?: string[];
  current_team?: string;
  current_category?: string;
  category_progress?: number;
  team_data?: { [teamName: string]: any };
  status?: string;
  current_player?: string;
  player_index?: number;
  total_players?: number;
  player_status?: string;
  current_processing_player?: string;
  player_overall_rating?: number;
  player_potential?: number;
  player_position?: string;
  players_processing_progress?: { [key: string]: any };
}


interface PlayerSaveStatus {
  name: string;
  status: 'pending' | 'saving' | 'saved' | 'error';
  error?: string;
  overall_rating?: number;
  potential?: number;
  position?: string;
}


const PROCESSING_STEPS_INFO = [
  { name: "📥 Downloading team logo", icon: "lucide:download" },
  { name: "🏷️ Basic team info", icon: "lucide:tag" },
  { name: "🏟️ Stadium information", icon: "lucide:building" },
  { name: "🧢 Branding and visual elements", icon: "lucide:palette" },
  { name: "🎨 Team colors", icon: "lucide:paintbrush" },
  { name: "🥅 Goal net colors and styles", icon: "lucide:goal" },
  { name: "⚽ Processing team players", icon: "lucide:users" },
  { name: "💾 Saving team players", icon: "lucide:save" },
  { name: "📊 Team ratings", icon: "lucide:bar-chart-2" },
  { name: "⚽ Tactics and gameplay style", icon: "lucide:target" },
  { name: "🎯 Team formations and tactics", icon: "lucide:clipboard-list" },
  { name: "🧠 Player roles", icon: "lucide:brain" },
  { name: "🏆 Trophies and achievements", icon: "lucide:trophy" },
  { name: "💰 Finances and prestige", icon: "lucide:dollar-sign" },
  { name: "🔁 Transfers", icon: "lucide:repeat" },
  { name: "🧩 Miscellaneous parameters", icon: "lucide:puzzle" },
  { name: "🔗 Connecting to league", icon: "lucide:link" },
  { name: "🏟️ Adding stadium link", icon: "lucide:link-2" },
  { name: "👕 Adding team kits", icon: "lucide:shirt" },
  { name: "👨‍💼 Creating team manager", icon: "lucide:user-plus" },
  { name: "🌐 Processing language strings", icon: "lucide:globe" },
];

// Add CSS animations and card fixes
const styles = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes pulseGreen {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.8;
    }
  }
  
  @keyframes flowDown {
    from {
      transform: translateY(-5px);
      opacity: 0.5;
    }
    to {
      transform: translateY(5px);
      opacity: 1;
    }
  }
  
  .slide-in {
    animation: slideIn 0.5s ease-out forwards;
  }
  
  .pulse-green {
    animation: pulseGreen 2s ease-in-out infinite;
  }
  
  .flow-arrow {
    animation: flowDown 1s ease-in-out infinite alternate;
  }
  
  /* Горизонтальные карточки игроков в стиле изображения */
  .player-card-fixed {
    width: 100% !important;
    height: 100px !important;
    min-height: 100px !important;
    max-height: 100px !important;
    flex-shrink: 0 !important;
    flex-grow: 0 !important;
  }
  
  .player-card-body-fixed {
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
    padding: 0 !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}


function AddTeams({
  isOpen,
  onClose,
  selectedTeams,
  projectId,
  leagueId,
}: AddTeamsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [completedTeams, setCompletedTeams] = useState<Set<string>>(new Set());
  const [currentTeamIndex, setCurrentTeamIndex] = useState(-1);
  const [teamData, setTeamData] = useState<{ [teamName: string]: any }>({});
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [playerSaveStatus, setPlayerSaveStatus] = useState<{ [teamName: string]: PlayerSaveStatus[] }>({});
  const [savedPlayerRatings, setSavedPlayerRatings] = useState<{ [teamName: string]: { [playerIndex: number]: number } }>({});
  const previousProgressRef = useRef<number>(0);
  const [teamStepProgress, setTeamStepProgress] = useState<{ [teamName: string]: number }>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastKnownPlayerIndex, setLastKnownPlayerIndex] = useState<{ [teamName: string]: number }>({});
  const [activePlayerState, setActivePlayerState] = useState<{ [teamName: string]: number | null }>({});
  const [firstCardAnimationDelay, setFirstCardAnimationDelay] = useState<{ [teamName: string]: { delayedRating: number, timestamp: number } }>({});
  const [firstCardAnimationState, setFirstCardAnimationState] = useState<{ [teamName: string]: { shouldAnimate: boolean, targetRating: number, triggered: boolean } }>({});
  const [formationData, setFormationData] = useState<{ [teamName: string]: any }>({});
  const [teamSheetData, setTeamSheetData] = useState<{ [teamName: string]: any }>({});
  const [playerNames, setPlayerNames] = useState<{ [nameId: string]: string }>({});


  // Function to normalize step names for comparison
  const normalizeStepName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters and emojis
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  };

  // Function to create formation and teamsheet data for a team (integrated test formation logic)
  const fetchFormationData = useCallback(async (teamName: string, teamId: string) => {
    if (!projectId) {
      console.log(`[Formation Fetch] No projectId available for ${teamName}`);
      return;
    }
    
    console.log(`[Formation Fetch] Creating formation data for ${teamName} (ID: ${teamId}), project: ${projectId}`);
    
    try {
      // Always create formation data from team player data (previously test formation logic)
      const currentTeamData = teamData[teamName];
      
      // Create formation data (4-4-2 formation)
      const formationData = {
        formationname: "4-4-2",
        position0: "0", position1: "3", position2: "4", position3: "6", position4: "7",
        position5: "12", position6: "13", position7: "15", position8: "16",
        position9: "24", position10: "26",
        offset0x: "0.5", offset0y: "0.015",
        offset1x: "0.925", offset1y: "0.2",
        offset2x: "0.7125", offset2y: "0.1606",
        offset3x: "0.2875", offset3y: "0.1585",
        offset4x: "0.075", offset4y: "0.2",
        offset5x: "0.925", offset5y: "0.5875",
        offset6x: "0.65", offset6y: "0.5125",
        offset7x: "0.35", offset7y: "0.5125",
        offset8x: "0.075", offset8y: "0.5875",
        offset9x: "0.6", offset9y: "0.875",
        offset10x: "0.39", offset10y: "0.875"
      };
      
      // Create teamsheet data using all parsed players (expand to include all team players)
      const teamSheetData: any = {
        teamid: teamId
      };
      
      // Add all available players from the team to the teamsheet
      const maxPlayers = Math.min(currentTeamData?.parsed_players_for_table?.length || 0, 30); // Limit to 30 players max
      
      for (let i = 0; i < maxPlayers; i++) {
        const playerKey = `playerid${i}`;
        teamSheetData[playerKey] = currentTeamData?.parsed_players_for_table?.[i]?.playerid || (i + 1).toString();
      }
      
      // Fill any remaining slots up to at least 22 players (11 starting + 11 subs) with default values
      for (let i = maxPlayers; i < 22; i++) {
        const playerKey = `playerid${i}`;
        teamSheetData[playerKey] = (i + 1).toString();
      }
      
      console.log(`[Formation Fetch] Created teamsheet with ${maxPlayers} real players and filled to 22 total players`);
      
      // Set the data in state
      setFormationData(prev => ({ ...prev, [teamName]: formationData }));
      setTeamSheetData(prev => ({ ...prev, [teamName]: teamSheetData }));
      
      console.log(`[Formation Fetch] Created formation data for ${teamName}`, {
        playersCount: currentTeamData?.parsed_players_for_table?.length || 0,
        firstPlayer: currentTeamData?.parsed_players_for_table?.[0],
        playerNamesCount: Object.keys(playerNames).length,
        hasPlayerNames: Object.keys(playerNames).length > 0,
        formationData,
        teamSheetData
      });

      // Fetch player names data for proper name display if not already loaded
      if (Object.keys(playerNames).length === 0) {
        const playerNamesUrl = `http://localhost:8000/playernames?project_id=${projectId}`;
        console.log(`[Formation Fetch] Fetching player names from: ${playerNamesUrl}`);
        const playerNamesResponse = await fetch(playerNamesUrl);
        
        if (playerNamesResponse.ok) {
          const playerNamesData = await playerNamesResponse.json();
          console.log(`[Formation Fetch] Got ${playerNamesData.length} player names`);
          
          // Convert array to object with nameid as key
          const playerNamesMap: { [nameId: string]: string } = {};
          playerNamesData.forEach((playerName: any) => {
            playerNamesMap[playerName.nameid] = playerName.name;
          });
          
          setPlayerNames(playerNamesMap);
        } else {
          console.error(`[Formation Fetch] Player names API error:`, playerNamesResponse.status, playerNamesResponse.statusText);
        }
      }
    } catch (error) {
      console.error(`[Formation Fetch] Error creating formation data for ${teamName}:`, error);
    }
  }, [projectId, playerNames, teamData]);

  // Connect to WebSocket when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://localhost:8000/ws');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[AddTeams] WebSocket connected');
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          
          // Start sending pings every 20 seconds
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
              console.log('[AddTeams] Sent ping to server');
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle ping/pong for keep-alive
            if (data.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
              console.log('[AddTeams] Received ping, sent pong');
              return;
            }
            
            if (data.type === 'pong') {
              console.log('[AddTeams] Received pong from server');
              return;
            }
            
            if (data.type === 'connected') {
              console.log('[AddTeams] WebSocket connection confirmed');
              return;
            }
            
            if (data.function_name === 'add_teams') {
              handleProgressUpdate(data);
            }
          } catch (error) {
            console.error('[AddTeams] Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log('[AddTeams] WebSocket disconnected:', event.code, event.reason);
          
          // Clear ping interval
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          
          // Attempt to reconnect if modal is still open and we haven't exceeded max attempts
          // Don't reconnect if the close was intentional (code 1000)
          if (isOpen && reconnectAttempts < maxReconnectAttempts && event.code !== 1000) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Exponential backoff, max 30s
            console.log(`[AddTeams] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              if (isOpen) { // Double-check modal is still open
                connectWebSocket();
              }
            }, delay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('[AddTeams] Max reconnection attempts reached');
          } else if (event.code === 1000) {
            console.log('[AddTeams] WebSocket closed normally');
          }
        };

        ws.onerror = (error) => {
          console.error('[AddTeams] WebSocket error:', error);
        };
      } catch (error) {
        console.error('[AddTeams] Error creating WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      // Clear intervals and timeouts
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen]);

  const handleProgressUpdate = useCallback((data: ProgressData) => {
    // Reduced logging for better performance
    if (data.type === 'progress' && data.percentage && data.percentage % 10 === 0) {
      console.log('[AddTeams] Progress:', data.percentage + '%');
    }
    
    // Дебаг для сохранения игроков
    if (data.current_category?.includes('💾 Saving team players') && data.current_player) {
      console.log('🎯 [СОХРАНЕНИЕ ИГРОКА]', {
        team: data.current_team,
        player: data.current_player,
        index: data.player_index,
        rating: data.player_overall_rating,
        category: data.current_category
      });
    }
    
    setProgressData(data);
  
    if (data.current !== undefined) {
      setCurrentTeamIndex(data.current);
    }

    // Update last known player index
    if (data.current_team && data.player_index !== undefined) {
      setLastKnownPlayerIndex(prev => ({
        ...prev,
        [data.current_team!]: data.player_index!
      }));
    }

    // Update active player state - more stable tracking
    if (data.current_team && data.current_category?.includes('💾 Saving team players')) {
      if (data.player_index !== undefined) {
        // Set active player when we have a specific index
        setActivePlayerState(prev => ({
          ...prev,
          [data.current_team!]: data.player_index!
        }));
        
        // ULTRAFIX: Trigger animation for first player
        if (data.player_index === 0 && data.player_overall_rating !== undefined) {
          const teamName = data.current_team;
          setFirstCardAnimationState(prev => {
            const currentState = prev[teamName];
            if (!currentState || !currentState.triggered) {
              console.log(`🎬 [EXTERNAL ANIMATION] Triggering animation for first player: ${data.player_overall_rating}`);
              return {
                ...prev,
                [teamName]: {
                  shouldAnimate: true,
                  targetRating: data.player_overall_rating,
                  triggered: true
                }
              };
            }
            return prev;
          });
        }
      }
    } else if (data.current_team && 
               (!data.current_category?.includes('💾 Saving team players') || 
                data.message?.includes('All') && data.message?.includes('players saved successfully'))) {
      // Clear active player when not saving players or when all players are saved
      setActivePlayerState(prev => ({
        ...prev,
        [data.current_team!]: null
      }));
    }

    // Centralized capture of player ratings via player_index
    if (data.current_team && data.player_index !== undefined && data.player_overall_rating !== undefined) {
      const teamName = data.current_team;
      const playerIndex = data.player_index;
      const newRating = data.player_overall_rating;

      // Only update if the rating is different or not yet set
      // Check against the current state directly inside the updater to avoid stale closure issues if possible,
      // but for now, reading from savedPlayerRatings state directly here is okay for an initial check.
      if (savedPlayerRatings[teamName]?.[playerIndex] !== newRating) {
        console.log(`[Rating Capture DIRECT] Team: ${teamName}, Player Index: ${playerIndex}, Rating: ${newRating}`);
        setSavedPlayerRatings(prev => {
          // Ensure we're not overwriting with undefined if newRating is somehow undefined here (though guarded above)
          if (newRating === undefined) return prev;
          
          const teamRatings = prev[teamName] || {};
          if (teamRatings[playerIndex] !== newRating) {
            return {
              ...prev,
              [teamName]: {
                ...teamRatings,
                [playerIndex]: newRating
              }
            };
          }
          return prev; // No change needed
        });
      }
    }
  
    // Handle player processing progress - capture ratings early
    /*
    if (data.current_processing_player && data.player_overall_rating !== undefined && data.current_team) {
      // Extract player name from the player string (e.g., "14-Artem Polyarus" -> "Artem Polyarus")
      const parts = data.current_processing_player.split('-');
      const playerName = parts.length >= 2 ? parts.slice(1).join('-') : data.current_processing_player;
      
      // Find player index by name
      const players = teamData[data.current_team]?.parsed_players_for_table || [];
      const playerIndex = players.findIndex((p: any) => 
        p.name === playerName || 
        p.name.toLowerCase() === playerName.toLowerCase()
      );
      
      if (playerIndex >= 0) {
        console.log(`[Player Processing NAME MATCH] Saving rating for ${playerName} at index ${playerIndex}: ${data.player_overall_rating}`);
        
        // Save to persistent storage immediately
        setSavedPlayerRatings(prev => ({
          ...prev,
          [data.current_team!]: {
            ...(prev[data.current_team!] || {} as { [playerIndex: number]: number }),
            [playerIndex]: data.player_overall_rating!
          }
        }));
      }
    }
    */
  
    // Handle player save status updates
    if (data.current_team && data.current_category?.toLowerCase().includes('saving') && 
        data.current_category?.toLowerCase().includes('player')) {
      
      if (data.player_index !== undefined && data.total_players) {
        console.log(`[Player Update] Processing player ${data.player_index}, rating: ${data.player_overall_rating}, status: ${data.player_status}`);
        
        // Save rating separately for reliable storage
        if (data.player_overall_rating !== undefined) {
          setSavedPlayerRatings(prev => ({
            ...prev,
            [data.current_team!]: {
              ...prev[data.current_team!] || {},
              [data.player_index!]: data.player_overall_rating!
            }
          }));
          console.log(`[Player Update] Saved rating ${data.player_overall_rating} for player ${data.player_index} in separate storage`);
        }
        
        setPlayerSaveStatus(prev => {
          const currentTeamPlayers = prev[data.current_team!] || [];
          let teamPlayers = [...currentTeamPlayers];
          
          // Initialize player list if needed
          if (teamPlayers.length === 0 && data.total_players) {
            const players = teamData[data.current_team!]?.parsed_players_for_table || [];
            console.log('[Player Update] Initializing player list for team:', data.current_team);
            teamPlayers = players.map((p: any, idx: number) => {
              // Check if we already have a saved rating
              const existingRating = savedPlayerRatings[data.current_team!]?.[idx];
              return {
                name: p.name,
                status: 'pending' as const,
                position: p.position,
                overall_rating: existingRating // Include any existing rating
              };
            });
          }
          
          // Update current player status with all available data
          if (data.player_index !== undefined && data.player_index < teamPlayers.length) {
            console.log(`[Player Update] Before update player ${data.player_index}:`, teamPlayers[data.player_index]);
            
            // Preserve existing rating if no new one provided
            const existingRating = teamPlayers[data.player_index].overall_rating || 
                                  savedPlayerRatings[data.current_team!]?.[data.player_index];
            
            teamPlayers[data.player_index] = {
              ...teamPlayers[data.player_index],
              status: data.player_status as 'pending' | 'saving' | 'saved' | 'error' || 'saving',
              overall_rating: data.player_overall_rating || existingRating,
              potential: data.player_potential || teamPlayers[data.player_index].potential,
              position: data.player_position || teamPlayers[data.player_index].position
            };
            
            console.log(`[Player Update] After update player ${data.player_index}:`, teamPlayers[data.player_index]);
            
            // Mark all previous players as saved and ensure ratings are preserved
            for (let i = 0; i < data.player_index; i++) {
              if (teamPlayers[i].status !== 'saved') {
                // Preserve rating from either current state or savedPlayerRatings
                const preservedRating = savedPlayerRatings[data.current_team!]?.[i];
                teamPlayers[i] = {
                  ...teamPlayers[i],
                  status: 'saved',
                  overall_rating: preservedRating,
                  potential: teamPlayers[i].potential
                };
                console.log(`[Player Update] Marked player ${i} as saved with preserved rating:`, preservedRating);
              }
            }
          }
          
          console.log('[Player Update] Final team players state:', teamPlayers.map(p => ({
            name: p.name, 
            status: p.status, 
            rating: p.overall_rating,
            potential: p.potential
          })));
          
          return {
            ...prev,
            [data.current_team!]: teamPlayers
          };
        });
      }
    }
    
    // IMPORTANT: When "All players saved successfully" message is received, mark all as saved
    if (data.message?.includes('All') && data.message?.includes('players saved successfully') && data.current_team) {
      console.log('[Player Update] All players saved successfully, finalizing status');
      
      setPlayerSaveStatus(prev => {
        const teamPlayers = prev[data.current_team!];
        if (!teamPlayers) return prev;
        
        const updatedPlayers = teamPlayers.map((player, idx) => ({
          ...player,
          status: 'saved' as const,
          // Ensure rating is from the definitive source
          overall_rating: savedPlayerRatings[data.current_team!]?.[idx] ?? player.overall_rating,
          // Preserve potential
          potential: player.potential
        }));
        
        console.log('[Player Update] Finalized all players:', updatedPlayers.map(p => ({
          name: p.name,
          rating: p.overall_rating,
          potential: p.potential
        })));
        
        return {
          ...prev,
          [data.current_team!]: updatedPlayers
        };
      });
    }
  
    if (data.completed_teams) {
      setCompletedTeams(new Set(data.completed_teams));
      
      // Reset last known player index for completed teams
      setLastKnownPlayerIndex(prev => {
        const newIndex = { ...prev };
        data.completed_teams!.forEach(teamId => {
          const team = selectedTeams.find(t => t.team_id === teamId);
          if (team) {
            delete newIndex[team.teamname];
            // Fetch formation data for completed teams
            console.log(`[Formation Data] Team ${team.teamname} completed, fetching formation data...`);
            fetchFormationData(team.teamname, team.team_id);
          }
        });
        return newIndex;
      });
      
      // Mark completed teams with full step progress
      setTeamStepProgress(prev => {
        const newProgress = { ...prev };
        data.completed_teams!.forEach(teamId => {
          const team = selectedTeams.find(t => t.team_id === teamId);
          if (team) {
            newProgress[team.teamname] = PROCESSING_STEPS_INFO.length - 1;
          }
        });
        return newProgress;
      });
    }
  
    if (data.team_data) {
      setTeamData(data.team_data);
      
      // Debug log to show actual team data structure
      Object.entries(data.team_data).forEach(([teamName, teamInfo]) => {
        if (teamInfo.parsed_players_for_table && teamInfo.parsed_players_for_table.length > 0) {
          console.log(`[AddTeams Debug] Team "${teamName}" parsed_players_for_table sample:`, {
            firstPlayer: teamInfo.parsed_players_for_table[0],
            allKeys: Object.keys(teamInfo.parsed_players_for_table[0] || {}),
            totalPlayers: teamInfo.parsed_players_for_table.length
          });
        }
      });
      
      // Initialize player save status for teams with player data
      Object.entries(data.team_data).forEach(([teamName, teamInfo]) => {
        if (teamInfo.parsed_players_for_table && !playerSaveStatus[teamName]) {
          setPlayerSaveStatus(prev => ({
            ...prev,
            [teamName]: teamInfo.parsed_players_for_table.map((p: any, idx: number) => ({
              name: p.name,
              status: 'pending',
              position: p.position,
              // Check for existing saved ratings
              overall_rating: savedPlayerRatings[teamName]?.[idx]
            }))
          }));
        }
      });
    }
  
    // Update team step progress
    if (data.current_team && data.current_category) {
      // Check if team is completed
      if (data.current_category === "✅ Team completed" || 
          data.current_category.toLowerCase().includes("completed")) {
        setTeamStepProgress(prev => ({
          ...prev,
          [data.current_team as string]: PROCESSING_STEPS_INFO.length - 1
        }));
      } else {
        // Find the step index
        let stepIndex = PROCESSING_STEPS_INFO.findIndex(s => s.name === data.current_category);
        
        // Direct mapping for known problematic steps
        if (stepIndex === -1) {
          const categoryLower = data.current_category.toLowerCase();
          if (categoryLower === "💾 saving team players" || 
              categoryLower === "saving team players" ||
              (categoryLower.includes("saving") && categoryLower.includes("player"))) {
            stepIndex = 7; // Index for "💾 Saving team players"
          } else if (categoryLower === "⚽ processing team players" || 
                     categoryLower === "processing team players" ||
                     (categoryLower.includes("processing") && categoryLower.includes("player"))) {
            stepIndex = 6; // Index for "⚽ Processing team players"
          }
        }
        
        if (stepIndex === -1) {
          const normalizedCurrent = normalizeStepName(data.current_category);
          stepIndex = PROCESSING_STEPS_INFO.findIndex(s => 
            normalizeStepName(s.name) === normalizedCurrent
          );
        }
        
        if (stepIndex >= 0) {
          setTeamStepProgress(prev => ({
            ...prev,
            [data.current_team as string]: Math.max(stepIndex, prev[data.current_team as string] || -1)
          }));

          // Check if "🎯 Team formations and tactics" step just completed
          const tacticsStepIndex = PROCESSING_STEPS_INFO.findIndex(s => s.name === "🎯 Team formations and tactics");
          console.log(`[Step Progress] Current step: ${stepIndex}, Tactics step index: ${tacticsStepIndex}, Category: "${data.current_category}"`);
          
          if (stepIndex === tacticsStepIndex && data.current_team) {
            const team = selectedTeams.find(t => t.teamname === data.current_team);
            if (team) {
              console.log(`[Formation Data] Tactics step completed for ${data.current_team}, fetching formation data...`);
              fetchFormationData(data.current_team, team.team_id);
            }
          }
          
          // Also try to fetch formation data when we're one step past tactics
          if (stepIndex === tacticsStepIndex + 1 && data.current_team) {
            const team = selectedTeams.find(t => t.teamname === data.current_team);
            if (team && !formationData[data.current_team]) {
              console.log(`[Formation Data] One step past tactics, attempting fetch for ${data.current_team}...`);
              fetchFormationData(data.current_team, team.team_id);
            }
          }
        }
      }
    }
  
    if (data.status === 'completed') {
      setIsComplete(true);
      setIsProcessing(false);
      setShowSuccessModal(true);
      // Auto-close modal after 5 seconds
      successTimerRef.current = setTimeout(() => {
        setShowSuccessModal(false);
        successTimerRef.current = null;
      }, 5000);
    } else if (data.status === 'error') {
      setError(data.message || 'An error occurred');
      setIsProcessing(false);
    }
  }, [selectedTeams, completedTeams, progressData, savedPlayerRatings, playerSaveStatus, teamData, lastKnownPlayerIndex, activePlayerState, isComplete, fetchFormationData]);

  const startAddingTeams = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setIsComplete(false);
    setCompletedTeams(new Set());
    setCurrentTeamIndex(-1);
    setTeamData({});
    previousProgressRef.current = 0;
    setTeamStepProgress({});
    setPlayerSaveStatus({});
    setSavedPlayerRatings({});
    setActivePlayerState({});
    setFirstCardAnimationDelay({});
    setFirstCardAnimationState({});
    setFormationData({});
    setTeamSheetData({});
    setPlayerNames({});

    try {
      const response = await fetch('http://localhost:8000/teams/add-from-transfermarkt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teams: selectedTeams,
          project_id: projectId,
          league_id: leagueId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add teams');
      }

      const result = await response.json();
      console.log('[AddTeams] API response:', result);
    } catch (error) {
      console.error('[AddTeams] Error adding teams:', error);
      setError(error instanceof Error ? error.message : 'Failed to add teams');
      setIsProcessing(false);
    }
  }, [selectedTeams, projectId, leagueId]);

  const handleSuccessModalClose = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setShowSuccessModal(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isProcessing) return;
    
    setIsProcessing(false);
    setProgressData(null);
    setCompletedTeams(new Set());
    setCurrentTeamIndex(-1);
    setTeamData({});
    setError(null);
    setIsComplete(false);
    previousProgressRef.current = 0;
    setTeamStepProgress({});
    setPlayerSaveStatus({});
    setSavedPlayerRatings({});
    setActivePlayerState({});
    setFirstCardAnimationDelay({});
    setFirstCardAnimationState({});
    setFormationData({});
    setTeamSheetData({});
    setPlayerNames({});
    handleSuccessModalClose();
    
    onClose();
  }, [isProcessing, handleSuccessModalClose, onClose]);

  const getStepStatus = useCallback((stepIndex: number, currentTeam: TransfermarktTeam) => {
    const currentStep = progressData?.current_category;
    const isCurrentTeam = currentTeam.teamname === progressData?.current_team;
    
    if (!isCurrentTeam) {
      const teamId = selectedTeams.find(t => t.teamname === currentTeam.teamname)?.team_id;
      return completedTeams.has(teamId || '') ? 'completed' : 'pending';
    }
    
    const savedStepIndex = teamStepProgress[currentTeam.teamname] || -1;
    
    let currentStepIndex = -1;
    if (currentStep) {
      currentStepIndex = PROCESSING_STEPS_INFO.findIndex(s => s.name === currentStep);
      
      if (currentStepIndex === -1) {
        const categoryLower = currentStep.toLowerCase();
        if (categoryLower === "💾 saving team players" || 
            categoryLower === "saving team players" ||
            (categoryLower.includes("saving") && categoryLower.includes("player"))) {
          currentStepIndex = 7;
        } else if (categoryLower === "⚽ processing team players" || 
                   categoryLower === "processing team players" ||
                   (categoryLower.includes("processing") && categoryLower.includes("player"))) {
          currentStepIndex = 6;
        }
      }
      
      if (currentStepIndex === -1) {
        const normalizedCurrent = normalizeStepName(currentStep);
        currentStepIndex = PROCESSING_STEPS_INFO.findIndex(s => 
          normalizeStepName(s.name) === normalizedCurrent
        );
      }
    }
    
    const effectiveStepIndex = currentStepIndex >= 0 
      ? Math.max(currentStepIndex, savedStepIndex) 
      : savedStepIndex;
    
    if (effectiveStepIndex === -1) return 'pending';
    if (stepIndex < effectiveStepIndex) return 'completed';
    if (stepIndex === effectiveStepIndex) return 'active';
    return 'pending';
  }, [progressData, completedTeams, selectedTeams, teamStepProgress]);

  const currentTeam = useMemo(() => 
    currentTeamIndex >= 0 && currentTeamIndex < selectedTeams.length 
      ? selectedTeams[currentTeamIndex] 
      : null,
    [currentTeamIndex, selectedTeams]
  );
  
  const currentTeamData = useMemo(() => 
    currentTeam ? teamData[currentTeam.teamname] || {} : {},
    [currentTeam, teamData]
  );
  
  // Memoize expensive calculations
  const totalSteps = useMemo(() => selectedTeams.length * PROCESSING_STEPS_INFO.length, [selectedTeams.length]);
  const completedSteps = useMemo(() => completedTeams.size * PROCESSING_STEPS_INFO.length, [completedTeams.size]);
  
  let overallProgress = 0;
  
  if (progressData?.percentage !== undefined && progressData.percentage >= 0) {
    overallProgress = Math.min(progressData.percentage, 100);
  } else {
    let currentTeamCompletedSteps = 0;
    if (currentTeam && progressData?.current_category) {
      let foundIndex = PROCESSING_STEPS_INFO.findIndex(s => s.name === progressData.current_category);
      
      if (foundIndex === -1) {
        const normalizedCurrent = normalizeStepName(progressData.current_category);
        foundIndex = PROCESSING_STEPS_INFO.findIndex(s => 
          normalizeStepName(s.name) === normalizedCurrent
        );
      }
      
      currentTeamCompletedSteps = foundIndex >= 0 ? foundIndex + 1 : 0;
    }
    
    const totalCompletedSteps = completedSteps + currentTeamCompletedSteps;
    overallProgress = totalSteps > 0 ? Math.min((totalCompletedSteps / totalSteps) * 100, 100) : 0;
  }
  
  if (overallProgress < previousProgressRef.current && isProcessing) {
    overallProgress = previousProgressRef.current;
  } else {
    previousProgressRef.current = overallProgress;
  }

  const isShowingPlayerSaveDetails = currentTeam && 
                                     progressData?.current_category?.toLowerCase().includes('saving') && 
                                     progressData?.current_category?.toLowerCase().includes('player') &&
                                     (progressData?.player_index !== undefined || progressData?.current_player) &&
                                     !isComplete;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="5xl"
      placement="center"
      isDismissable={!isProcessing}
      hideCloseButton={isProcessing}
      scrollBehavior="inside"
      classNames={{
        backdrop: "bg-black/50 backdrop-blur-sm",
        base: "bg-gradient-to-br from-white to-default-50 dark:from-default-100 dark:to-default-50 max-h-[85vh] max-w-[90vw]",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 pb-1">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-primary-100 rounded-lg">
                  <Icon icon="lucide:plus-circle" className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-livesport-bold">Add Teams to Game</h2>
                  <p className="text-xs text-default-500">
                    {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              </div>
              
              {/* Progress information positioned to the right of the title */}
              {isProcessing && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">Overall Progress</span>
                    <span className="text-xs text-default-500">
                      {completedTeams.size} of {selectedTeams.length} teams completed
                      {progressData?.current !== undefined && progressData.current < selectedTeams.length && 
                        ` • Team ${progressData.current + 1}/${selectedTeams.length}`}
                    </span>
                  </div>
                  <Progress
                    value={overallProgress}
                    color="primary"
                    size="sm"
                    showValueLabel
                    aria-label="Overall progress"
                    className="w-64"
                  />
                </div>
              )}
            </div>
          </div>

          
          {/* Teams list in header */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {selectedTeams.map((team, index) => {
              const isCurrentTeam = index === currentTeamIndex;
              const isCompleted = completedTeams.has(team.team_id);
              
              return (
                <button
                  key={team.team_id}
                  onClick={() => {
                    if (isComplete || (isProcessing && index !== currentTeamIndex)) {
                      setCurrentTeamIndex(index);
                    }
                  }}
                  disabled={!isComplete && (!isProcessing || index === currentTeamIndex)}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-400 text-green-700 dark:text-green-300'
                      : isCurrentTeam 
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300' 
                      : 'bg-gray-100 dark:bg-gray-900/30 border border-gray-300 text-gray-700 dark:text-gray-300'
                  } ${(isComplete || (isProcessing && index !== currentTeamIndex)) ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                >
                  <Image
                    src={team.teamlogo}
                    alt={team.teamname}
                    width={16}
                    height={16}
                    className="object-contain flex-shrink-0"
                  />
                  <span className="truncate max-w-[120px]" title={team.teamname}>
                    {team.teamname}
                  </span>
                </button>
              );
            })}
          </div>
        </ModalHeader>

        <ModalBody className="gap-0 p-2">
          <div className="grid grid-cols-12 gap-2 h-[65vh]">
            {/* Left Column - Current Team Info */}
            <div className="col-span-2 bg-zinc-900 dark:bg-black-100 rounded-lg flex flex-col">
              <h3 className="font-semibold text-xs text-gray-200 p-2 pb-1 flex items-center gap-1 flex-shrink-0 font-livesport-bold">
                <Icon icon="lucide:info" className="w-4 h-4" />
                Team Info
              </h3>
              <div className="p-2">
                {currentTeam ? (
                  <div className="flex flex-col items-center gap-3">
                    {/* Team Logo */}
                    <Image
                      src={currentTeam.teamlogo}
                      alt={currentTeam.teamname}
                      width={64}
                      height={64}
                      className="object-contain"
                    />
                    
                    {/* Team Name */}
                    <div className="text-center">
                      <h4 className="font-bold text-sm text-center leading-tight text-white font-livesport-bold" title={currentTeam.teamname}>
                        {currentTeam.teamname}
                      </h4>
                      
                      {/* Team ID */}
                      {currentTeamData.teamid && (
                        <p className="text-xs text-gray-400 mt-1">
                          ID: {currentTeamData.teamid}
                        </p>
                      )}
                    </div>
                    
                    {/* Team Colors */}
                    {currentTeamData.teamcolor1r && (
                      <div className="w-full">
                        <p className="text-xs text-gray-400 mb-2 text-center">Team Colors</p>
                        <div className="flex justify-center items-center gap-2">
                          <Tooltip content="Primary" placement="bottom" delay={0} closeDelay={0}>
                            <div
                              className="w-6 h-6 rounded-full border-2 border-default-300 dark:border-default-500 shadow-sm cursor-default"
                              style={{ backgroundColor: `rgb(${currentTeamData.teamcolor1r}, ${currentTeamData.teamcolor1g}, ${currentTeamData.teamcolor1b})` }}
                            />
                          </Tooltip>
                          <Tooltip content="Secondary" placement="bottom" delay={0} closeDelay={0}>
                            <div
                              className="w-6 h-6 rounded-full border-2 border-default-300 dark:border-default-500 shadow-sm cursor-default"
                              style={{ backgroundColor: `rgb(${currentTeamData.teamcolor2r}, ${currentTeamData.teamcolor2g}, ${currentTeamData.teamcolor2b})` }}
                            />
                          </Tooltip>
                          <Tooltip content="Tertiary" placement="bottom" delay={0} closeDelay={0}>
                            <div
                              className="w-6 h-6 rounded-full border-2 border-default-300 dark:border-default-500 shadow-sm cursor-default"
                              style={{ backgroundColor: `rgb(${currentTeamData.teamcolor3r}, ${currentTeamData.teamcolor3g}, ${currentTeamData.teamcolor3b})` }}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    )}

                    {/* Team Ratings */}
                    {currentTeamData.overallrating && (!isShowingPlayerSaveDetails || isComplete) && (
                      <div className="w-full">
                        <p className="text-xs text-gray-400 mb-2 text-center">Team Ratings</p>
                        <div className="space-y-1">
                          <div className="bg-default-100/70 dark:bg-default-500/30 p-1 px-2 rounded text-center">
                            <span className="text-[9px] text-default-500 dark:text-default-700 block">OVERALL</span>
                            <span className="text-sm text-black dark:text-white font-bold">{currentTeamData.overallrating}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <div className="bg-danger-100/70 dark:bg-danger-500/30 p-1 rounded text-center">
                              <span className="text-[8px] text-danger-600 dark:text-danger-700 block">ATT</span>
                              <span className="text-xs text-danger-900 dark:text-danger-500 font-bold">{currentTeamData.attackrating}</span>
                            </div>
                            <div className="bg-warning-100/70 dark:bg-warning-500/30 p-1 rounded text-center">
                              <span className="text-[8px] text-yellow-600 dark:text-yellow-400 block">MID</span>
                              <span className="text-xs text-yellow-900 dark:text-yellow-500 font-bold">{currentTeamData.midfieldrating}</span>
                            </div>
                            <div className="bg-primary-100/70 dark:bg-primary-500/30 p-1 rounded text-center">
                              <span className="text-[8px] text-primary-600 dark:text-primary-700 block">DEF</span>
                              <span className="text-xs text-primary-900 dark:text-primary-500 font-bold">{currentTeamData.defenserating}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Basic Info */}
                    <div className="w-full space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Squad:</span>
                        <span className="font-medium text-white">{currentTeam.squad}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Avg Age:</span>
                        <span className="font-medium text-white">{currentTeam.avg_age}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Foreigners:</span>
                        <span className="font-medium text-white">{currentTeam.foreigners}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Value:</span>
                        <span className="font-medium text-white">{currentTeam.total_market_value}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <Icon icon="lucide:help-circle" className="w-8 h-8 mb-2" />
                    <p className="text-xs text-center">No team selected</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Main Content */}
            <div className="col-span-10 flex flex-col h-full min-h-0 px-2 pb-2">
              {currentTeam ? (
                <div className="space-y-2">
                  {/* Error message */}
                  {error && (
                    <Card className="bg-danger-50 border border-danger-200">
                      <CardBody className="p-2">
                        <div className="flex items-center gap-2">
                          <Icon icon="lucide:alert-circle" className="w-4 h-4 text-danger" />
                          <span className="text-xs text-danger">{error}</span>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                    {/* Player Save Progress - Show when saving players AND not complete */}
                    {(() => {
                      const shouldShowSaving = isShowingPlayerSaveDetails && currentTeam && !isComplete;
                      if (currentTeam) {
                        console.log(`[Saving Players Display] Team: ${currentTeam.teamname}`, {
                          shouldShowSaving,
                          isShowingPlayerSaveDetails,
                          isComplete,
                          currentCategory: progressData?.current_category,
                          playerIndex: progressData?.player_index,
                          currentPlayer: progressData?.current_player
                        });
                      }
                      return shouldShowSaving;
                    })() && (
                      <Card>
                        <CardBody className="p-2">
                          <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Icon icon="lucide:save" className="w-4 h-4" />
                            Saving Players
                            {/* Always show progress when saving players */}
                            {(() => {
                              const fallbackIndex = lastKnownPlayerIndex[currentTeam.teamname] || 0;
                              const currentIndex = progressData?.player_index !== undefined ? progressData.player_index : fallbackIndex;
                              const totalPlayers = progressData?.total_players || currentTeamData.parsed_players_for_table?.length || 0;
                              
                              if (totalPlayers > 0) {
                                return (
                                  <>
                                    <span className="text-xs font-normal text-default-500">
                                      ({currentIndex + 1}/{totalPlayers})
                                    </span>
                                    <Chip size="sm" color="primary" variant="flat" className="h-5 ml-1">
                                      <span className="text-[10px]">
                                        {`${Math.round(((currentIndex + 1) / totalPlayers) * 100)}%`}
                                      </span>
                                    </Chip>
                                  </>
                                );
                              }
                              return null;
                            })()}
                            {/* Always show current player info when saving */}
                            {(() => {
                              const currentPlayerName = progressData?.current_player || progressData?.current_processing_player;
                              const fallbackIndex = lastKnownPlayerIndex[currentTeam.teamname] || 0;
                              const currentIndex = progressData?.player_index !== undefined ? progressData.player_index : fallbackIndex;
                              
                              // Try multiple sources for rating
                              const progressRating = progressData?.player_overall_rating;
                              const savedRating = savedPlayerRatings[currentTeam.teamname]?.[currentIndex];
                              const playerStatusRating = playerSaveStatus[currentTeam.teamname]?.[currentIndex]?.overall_rating;
                              
                              // Try to get rating from players processing progress  
                              const playerKey = `${currentTeam.teamname}_${currentIndex}`;
                              const processingRating = progressData?.players_processing_progress?.[playerKey]?.overall_rating;
                              
                              const fallbackRating = currentTeamData.parsed_players_for_table?.[currentIndex]?.overall_rating;
                              
                              const currentRating = progressRating || savedRating || playerStatusRating || processingRating || fallbackRating;
                              
                              // If no player name from progress, try to get from parsed players
                              const fallbackPlayerName = currentTeamData.parsed_players_for_table?.[currentIndex]?.name;
                              const displayPlayerName = currentPlayerName || fallbackPlayerName || `Player ${currentIndex + 1}`;
                              
                              // Debug log for header display
                              console.log('[Saving Players Header]', {
                                currentPlayerName,
                                currentIndex,
                                fallbackIndex,
                                currentRating,
                                fallbackPlayerName,
                                displayPlayerName,
                                totalPlayers: progressData?.total_players || currentTeamData.parsed_players_for_table?.length,
                                indexSources: {
                                  progressIndex: progressData?.player_index,
                                  fallbackIndex,
                                  finalIndex: currentIndex
                                },
                                ratingSources: {
                                  progressRating,
                                  savedRating,
                                  playerStatusRating,
                                  processingRating,
                                  fallbackRating,
                                  finalRating: currentRating,
                                  playerKey
                                },
                                progressData: {
                                  player_index: progressData?.player_index,
                                  current_player: progressData?.current_player,
                                  player_overall_rating: progressData?.player_overall_rating,
                                  total_players: progressData?.total_players
                                }
                              });
                              
                              return (
                                <span className="text-xs font-normal text-primary-600 animate-pulse">
                                  • {displayPlayerName}
                                  {(currentRating !== undefined && currentRating !== null) && (
                                    <span className="ml-1 text-success-600 font-bold">
                                      (OVR: {currentRating})
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </h5>
                          <div className="grid gap-2 auto-rows-[96px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            {(playerSaveStatus[currentTeam.teamname] || currentTeamData.parsed_players_for_table?.map((p: any) => ({
                              name: p.name,
                              status: 'pending' as const,
                              position: p.position
                            })) || []).map((player, idx) => {
                              // Получаем данные игрока из основной таблицы
                              const basePlayerData = currentTeamData.parsed_players_for_table?.[idx];
                              
                              // УЛУЧШЕННАЯ ЛОГИКА: Более стабильное определение текущего игрока
                              const isCurrentPlayer = Boolean(
                                currentTeam &&
                                activePlayerState[currentTeam.teamname] === idx &&
                                progressData?.current_category?.includes('💾 Saving team players')
                              );
                              
                              // Дебаг логи только для текущего игрока
                              if (isCurrentPlayer) {
                                console.log(`🟢 [АКТИВНЫЙ ИГРОК] ${idx}: "${player.name}"`, {
                                  team: progressData?.current_team,
                                  player_index: progressData?.player_index,
                                  category: progressData?.current_category,
                                  current_player: progressData?.current_player,
                                  rating: progressData?.player_overall_rating
                                });
                              }
                              
                              // Update status if this is the current player
                              const displayStatus = isCurrentPlayer ? 'saving' : player.status;
                              
                              // Унифицированные данные для отображения
                              const displayPlayerName = basePlayerData?.name || player.name || 'Unknown Player';
                              
                              // IMPORTANT: Always check all sources for rating data
                              const displayOverallRating = (() => {
                                // ULTRAFIX: For first player card (idx === 0), delay live rating to allow animation
                                // 1. If this is the current player being processed, use the live rating (but delayed for first card)
                                if (isCurrentPlayer && progressData?.player_overall_rating !== undefined) {
                                  // For first card, check if we should delay the rating to allow animation
                                  if (idx === 0) {
                                    // Check if we have a saved rating already - if not, this might be the first time
                                    const hasSavedRating = savedPlayerRatings[currentTeam.teamname]?.[idx] !== undefined;
                                    if (!hasSavedRating) {
                                      const teamName = currentTeam.teamname;
                                      const currentTime = Date.now();
                                      const delayedRating = progressData.player_overall_rating;
                                      
                                      // Store the delayed rating
                                      setFirstCardAnimationDelay(prev => ({
                                        ...prev,
                                        [teamName]: { delayedRating, timestamp: currentTime }
                                      }));
                                      
                                      console.log(`🎯 [FIRST CARD ANIMATION PROTECTION] Storing delayed rating ${delayedRating} for first card`);
                                      
                                      // Set timer to release the rating after animation time
                                      setTimeout(() => {
                                        setFirstCardAnimationDelay(prev => {
                                          const entry = prev[teamName];
                                          if (entry && entry.timestamp === currentTime) {
                                            // This is still the current delayed rating, release it
                                            console.log(`🎯 [FIRST CARD ANIMATION PROTECTION] Releasing delayed rating ${entry.delayedRating}`);
                                            setSavedPlayerRatings(prevRatings => ({
                                              ...prevRatings,
                                              [teamName]: {
                                                ...prevRatings[teamName] || {},
                                                [idx]: entry.delayedRating
                                              }
                                            }));
                                            
                                            // Remove from delayed state
                                            const newDelay = { ...prev };
                                            delete newDelay[teamName];
                                            return newDelay;
                                          }
                                          return prev;
                                        });
                                      }, 1500); // 1.5 seconds delay to allow animation
                                      
                                      // Don't return the live rating immediately - let it animate first
                                      return undefined;
                                    }
                                  }
                                  return progressData.player_overall_rating;
                                }
                                
                                // 2. Check the saved ratings storage
                                const savedRating = savedPlayerRatings[currentTeam.teamname]?.[idx];
                                if (savedRating !== undefined) {
                                  return savedRating;
                                }
                                
                                // 3. Check the player save status data
                                if (player.overall_rating !== undefined) {
                                  return player.overall_rating;
                                }
                                
                                // 4. No rating available
                                return undefined;
                              })();
                              
                              const displaySavingPotential = (() => {
                                // 1. If this is the current player being processed, use the live potential
                                if (isCurrentPlayer && progressData?.player_potential !== undefined) {
                                  return progressData.player_potential;
                                }
                                
                                // 2. Check the player save status data
                                if (player.potential !== undefined) {
                                  return player.potential;
                                }
                                
                                // 3. Check base player data
                                if (basePlayerData?.potential !== undefined) {
                                  return basePlayerData.potential;
                                }
                                
                                // 4. No potential available
                                return undefined;
                              })();
                              
                              // Enhanced debugging for first card animation protection
                              if (idx === 0) {
                                console.log(`🎯 [FIRST CARD RENDER] Player ${idx} ${displayPlayerName}:`, {
                                  status: displayStatus,
                                  rating: displayOverallRating,
                                  isCurrentPlayer,
                                  progressRating: progressData?.player_overall_rating,
                                  savedRating: savedPlayerRatings[currentTeam.teamname]?.[idx],
                                  hasSavedRating: savedPlayerRatings[currentTeam.teamname]?.[idx] !== undefined,
                                  delayedState: firstCardAnimationDelay[currentTeam.teamname],
                                  externalAnimationState: firstCardAnimationState[currentTeam.teamname],
                                  willGetLiveRating: isCurrentPlayer && progressData?.player_overall_rating !== undefined
                                });
                              } else {
                                console.log(`[Card Render] Player ${idx} ${displayPlayerName}: status=${displayStatus}, rating=${displayOverallRating}, isCurrentPlayer=${isCurrentPlayer}`);
                              }
                              
                              // ULTRAFIX: Super-stable key for first player to prevent re-mounts
                              const superStableKey = idx === 0 
                                ? `FIRST-PLAYER-${currentTeam.team_id}-${basePlayerData?.name || player.name}`
                                : `player-${currentTeam.teamname}-${basePlayerData?.name || player.name || idx}`;
                              
                              // ULTRAFIX: Animation complete callback for first card
                              const onAnimationComplete = idx === 0 ? () => {
                                console.log(`🎬 [EXTERNAL ANIMATION] First card animation completed, clearing state`);
                                setFirstCardAnimationState(prev => {
                                  const newState = { ...prev };
                                  delete newState[currentTeam.teamname];
                                  return newState;
                                });
                              } : undefined;
                              
                              return (
                                <PlayerCardFromAddTeam
                                  key={superStableKey}
                                  player={player}
                                  playerIndex={idx}
                                  currentTeam={currentTeam}
                                  basePlayerData={basePlayerData}
                                  isCurrentPlayer={isCurrentPlayer}
                                  displayOverallRating={displayOverallRating}
                                  displayPotential={displaySavingPotential}
                                  displayStatus={displayStatus}
                                  leagueId={leagueId}
                                  projectId={projectId}
                                  externalAnimationState={idx === 0 ? firstCardAnimationState[currentTeam.teamname] : undefined}
                                  onAnimationComplete={onAnimationComplete}
                                />
                              );
                            })}
                          </div>
                        </CardBody>
                      </Card>
                    )}

                    {/* Players - Show ONLY when complete OR when not saving players */}
                    {(() => {
                      const shouldShow = currentTeamData.parsed_players_for_table && 
                                       currentTeamData.parsed_players_for_table.length > 0 && 
                                       (!isShowingPlayerSaveDetails || isComplete);
                      
                      if (currentTeam && currentTeamData.parsed_players_for_table?.length > 0) {
                        console.log(`[Players Display] Team: ${currentTeam.teamname}`, {
                          shouldShow,
                          isShowingPlayerSaveDetails,
                          isComplete,
                          playerSaveStatusLength: playerSaveStatus[currentTeam.teamname]?.length || 0,
                          currentCategory: progressData?.current_category,
                          playerIndex: progressData?.player_index,
                          currentPlayer: progressData?.current_player
                        });
                      }
                      
                      return shouldShow;
                    })() && (
                      <Card>
                        <CardBody className="p-2">
                          <h5 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <Icon icon="lucide:users" className="w-3 h-3" />
                            Players ({currentTeamData.parsed_players_for_table.length})
                            {isComplete && <Chip size="sm" color="success" variant="flat" className="ml-2 h-4"><span className="text-[10px]">Final Data</span></Chip>}
                          </h5>
                          <div className="grid gap-2 auto-rows-[96px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            {currentTeamData.parsed_players_for_table.map((player: any, idx: number) => {
                              // Get saved player data if available
                              const savedPlayerData = playerSaveStatus[currentTeam.teamname]?.[idx];
                              
                              // Get rating from separate storage first, then fallback to saved player data
                              const savedRating = savedPlayerRatings[currentTeam.teamname]?.[idx];
                              const displayOverallRating = savedRating ?? savedPlayerData?.overall_rating ?? player.overall_rating; // Prioritize savedRating, then playerSaveStatus, then original
                              
                              // Get potential from multiple sources
                              const displayPotential = savedPlayerData?.potential ?? player.potential;
                              
                              // Player is considered saved if:
                              // 1. Process is complete, OR
                              // 2. Player status is explicitly 'saved', OR  
                              // 3. We have saved rating data (means player was processed)
                              const isSaved = isComplete || 
                                            savedPlayerData?.status === 'saved' || 
                                            (savedRating !== undefined && !isShowingPlayerSaveDetails);
                              
                              // Унифицированные данные для отображения (так же как в первой карточке)
                              const displayPlayerName = player.name || 'Unknown Player';
                              
                              // Debug logging
                              if (idx < 5) { // Only log first 5 players to avoid spam
                                console.log(`[Final Player ${idx}] ${displayPlayerName}:`, {
                                  isComplete,
                                  isShowingPlayerSaveDetails,
                                  savedPlayerData,
                                  savedRating,
                                  displayOverallRating,
                                  isSaved,
                                  originalRating: player.overall_rating,
                                  displayPlayerName,
                                  leagueId,
                                  projectId,
                                  cardWillShow: currentTeamData.parsed_players_for_table && 
                                              currentTeamData.parsed_players_for_table.length > 0 && 
                                              (!isShowingPlayerSaveDetails || isComplete || playerSaveStatus[currentTeam.teamname]?.length > 0),
                                  willPassToComponent: {
                                    displayOverallRating,
                                    displayStatus: isSaved ? 'saved' : 'pending',
                                    leagueId,
                                    projectId
                                  }
                                });
                              }
                              
                              // ULTRAFIX: Super-stable key for first player to prevent re-mounts  
                              const superStableKey = idx === 0
                                ? `FIRST-PLAYER-${currentTeam.team_id}-${player.name}`
                                : `player-${currentTeam.teamname}-${player.name || idx}`;
                              
                              // ULTRAFIX: Animation complete callback for first card
                              const onAnimationComplete = idx === 0 ? () => {
                                console.log(`🎬 [EXTERNAL ANIMATION] First card animation completed in Players section, clearing state`);
                                setFirstCardAnimationState(prev => {
                                  const newState = { ...prev };
                                  delete newState[currentTeam.teamname];
                                  return newState;
                                });
                              } : undefined;
                              
                              return (
                                <PlayerCardFromAddTeam
                                  key={superStableKey}
                                  player={{
                                    name: displayPlayerName,
                                    status: isSaved ? 'saved' : 'pending',
                                    position: savedPlayerData?.position || player.position || 'CM',
                                    overall_rating: displayOverallRating,
                                    potential: displayPotential
                                  }}
                                  playerIndex={idx}
                                  currentTeam={currentTeam}
                                  basePlayerData={player}
                                  isCurrentPlayer={false}
                                  displayOverallRating={displayOverallRating}
                                  displayPotential={displayPotential}
                                  displayStatus={isSaved ? 'saved' : 'pending'}
                                  leagueId={leagueId}
                                  projectId={projectId}
                                  externalAnimationState={idx === 0 ? firstCardAnimationState[currentTeam.teamname] : undefined}
                                  onAnimationComplete={onAnimationComplete}
                                />
                              );
                            })}
                          </div>
                        </CardBody>
                      </Card>
                    )}

                    {/* Formation Visualization - Show when formation data is available */}
                    {(() => {
                      const shouldShowFormation = currentTeam && 
                        formationData[currentTeam.teamname] && 
                        teamSheetData[currentTeam.teamname] && 
                        currentTeamData.parsed_players_for_table && 
                        currentTeamData.parsed_players_for_table.length > 0 &&
                        (isComplete || (!isShowingPlayerSaveDetails && teamStepProgress[currentTeam.teamname] > 10));
                      
                      if (currentTeam) {
                        console.log(`[Formation Display Debug] Team: ${currentTeam.teamname}`, {
                          shouldShowFormation,
                          hasFormationData: !!formationData[currentTeam.teamname],
                          hasTeamSheetData: !!teamSheetData[currentTeam.teamname],
                          hasPlayerData: !!currentTeamData.parsed_players_for_table,
                          isComplete,
                          isShowingPlayerSaveDetails,
                          teamStepProgress: teamStepProgress[currentTeam.teamname],
                          stepProgressCondition: teamStepProgress[currentTeam.teamname] > 10,
                          finalCondition: (isComplete || (!isShowingPlayerSaveDetails && teamStepProgress[currentTeam.teamname] > 10)),
                          formationDataKeys: Object.keys(formationData),
                          teamSheetDataKeys: Object.keys(teamSheetData),
                          currentTeamId: currentTeam.team_id,
                          hasTeamData: !!currentTeamData.teamid,
                          playerNamesCount: Object.keys(playerNames).length
                        });
                        
                        // Manual fetch attempt if data is missing but step progress indicates it should be available
                        if (!formationData[currentTeam.teamname] && 
                            !teamSheetData[currentTeam.teamname] && 
                            teamStepProgress[currentTeam.teamname] > 10 && 
                            currentTeamData.parsed_players_for_table) {
                          console.log(`[Formation Display Debug] Attempting manual fetch for ${currentTeam.teamname}`);
                          fetchFormationData(currentTeam.teamname, currentTeamData.teamid || currentTeam.team_id);
                        }
                      }
                      
                      return shouldShowFormation;
                    })() && (
                      <FootballPitch
                        formation={formationData[currentTeam.teamname]}
                        teamSheet={teamSheetData[currentTeam.teamname]}
                        players={currentTeamData.parsed_players_for_table.map((p: any, idx: number) => {
                          // Enhanced logging to debug field names
                          const allKeys = Object.keys(p);
                          const nameRelatedKeys = allKeys.filter(key => 
                            key.toLowerCase().includes('name') || 
                            key.toLowerCase().includes('first') || 
                            key.toLowerCase().includes('last') ||
                            key.toLowerCase().includes('common') ||
                            key.toLowerCase().includes('jersey')
                          );
                          
                          console.log(`[AddTeams] Mapping player ${idx} (${p.name || 'Unknown'}):`, {
                            playerKeys: allKeys,
                            nameRelatedKeys,
                            // Check all possible name field variations
                            name: p.name,
                            commonname: p.commonname,
                            firstnameid: p.firstnameid,
                            lastnameid: p.lastnameid,
                            firstname_id: p.firstname_id,
                            lastname_id: p.lastname_id,
                            first_name_id: p.first_name_id,
                            last_name_id: p.last_name_id,
                            jerseynumber: p.jerseynumber,
                            jersey_number: p.jersey_number
                          });
                          
                          return {
                            playerid: p.playerid || p.player_id || p.id || idx.toString(),
                            name: p.name,
                            position: p.position,
                            overall_rating: savedPlayerRatings[currentTeam.teamname]?.[idx] || p.overall_rating,
                            potential: p.potential,
                            commonname: p.commonname,
                            // Try multiple field name variations for firstnameid/lastnameid
                            firstnameid: p.firstnameid || p.firstname_id || p.first_name_id,
                            lastnameid: p.lastnameid || p.lastname_id || p.last_name_id,
                            jerseynumber: p.jerseynumber || p.jersey_number || p.shirtNumber || p.number || (idx + 1).toString()
                          };
                        })}
                        teamName={currentTeam.teamname}
                        playerNames={playerNames}
                        projectId={projectId}
                      />
                    )}

                    {/* Debug: Manual Formation Fetch Button */}
                    {currentTeam && !isProcessing && (
                      <Card className="mt-2">
                        <CardBody className="p-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              onPress={() => {
                                console.log(`[Load Formation] Creating formation for ${currentTeam.teamname} (ID: ${currentTeamData.teamid || currentTeam.team_id})`);
                                console.log(`[Load Formation] Current team data:`, {
                                  teamName: currentTeam.teamname,
                                  teamId: currentTeamData.teamid || currentTeam.team_id,
                                  playersCount: currentTeamData.parsed_players_for_table?.length || 0,
                                  projectId,
                                  hasPlayerNames: Object.keys(playerNames).length > 0,
                                  currentFormationData: formationData[currentTeam.teamname],
                                  currentTeamSheetData: teamSheetData[currentTeam.teamname]
                                });
                                fetchFormationData(currentTeam.teamname, currentTeamData.teamid || currentTeam.team_id);
                              }}
                              startContent={<Icon icon="lucide:play" className="w-4 h-4" />}
                            >
                              Show Formation
                            </Button>
                            <span className="text-xs text-default-500">
                              Debug: Step {teamStepProgress[currentTeam.teamname] || 0}, 
                              Formation: {formationData[currentTeam.teamname] ? '✓' : '✗'}, 
                              TeamSheet: {teamSheetData[currentTeam.teamname] ? '✓' : '✗'},
                              Names: {Object.keys(playerNames).length > 0 ? `✓(${Object.keys(playerNames).length})` : '✗'}
                            </span>
                          </div>
                        </CardBody>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-default-400">
                    <Icon icon="lucide:file-text" className="w-12 h-12 mb-2" />
                    <p className="text-sm">No team selected</p>
                    <p className="text-xs">Start processing to see team details</p>
                  </div>
                )}
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="pt-1 pb-2 justify-center">
          {/* Processing Steps Icons */}
          {(isProcessing || isComplete) && currentTeam && (
            <div className="flex items-center gap-1 px-2 overflow-x-auto max-w-full">
              {PROCESSING_STEPS_INFO.map((step, index) => {
                const status = getStepStatus(index, currentTeam);
                
                return (
                  <Tooltip
                    key={index}
                    content={step.name}
                    placement="top"
                    delay={0}
                    closeDelay={100}
                    size="sm"
                    showArrow
                  >
                    <div className={`p-1.5 rounded-full transition-all duration-300 flex-shrink-0 ${
                      status === 'active' 
                        ? 'bg-primary-500 text-white shadow-md scale-110' 
                        : status === 'completed'
                        ? 'bg-success-500 text-white'
                        : 'bg-default-200 text-default-400'
                    }`}>
                      <Icon 
                        icon={status === 'completed' ? 'lucide:check' : step.icon} 
                        className="w-3 h-3" 
                      />
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {/* Action Buttons - Only when not processing */}
          {!isProcessing && !isComplete && (
            <>
              <Button
                color="danger"
                variant="light"
                onPress={handleClose}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={startAddingTeams}
                startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
                size="sm"
              >
                Start Adding Teams
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>

    {/* Success Modal */}
    <Modal 
      isOpen={showSuccessModal} 
      onClose={handleSuccessModalClose}
      size="sm"
      placement="center"
      backdrop="blur"
      isDismissable={true}
      isKeyboardDismissDisabled={false}
      classNames={{
        backdrop: "bg-green-500/30 backdrop-blur-xl",
        base: "bg-white dark:bg-zinc-900 border-2 border-green-400 shadow-2xl",
        closeButton: "absolute top-2 right-2 z-10 bg-green-500 hover:bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center",
      }}
    >
      <ModalContent>
        <ModalBody className="p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <Icon icon="lucide:check" className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-green-700 dark:text-green-400 mb-2 font-livesport-bold">
                Success!
              </h3>
              <p className="text-sm text-default-600 dark:text-default-400">
                Successfully added {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''}!
              </p>
            </div>
            <div className="w-full bg-default-200 dark:bg-default-700 rounded-full h-1">
              <div 
                className="bg-green-500 h-1 rounded-full transition-all duration-[5000ms] ease-linear"
                style={{ width: showSuccessModal ? '100%' : '0%' }}
              />
            </div>
            
            {/* Manual close button */}
            <Button
              color="success"
              variant="flat"
              size="sm"
              onPress={handleSuccessModalClose}
              className="mt-2"
              startContent={<Icon icon="lucide:check" className="w-4 h-4" />}
            >
              OK
            </Button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(AddTeams, (prevProps, nextProps) => {
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.selectedTeams.length === nextProps.selectedTeams.length &&
    prevProps.projectId === nextProps.projectId &&
    prevProps.leagueId === nextProps.leagueId &&
    JSON.stringify(prevProps.selectedTeams) === JSON.stringify(nextProps.selectedTeams)
  );
});