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
  const [isLoadingFormationData, setIsLoadingFormationData] = useState<{ [teamName: string]: boolean }>({});
  const [showFormation, setShowFormation] = useState<{ [teamName: string]: boolean }>({});
  const [teamProcessingOrder, setTeamProcessingOrder] = useState<{ [teamName: string]: number }>({});


  // Function to normalize step names for comparison
  const normalizeStepName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters and emojis
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  };

  // Function to fetch real formation and teamsheet data from the database
  const fetchFormationData = useCallback(async (teamName: string, teamId: string, targetTeamId?: string, force: boolean = false) => {
    // Prevent duplicate fetches for the same team, unless forced
    if (!force && formationData[teamName] && teamSheetData[teamName]) {
      // Check if the existing data is for the correct team
      const existingTeamSheet = teamSheetData[teamName];
      if (existingTeamSheet && targetTeamId && existingTeamSheet.teamid !== targetTeamId) {
        console.log(`[Formation Fetch] Existing data is for wrong team (${existingTeamSheet.teamid} != ${targetTeamId}), forcing refresh`);
        force = true;
      } else {
        console.log(`[Formation Fetch] Data already exists for ${teamName}, skipping fetch`);
        return;
      }
    }
    if (!projectId) {
      console.log(`[Formation Fetch] No projectId available for ${teamName}`);
      return;
    }
    
    console.log(`[Formation Fetch] Fetching real formation data for ${teamName} (ID: ${teamId}), project: ${projectId}`);
    
    try {
      // Fetch real formations data from the database
      const formationsResponse = await fetch(`http://localhost:8000/projects/${projectId}/formations`);
      if (!formationsResponse.ok) {
        throw new Error(`Failed to fetch formations: ${formationsResponse.status}`);
      }
      const formations = await formationsResponse.json();
      
      // Fetch real teamsheets data from the database  
      const teamsheetsResponse = await fetch(`http://localhost:8000/projects/${projectId}/teamsheets`);
      if (!teamsheetsResponse.ok) {
        throw new Error(`Failed to fetch teamsheets: ${teamsheetsResponse.status}`);
      }
      const teamsheets = await teamsheetsResponse.json();
      
      console.log(`[Formation Fetch] Received ${formations.length} formations and ${teamsheets.length} teamsheets`);
      
      // Find the teamsheet for this specific team
      // The key insight: we need to map the processing order to the correct teamsheet
      console.log(`[Formation Fetch] Looking for teamsheet for ${teamName} (Transfermarkt ID: ${teamId})`);
      console.log(`[Formation Fetch] Available teamsheets count: ${teamsheets.length}`);
      console.log(`[Formation Fetch] First few teamsheet IDs:`, teamsheets.slice(0, 5).map(ts => ts.teamid));
      
      // Use targetTeamId if provided (from tactics.py), otherwise try to get from teamData
      const currentTeamData = teamData[teamName] || {};
      const fifaTeamId = currentTeamData.teamid;
      
      // Priority: use targetTeamId (from parameter) > fifaTeamId (from teamData)
      const finalSearchTeamId = targetTeamId || fifaTeamId;
      
      console.log(`[Formation Fetch] Search info for ${teamName}:`, {
        targetTeamId,
        fifaTeamId,
        finalSearchTeamId,
        transfermarktTeamId: teamId,
        teamDataExists: !!currentTeamData.teamid,
        totalTeamsheets: teamsheets.length,
        totalFormations: formations.length,
        searchingForTeamId: finalSearchTeamId,
        teamsheetsWith131789: teamsheets.filter((ts: any) => ts.teamid === "131789").length,
        formationsWith131789: formations.filter((f: any) => f.teamid === "131789").length
      });
      
      // Try direct match with search team ID first (targetTeamId or fifaTeamId or uiFifaTeamId)
      let teamSheet = finalSearchTeamId ? teamsheets.find((sheet: any) => sheet.teamid === finalSearchTeamId) : null;
      
      if (teamSheet) {
        console.log(`[Formation Fetch] ✅ Found teamsheet by final search team ID ${finalSearchTeamId}`);
      } else if (finalSearchTeamId) {
        console.warn(`[Formation Fetch] ❌ Could not find teamsheet with final search team ID ${finalSearchTeamId}`);
      }
      
      // If teamSheet not found by correct ID, create an empty one and return
      if (!teamSheet) {
        console.error(`[Formation Fetch] ❌ TeamSheet not found for team ${teamName} with ID ${finalSearchTeamId}`);
        console.log(`[Formation Fetch] Available teamsheet IDs:`, teamsheets.slice(0, 20).map((ts: any) => ts.teamid));
        
        // Create a basic empty teamsheet
        const defaultTeamSheet: any = { teamid: finalSearchTeamId || teamId };
        for (let i = 0; i < 22; i++) {
          defaultTeamSheet[`playerid${i}`] = "-1";
        }
        setTeamSheetData(prev => ({ ...prev, [teamName]: defaultTeamSheet }));
        setFormationData(prev => ({ ...prev, [teamName]: null })); // No formation data
        return;
      }
      
      // Find the formation data (use first formation as default, or find team-specific one)
      let formationData = formations[0]; // Default to first formation
      
      // Try to find a specific formation for this team or use the default formation
      // Priority: finalSearchTeamId (should be the correct FIFA team ID)
      const teamSpecificFormation = formations.find((formation: any) => 
        formation.teamid === finalSearchTeamId
      );
      if (teamSpecificFormation) {
        formationData = teamSpecificFormation;
        console.log(`[Formation Fetch] Found specific formation for team ${finalSearchTeamId}:`, {
          formationTeamId: teamSpecificFormation.teamid,
          formationName: teamSpecificFormation.formationname,
          searchedId: finalSearchTeamId
        });
      } else {
        console.warn(`[Formation Fetch] No specific formation found for team ${finalSearchTeamId}, using default`);
        console.log(`[Formation Fetch] Available formation team IDs:`, formations.slice(0, 20).map((f: any) => f.teamid));
      }
      
      console.log(`[Formation Fetch] Using formation: ${formationData.formationname} for team ${teamName}`, {
        formationData: {
          name: formationData.formationname,
          positions: [0,1,2,3,4,5,6,7,8,9,10].map(i => ({
            position: formationData[`position${i}`],
            x: formationData[`offset${i}x`],
            y: formationData[`offset${i}y`]
          }))
        },
        teamSheet: {
          teamid: teamSheet.teamid,
          players: [0,1,2,3,4,5,6,7,8,9,10].map(i => ({
            index: i,
            playerid: teamSheet[`playerid${i}`]
          }))
        }
      });
      
      // Set the real data in state
      // IMPORTANT: Also store the actual FIFA teamid that will be used by FootballPitch
      const modifiedTeamSheet = { 
        ...teamSheet, 
        originalTeamId: teamSheet.teamid, 
        transfermarktTeamId: teamId,
        fifaTeamId: finalSearchTeamId || fifaTeamId || teamSheet.teamid // Store the FIFA team ID for reference
      };
      
      setFormationData(prev => ({ ...prev, [teamName]: formationData }));
      setTeamSheetData(prev => ({ ...prev, [teamName]: modifiedTeamSheet }));
      
      console.log(`[Formation Fetch] ✅ Successfully loaded formation and teamsheet for ${teamName}`);
      console.log(`[Formation Fetch] Team mapping: Transfermarkt ID ${teamId} -> FIFA teamid ${teamSheet.teamid} (fifaTeamId: ${fifaTeamId})`);
      console.log(`[Formation Fetch] TeamSheet playerid0:`, teamSheet.playerid0);

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
      console.error(`[Formation Fetch] Error fetching real formation data for ${teamName}:`, error);
      // Fallback to creating basic data if API calls fail
      console.log(`[Formation Fetch] Creating fallback data for ${teamName}`);
      const fallbackFormation = {
        formationname: "4-4-2",
        position0: "0", position1: "3", position2: "5", position3: "5", position4: "7",
        position5: "12", position6: "14", position7: "14", position8: "16",
        position9: "25", position10: "25",
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
      
      const fallbackTeamSheet: any = { teamid: teamId };
      for (let i = 0; i < 22; i++) {
        fallbackTeamSheet[`playerid${i}`] = "-1";
      }
      
      setFormationData(prev => ({ ...prev, [teamName]: fallbackFormation }));
      setTeamSheetData(prev => ({ ...prev, [teamName]: fallbackTeamSheet }));
    }
  }, [projectId, playerNames, formationData, teamSheetData, selectedTeams, completedTeams, teamProcessingOrder]);

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
                  targetRating: data.player_overall_rating!,
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
            console.log(`[Formation Data] Context: completed teams callback, selectedTeams count: ${selectedTeams.length}`);
            // Pass the FIFA team ID from current team data (this is the correct one from tactics.py)
            const currentTeamData = teamData[team.teamname] || {};
            const targetTeamId = currentTeamData.teamid;
            console.log(`[Formation Data] Calling with FIFA team ID: ${targetTeamId} for team ${team.teamname}`, {
              teamData: currentTeamData,
              teamDataKeys: Object.keys(teamData),
              allTeamDataEntries: Object.entries(teamData).map(([name, data]) => ({ name, teamid: data.teamid }))
            });
            fetchFormationData(team.teamname, team.team_id, targetTeamId);
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

          // Check if "🔁 Transfers" step just completed
          const transfersStepIndex = PROCESSING_STEPS_INFO.findIndex(s => s.name === "🔁 Transfers");
          console.log(`[Step Progress] Current step: ${stepIndex}, Transfers step index: ${transfersStepIndex}, Category: "${data.current_category}"`);
          
          if (stepIndex === transfersStepIndex && data.current_team) {
            const team = selectedTeams.find(t => t.teamname === data.current_team);
            if (team) {
              console.log(`[Formation Data] Transfers step completed for ${data.current_team}, fetching formation data...`);
              console.log(`[Formation Data] Context: transfers step callback, selectedTeams count: ${selectedTeams.length}`);
              // Automatically fetch formation data when transfers step is completed
              setTimeout(() => {
                // Pass the FIFA team ID from current team data (this is the correct one from tactics.py)
                const currentTeamData = teamData[data.current_team!] || {};
                const targetTeamId = currentTeamData.teamid;
                console.log(`[Formation Data] Transfers step - calling with FIFA team ID: ${targetTeamId} for team ${data.current_team}`);
                fetchFormationData(data.current_team!, team.team_id, targetTeamId);
              }, 500); // Small delay to ensure all data is processed
            }
          }
          
        }
      }
    }
  
    if (data.status === 'completed') {
      setIsComplete(true);
      setIsProcessing(false);
      
      // Set current team to the last team to show its data
      setCurrentTeamIndex(selectedTeams.length - 1);
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
    setIsLoadingFormationData({});
    setShowFormation({});
    
    // Save the processing order of teams
    const processingOrder: { [teamName: string]: number } = {};
    selectedTeams.forEach((team, index) => {
      processingOrder[team.teamname] = index;
    });
    setTeamProcessingOrder(processingOrder);
    console.log(`[AddTeams] Team processing order saved:`, processingOrder);

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
    setIsLoadingFormationData({});
    setShowFormation({});
    setTeamProcessingOrder({});
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

  const currentTeam = useMemo(() => {
    // If process is complete, show the last team (most recently processed)
    if (isComplete && selectedTeams.length > 0) {
      return selectedTeams[selectedTeams.length - 1];
    }
    
    // During processing, show the current team based on index
    if (currentTeamIndex >= 0 && currentTeamIndex < selectedTeams.length) {
      return selectedTeams[currentTeamIndex];
    }
    
    // Fallback: if no current team but we have teams, show the first one
    if (selectedTeams.length > 0) {
      return selectedTeams[0];
    }
    
    return null;
  }, [currentTeamIndex, selectedTeams, isComplete]);
  
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

                    {/* Formation Visualization Button - Show when formation data can be loaded */}
                    {currentTeam && (() => {
                      // Show button after "🔁 Transfers" step is completed
                      const transfersStepIndex = 14; // Index of "🔁 Transfers" step
                      const teamProgress = teamStepProgress[currentTeam.teamname || ''] || -1;
                      const transfersStepCompleted = teamProgress >= transfersStepIndex;
                      
                      const canShowFormation = transfersStepCompleted;
                      const hasFormationData = formationData[currentTeam.teamname] && 
                        teamSheetData[currentTeam.teamname];
                      
                      if (!canShowFormation) return null;
                      
                      const fifaTeamId = teamSheetData[currentTeam.teamname]?.originalTeamId;
                      const transfermarktTeamId = currentTeam.team_id;
                      
                      console.log(`[Formation Display Debug] Team: ${currentTeam.teamname}`, {
                        canShowFormation,
                        hasFormationData,
                        teamProgress,
                        transfersStepIndex,
                        transfersStepCompleted,
                        transfermarktTeamId,
                        fifaTeamId,
                        teamIdToPass: fifaTeamId || transfermarktTeamId,
                        formationDataKeys: Object.keys(formationData),
                        teamSheetDataKeys: Object.keys(teamSheetData),
                        playerNamesCount: Object.keys(playerNames).length,
                        showFormationState: showFormation[currentTeam.teamname],
                        isLoadingFormation: isLoadingFormationData[currentTeam.teamname],
                        WILL_PASS_TO_FOOTBALL_PITCH: {
                          teamId: fifaTeamId || transfermarktTeamId,
                          teamSheetData: teamSheetData[currentTeam.teamname],
                          actualFifaTeamId: teamSheetData[currentTeam.teamname]?.teamid,
                          originalTeamIdFromMapping: teamSheetData[currentTeam.teamname]?.originalTeamId
                        }
                      });
                      
                      return (
                      <Card>
                        <CardBody className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="font-semibold text-sm flex items-center gap-2">
                              <Icon icon="lucide:map" className="w-4 h-4" />
                              Team Formation
                            </h5>
                            <div className="flex items-center gap-2">
                              {hasFormationData && showFormation[currentTeam.teamname] && (
                                <Button
                                  size="sm"
                                  color="danger"
                                  variant="flat"
                                  onClick={() => setShowFormation(prev => ({ ...prev, [currentTeam.teamname]: false }))}
                                  startContent={<Icon icon="lucide:eye-off" className="w-4 h-4" />}
                                >
                                  Hide Formation
                                </Button>
                              )}
                              {!showFormation[currentTeam.teamname] && (
                                <Button
                                  size="sm"
                                  color="primary"
                                  variant="flat"
                                  isLoading={isLoadingFormationData[currentTeam.teamname]}
                                  onClick={async () => {
                                    if (!hasFormationData) {
                                      // Fetch formation data first
                                      console.log(`[Formation Data] Manual fetch button clicked for ${currentTeam.teamname}, selectedTeams count: ${selectedTeams.length}`);
                                      setIsLoadingFormationData(prev => ({ ...prev, [currentTeam.teamname]: true }));
                                      try {
                                        // Pass the FIFA team ID from current team data (this is the correct one from tactics.py)
                                        const targetTeamId = currentTeamData.teamid;
                                        console.log(`[Formation Data] Manual fetch - calling with FIFA team ID: ${targetTeamId} for team ${currentTeam.teamname}`, {
                                          currentTeamData,
                                          teamDataKeys: Object.keys(teamData),
                                          currentTeamTransfermarktId: currentTeam.team_id
                                        });
                                        await fetchFormationData(currentTeam.teamname, currentTeam.team_id, targetTeamId, true); // Force refresh
                                      } finally {
                                        setIsLoadingFormationData(prev => ({ ...prev, [currentTeam.teamname]: false }));
                                      }
                                    }
                                    setShowFormation(prev => ({ ...prev, [currentTeam.teamname]: true }));
                                  }}
                                  startContent={<Icon icon="lucide:eye" className="w-4 h-4" />}
                                >
                                  Show Formation
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Formation Visualization - Show when button is clicked and data is available */}
                          {showFormation[currentTeam.teamname] && hasFormationData && (
                            <FootballPitch
                              key={`${currentTeam.team_id}-${currentTeam.teamname}-${currentTeamData.teamid || 'no-fifa-id'}`} // Force re-render on team change and ensure unique key per FIFA team
                              formation={formationData[currentTeam.teamname]}
                              teamSheet={teamSheetData[currentTeam.teamname]}
                              players={[]} // Empty array since FootballPitch now uses detailedPlayers from database instead
                              teamName={currentTeam.teamname}
                              playerNames={playerNames}
                              projectId={projectId}
                              teamId={currentTeamData.teamid || currentTeam.team_id} // Pass FIFA team ID from team data, not Transfermarkt ID
                              displayTeamId={currentTeamData.teamid} // Use the correct FIFA team ID from team data
                            />
                          )}
                          
                          {/* Loading state */}
                          {isLoadingFormationData[currentTeam.teamname] && (
                            <div className="flex items-center justify-center p-8">
                              <div className="flex items-center gap-2">
                                <Icon icon="lucide:loader-2" className="w-4 h-4 animate-spin" />
                                <span className="text-sm text-default-500">Loading formation data...</span>
                              </div>
                            </div>
                          )}
                          
                          {/* No data message */}
                          {showFormation[currentTeam.teamname] && !hasFormationData && !isLoadingFormationData[currentTeam.teamname] && (
                            <div className="flex items-center justify-center p-8">
                              <div className="text-center">
                                <Icon icon="lucide:alert-circle" className="w-8 h-8 text-warning mx-auto mb-2" />
                                <p className="text-sm text-default-500">Formation data not available for this team</p>
                              </div>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                      );
                    })()}

                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-default-400">
                    <Icon icon="lucide:file-text" className="w-12 h-12 mb-2" />
                    <p className="text-sm">
                      {isComplete ? "All teams processed successfully" : "No team selected"}
                    </p>
                    <p className="text-xs">
                      {isComplete ? "Click on any team above to view details" : "Start processing to see team details"}
                    </p>
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