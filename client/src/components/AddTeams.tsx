import React, { useState, useEffect, useRef } from "react";
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
  Avatar,
  Divider,
  ScrollShadow,
  Accordion,
  AccordionItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  Spinner,
  CircularProgress,
  Image,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";

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
  onTeamsAdded?: () => void;
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

interface ProcessingStep {
  name: string;
  icon: string;
  completed: boolean;
  active: boolean;
  data?: any;
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

// Add CSS animations
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
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default function AddTeams({
  isOpen,
  onClose,
  selectedTeams,
  projectId,
  leagueId,
  onTeamsAdded,
}: AddTeamsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [completedTeams, setCompletedTeams] = useState<Set<string>>(new Set());
  const [currentTeamIndex, setCurrentTeamIndex] = useState(-1);
  const [teamData, setTeamData] = useState<{ [teamName: string]: any }>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [playerSaveStatus, setPlayerSaveStatus] = useState<{ [teamName: string]: PlayerSaveStatus[] }>({});
  const [savedPlayerRatings, setSavedPlayerRatings] = useState<{ [teamName: string]: { [playerIndex: number]: number } }>({});
  const previousProgressRef = useRef<number>(0);
  const [teamStepProgress, setTeamStepProgress] = useState<{ [teamName: string]: number }>({});

  // Function to normalize step names for comparison
  const normalizeStepName = (name: string): string => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters and emojis
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  };

  // Connect to WebSocket when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://localhost:8000/ws');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[AddTeams] WebSocket connected');
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.function_name === 'add_teams') {
              handleProgressUpdate(data);
            }
          } catch (error) {
            console.error('[AddTeams] Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('[AddTeams] WebSocket disconnected');
          setWsConnected(false);
        };

        ws.onerror = (error) => {
          console.error('[AddTeams] WebSocket error:', error);
          setWsConnected(false);
        };
      } catch (error) {
        console.error('[AddTeams] Error creating WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isOpen]);

  const handleProgressUpdate = (data: ProgressData) => {
    console.log('[AddTeams] Progress update received:', {
      type: data.type,
      current: data.current,
      total: data.total,
      percentage: data.percentage,
      current_category: data.current_category,
      current_team: data.current_team,
      completed_teams: data.completed_teams?.length || 0,
      current_player: data.current_player,
      player_index: data.player_index,
      total_players: data.total_players,
      player_overall_rating: data.player_overall_rating,
      player_status: data.player_status,
      current_processing_player: data.current_processing_player
    });
    
    setProgressData(data);
  
    if (data.current !== undefined) {
      setCurrentTeamIndex(data.current);
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
                  overall_rating: preservedRating
                };
                console.log(`[Player Update] Marked player ${i} as saved with preserved rating:`, preservedRating);
              }
            }
          }
          
          console.log('[Player Update] Final team players state:', teamPlayers.map(p => ({
            name: p.name, 
            status: p.status, 
            rating: p.overall_rating
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
          overall_rating: savedPlayerRatings[data.current_team!]?.[idx] ?? player.overall_rating
        }));
        
        console.log('[Player Update] Finalized all players:', updatedPlayers.map(p => ({
          name: p.name,
          rating: p.overall_rating
        })));
        
        return {
          ...prev,
          [data.current_team!]: updatedPlayers
        };
      });
    }
  
    if (data.completed_teams) {
      setCompletedTeams(new Set(data.completed_teams));
      
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
        }
      }
    }
  
    if (data.status === 'completed') {
      setIsComplete(true);
      setIsProcessing(false);
    } else if (data.status === 'error') {
      setError(data.message || 'An error occurred');
      setIsProcessing(false);
    }
  };

  const startAddingTeams = async () => {
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
  };

  const handleClose = () => {
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
    
    onClose();
  };

  const getStepStatus = (stepIndex: number, currentTeam: TransfermarktTeam) => {
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
  };

  const currentTeam = currentTeamIndex >= 0 && currentTeamIndex < selectedTeams.length 
    ? selectedTeams[currentTeamIndex] 
    : null;
  
  const currentTeamData = currentTeam ? teamData[currentTeam.teamname] || {} : {};
  
  // Calculate overall progress
  const totalSteps = selectedTeams.length * PROCESSING_STEPS_INFO.length;
  const completedSteps = completedTeams.size * PROCESSING_STEPS_INFO.length;
  
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

  const isShowingPlayerSaveDetails = (progressData?.current_category?.toLowerCase().includes('saving') && 
                                     progressData?.current_category?.toLowerCase().includes('player')) ||
                                     progressData?.current_processing_player &&
                                     currentTeam;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="5xl"
      isDismissable={!isProcessing}
      hideCloseButton={isProcessing}
      scrollBehavior="inside"
      classNames={{
        backdrop: "bg-black/50 backdrop-blur-sm",
        base: "bg-gradient-to-br from-white to-default-50 dark:from-default-100 dark:to-default-50 max-h-[95vh]",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 pb-1">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary-100 rounded-lg">
                <Icon icon="lucide:plus-circle" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Add Teams to Game</h2>
                <p className="text-xs text-default-500">
                  {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {wsConnected && (
                <Chip color="success" size="sm" variant="flat">
                  <Icon icon="lucide:wifi" className="w-3 h-3 mr-1" />
                  Connected
                </Chip>
              )}
              {!isProcessing && !isComplete && (
                <Button
                  isIconOnly
                  variant="light"
                  onPress={handleClose}
                  size="sm"
                >
                  <Icon icon="lucide:x" className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Overall Progress */}
          {isProcessing && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-0.5">
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
              />
              {((progressData?.current_category?.toLowerCase().includes('saving') && 
               progressData?.current_category?.toLowerCase().includes('player')) ||
               progressData?.current_processing_player) &&
               (progressData?.current_player || progressData?.current_processing_player) && (
                <p className="text-xs text-primary-600 text-center animate-pulse font-medium mt-1">
                  Saving player {progressData.player_index !== undefined ? progressData.player_index + 1 : '?'}/{progressData.total_players || '?'}: {progressData.current_player || progressData.current_processing_player}
                  {progressData?.player_overall_rating && (
                    <span className="ml-2 text-success-600 font-bold">
                      (OVR: {progressData.player_overall_rating})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </ModalHeader>

        <ModalBody className="gap-0 p-2">
          <div className="grid grid-cols-12 gap-2 h-[550px]">
            {/* Left Column - Teams List */}
            <div className="col-span-2 bg-danger-50/50 dark:bg-danger-900/10 rounded-lg p-2 border border-danger-200">
              <h3 className="font-semibold text-xs text-danger-700 dark:text-danger-400 mb-2 flex items-center gap-1">
                <Icon icon="lucide:users" className="w-4 h-4" />
                Teams
              </h3>
              <ScrollShadow className="h-[500px]">
                <div className="space-y-1">
                  {selectedTeams.map((team, index) => {
                    const isCurrentTeam = index === currentTeamIndex;
                    const isCompleted = completedTeams.has(team.team_id);
                    
                    return (
                      <Card
                        key={team.team_id}
                        isPressable={isComplete || isProcessing}
                        onPress={() => {
                          if (isComplete || (isProcessing && index !== currentTeamIndex)) {
                            setCurrentTeamIndex(index);
                          }
                        }}
                        className={`transition-all duration-300 ${
                          isCurrentTeam 
                            ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-400 shadow-sm' 
                            : isCompleted 
                            ? 'bg-success-100 dark:bg-success-900/30 border border-success-400'
                            : 'bg-white dark:bg-default-100'
                        }`}
                      >
                        <CardBody className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Avatar
                                src={team.teamlogo}
                                alt={team.teamname}
                                size="sm"
                                className="w-8 h-8"
                              />
                              {isCompleted && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-success rounded-full p-0.5">
                                  <Icon icon="lucide:check" className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                              {isCurrentTeam && !isCompleted && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Spinner size="sm" color="primary" className="absolute scale-[0.65]" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs truncate">{team.teamname}</p>
                              <div className="flex items-center gap-1">
                                {isCompleted && (
                                  <Chip color="success" size="sm" variant="flat" className="h-4">
                                    <span className="text-[10px]">Done</span>
                                  </Chip>
                                )}
                                {isCurrentTeam && !isCompleted && (
                                  <Chip color="primary" size="sm" variant="flat" className="animate-pulse h-4">
                                    <span className="text-[10px]">Processing</span>
                                  </Chip>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </ScrollShadow>
            </div>

            {/* Middle Column - Steps */}
            <div className="col-span-2 bg-warning-50/50 dark:bg-warning-900/10 rounded-lg p-2 border border-warning-200">
              <h3 className="font-semibold text-sm text-warning-700 dark:text-warning-400 mb-2 flex items-center gap-1">
                <Icon icon="lucide:list-checks" className="w-4 h-4" />
                Steps
              </h3>
              <ScrollShadow className="h-[500px]">
                <div className="space-y-0.5">
                  {PROCESSING_STEPS_INFO.map((step, index) => {
                    const status = currentTeam ? getStepStatus(index, currentTeam) : 'pending';
                    
                    return (
                      <div key={index}>
                        <Card
                          className={`transition-all duration-300 ${
                            status === 'active' 
                              ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-400 shadow-sm' 
                              : status === 'completed'
                              ? 'bg-success-100 dark:bg-success-900/30'
                              : 'bg-white/50 dark:bg-default-100/50 opacity-60'
                          }`}
                        >
                          <CardBody className="p-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`p-1 rounded ${
                                status === 'active' 
                                  ? 'bg-primary-200 text-primary-700' 
                                  : status === 'completed'
                                  ? 'bg-success-200 text-success-700'
                                  : 'bg-default-100 text-default-400'
                              }`}>
                                <Icon 
                                  icon={status === 'completed' ? 'lucide:check-circle' : step.icon} 
                                  className="w-3 h-3" 
                                />
                              </div>
                              <p className={`text-xs font-medium flex-1 ${
                                status === 'active' ? 'text-primary-700' : ''
                              }`}>
                                {step.name.substring(2)}
                              </p>
                              {status === 'active' && progressData?.category_progress !== undefined && (
                                <Chip size="sm" color="primary" variant="flat" className="h-4">
                                  <span className="text-[10px]">{Math.round(progressData.category_progress)}%</span>
                                </Chip>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                        {index < PROCESSING_STEPS_INFO.length - 1 && (
                          <div className="flex justify-center py-0.5">
                            <Icon 
                              icon="lucide:arrow-down" 
                              className={`w-3 h-3 ${
                                status === 'completed' 
                                  ? 'text-success-500' 
                                  : status === 'active'
                                  ? 'text-primary-500 flow-arrow'
                                  : 'text-default-300'
                              }`} 
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollShadow>
            </div>

            {/* Right Column - Content */}
            <div className="col-span-8 bg-primary-50/30 dark:bg-primary-900/10 rounded-lg p-2 border border-primary-200">
              <h3 className="font-semibold text-sm text-primary-700 dark:text-primary-400 mb-2 flex items-center gap-1">
                <Icon icon="lucide:file-text" className="w-4 h-4" />
                Content
              </h3>
              
              {error && (
                <Card className="mb-2 bg-danger-50 border border-danger-200">
                  <CardBody className="p-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:alert-circle" className="w-4 h-4 text-danger" />
                      <span className="text-xs text-danger">{error}</span>
                    </div>
                  </CardBody>
                </Card>
              )}

              {isComplete && (
                <Card className="mb-2 bg-success-50 border border-success-200">
                  <CardBody className="p-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check-circle" className="w-4 h-4 text-success pulse-green" />
                      <span className="text-xs text-success font-semibold">
                        Successfully added {selectedTeams.length} teams!
                      </span>
                    </div>
                  </CardBody>
                </Card>
              )}

              <ScrollShadow className="h-[480px]">
                {currentTeam ? (
                  <div className="space-y-2">
                    {/* Combined Team Info, Colors, and Ratings Card - ULTRA COMPACT */}
                    <Card>
                      <CardBody className="p-2">
                        <div className="flex items-center gap-2"> {/* Main horizontal container for logo + rest */}
                          <Image
                            src={currentTeam.teamlogo}
                            alt={currentTeam.teamname}
                            width={50}
                            height={50}
                            className="object-contain flex-shrink-0"
                          />
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0"> {/* Vertical container for name + details rows */}
                            {/* Row 1: Name and Colors */}
                            <div className="flex items-center gap-x-2"> 
                              <h4 className="text-base font-semibold truncate flex-1" title={currentTeam.teamname}>{currentTeam.teamname}</h4>
                              {/* Conditionally display Team ID Chip here */}
                              {currentTeamData.teamid && (
                                <Chip size="sm" variant="flat" color="default" className="h-5 ml-1 flex-shrink-0">
                                  <span className="text-[10px] text-default-500">ID: {currentTeamData.teamid}</span>
                                </Chip>
                              )}
                              {/* Colors Group (conditional) */}
                              {currentTeamData.teamcolor1r && (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <Tooltip content="Primary" placement="bottom" delay={0} closeDelay={0}>
                                    <div
                                      className="w-4 h-4 rounded-full border border-default-300 dark:border-default-500 shadow-sm cursor-default"
                                      style={{ backgroundColor: `rgb(${currentTeamData.teamcolor1r}, ${currentTeamData.teamcolor1g}, ${currentTeamData.teamcolor1b})` }}
                                    />
                                  </Tooltip>
                                  <Tooltip content="Secondary" placement="bottom" delay={0} closeDelay={0}>
                                    <div
                                      className="w-4 h-4 rounded-full border border-default-300 dark:border-default-500 shadow-sm cursor-default"
                                      style={{ backgroundColor: `rgb(${currentTeamData.teamcolor2r}, ${currentTeamData.teamcolor2g}, ${currentTeamData.teamcolor2b})` }}
                                    />
                                  </Tooltip>
                                  <Tooltip content="Tertiary" placement="bottom" delay={0} closeDelay={0}>
                                    <div
                                      className="w-4 h-4 rounded-full border border-default-300 dark:border-default-500 shadow-sm cursor-default"
                                      style={{ backgroundColor: `rgb(${currentTeamData.teamcolor3r}, ${currentTeamData.teamcolor3g}, ${currentTeamData.teamcolor3b})` }}
                                    />
                                  </Tooltip>
                                </div>
                              )}
                            </div>

                            {/* Row 2: Stats and Ratings */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-0.5"> 
                              {/* Stats Group */}
                              <div className="flex items-center gap-x-0.5">
                                <span className="text-default-500">Squad:</span>
                                <span className="font-semibold text-default-700 dark:text-default-200">{currentTeam.squad}</span>
                              </div>
                              <div className="flex items-center gap-x-0.5">
                                <span className="text-default-500">Avg Age:</span>
                                <span className="font-semibold text-default-700 dark:text-default-200">{currentTeam.avg_age}</span>
                              </div>
                              <div className="flex items-center gap-x-0.5">
                                <span className="text-default-500">Value:</span>
                                <span className="font-semibold text-default-700 dark:text-default-200">{currentTeam.total_market_value}</span>
                              </div>

                              {/* Ratings Group (conditional) - no explicit separator, relies on gap */}
                              {currentTeamData.overallrating && (!isShowingPlayerSaveDetails || isComplete) && (
                                  <div className="flex items-center gap-x-1 gap-y-0.5 flex-wrap">
                                    <div className="bg-default-100/70 dark:bg-default-500/30 p-0.5 px-1 rounded text-center">
                                      <span className="text-[9px] text-default-500 dark:text-default-700">OVR:</span>
                                      <span className="text-[10px] text-black dark:text-white font-bold">{currentTeamData.overallrating}</span>
                                    </div>
                                    <div className="bg-danger-100/70 dark:bg-danger-500/30 p-0.5 px-1 rounded text-center">
                                      <span className="text-[9px] text-danger-600 dark:text-danger-700">ATT:</span>
                                      <span className="text-[10px] text-danger-900 dark:text-danger-500 font-bold">{currentTeamData.attackrating}</span>
                                    </div>
                                    <div className="bg-warning-100/70 dark:bg-warning-500/30 p-0.5 px-1 rounded text-center">
                                      <span className="text-[9px] text-yellow-600 dark:text-yellow-400">MID:</span>
                                      <span className="text-[10px] text-yellow-900 dark:text-yellow-500 font-bold">{currentTeamData.midfieldrating}</span>
                                    </div>
                                    <div className="bg-primary-100/70 dark:bg-primary-500/30 p-0.5 px-1 rounded text-center">
                                      <span className="text-[9px] text-primary-600 dark:text-primary-700">DEF:</span>
                                      <span className="text-[10px] text-primary-900 dark:text-primary-500 font-bold">{currentTeamData.defenserating}</span>
                                    </div>
                                  </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    {/* Player Save Progress - Show when saving players AND not complete */}
                    {isShowingPlayerSaveDetails && currentTeam && !isComplete && (
                      <Card>
                        <CardBody className="p-2">
                          <h5 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Icon icon="lucide:save" className="w-4 h-4" />
                            Saving Players
                            {progressData?.player_index !== undefined && (progressData?.total_players || currentTeamData.parsed_players_for_table?.length) && (
                              <>
                                <span className="text-xs font-normal text-default-500">
                                  ({progressData.player_index + 1}/{progressData.total_players || currentTeamData.parsed_players_for_table?.length || 0})
                                </span>
                                <Chip size="sm" color="primary" variant="flat" className="h-5 ml-1">
                                  <span className="text-[10px]">
                                    {`${Math.round(((progressData.player_index + 1) / (progressData.total_players || currentTeamData.parsed_players_for_table?.length || 1)) * 100)}%`}
                                  </span>
                                </Chip>
                              </>
                            )}
                            {(progressData?.current_player || progressData?.current_processing_player) && (
                              <span className="text-xs font-normal text-primary-600 animate-pulse">
                                • {progressData.current_player || progressData.current_processing_player}
                                {progressData?.player_overall_rating && (
                                  <span className="ml-1 text-success-600 font-bold">
                                    (OVR: {progressData.player_overall_rating})
                                  </span>
                                )}
                              </span>
                            )}
                          </h5>
                          <Table 
                            aria-label="Player save status" 
                            removeWrapper
                            className="min-h-[200px]"
                          >
                            <TableHeader>
                              <TableColumn>Status</TableColumn>
                              <TableColumn>Player</TableColumn>
                              <TableColumn>Position</TableColumn>
                              <TableColumn>OVR</TableColumn>
                            </TableHeader>
                            <TableBody>
                            {(playerSaveStatus[currentTeam.teamname] || currentTeamData.parsed_players_for_table?.map((p: any) => ({
                              name: p.name,
                              status: 'pending' as const,
                              position: p.position
                            })) || []).map((player, idx) => {
                              // Extract player name from current_processing_player if it exists
                              let currentProcessingPlayerName = '';
                              if (progressData?.current_processing_player) {
                                const parts = progressData.current_processing_player.split('-');
                                currentProcessingPlayerName = parts.length >= 2 ? parts.slice(1).join('-') : progressData.current_processing_player;
                              }
                              
                              // Check if this is the current player being processed
                              const isCurrentPlayer = (progressData?.player_index !== undefined && progressData.player_index === idx) || 
                                (progressData?.current_player && player.name === progressData.current_player) ||
                                (currentProcessingPlayerName && player.name === currentProcessingPlayerName) ||
                                (currentProcessingPlayerName && player.name.toLowerCase() === currentProcessingPlayerName.toLowerCase());
                              
                              // Update status if this is the current player
                              const displayStatus = isCurrentPlayer ? 'saving' : player.status;
                              
                              // IMPORTANT: Always check all sources for rating data
                              const displayOverallRating = (() => {
                                // 1. If this is the current player being processed, use the live rating
                                if (isCurrentPlayer && progressData?.player_overall_rating !== undefined) {
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
                              
                              console.log(`[Table Render] Player ${idx} ${player.name}: status=${displayStatus}, rating=${displayOverallRating}`);
                              
                              return (
                                <TableRow 
                                  key={idx}
                                  className={isCurrentPlayer ? "bg-primary-50 dark:bg-primary-900/20 animate-pulse" : ""}
                                >
                                  <TableCell>
                                    <div className="flex items-center">
                                      {displayStatus === 'saved' && (
                                        <Icon icon="lucide:check-circle" className="w-3 h-3 text-success" />
                                      )}
                                      {displayStatus === 'saving' && (
                                        <CircularProgress 
                                          size="sm" 
                                          color="primary"
                                          aria-label="Saving player"
                                          classNames={{
                                            svg: "w-5 h-5",
                                            indicator: "stroke-primary",
                                            track: "stroke-primary/10"
                                          }}
                                          strokeWidth={3}
                                          isIndeterminate={!progressData?.category_progress}
                                          value={progressData?.category_progress}
                                          showValueLabel={false}
                                        />
                                      )}
                                      {displayStatus === 'pending' && (
                                        <Icon icon="lucide:circle" className="w-3 h-3 text-default-300" />
                                      )}
                                      {displayStatus === 'error' && (
                                        <Icon icon="lucide:x-circle" className="w-3 h-3 text-danger" />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className={`text-xs font-medium ${isCurrentPlayer ? "text-primary-700 dark:text-primary-200" : "dark:text-default-300"}`}>
                                    {player.name}
                                    {isCurrentPlayer && (progressData?.current_player || currentProcessingPlayerName) && (
                                      <Chip size="sm" color="primary" variant="flat" className="ml-2 h-4 animate-pulse">
                                        <span className="text-[10px]">Saving...</span>
                                      </Chip>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Chip size="sm" variant="flat" className="h-4">
                                      <span className="text-[10px]">
                                        {player.position || currentTeamData.parsed_players_for_table?.[idx]?.position || '-'}
                                      </span>
                                    </Chip>
                                  </TableCell>
                                  <TableCell>
                                    {displayOverallRating !== undefined ? (
                                      <Chip 
                                        size="sm" 
                                        color={displayOverallRating >= 70 ? "success" : displayOverallRating >= 65 ? "warning" : "default"}
                                        variant="flat" 
                                        className="h-4"
                                      >
                                        <span className="text-[10px] font-bold">
                                          {displayOverallRating}
                                        </span>
                                      </Chip>
                                    ) : (
                                      <span className="text-xs text-default-400">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            </TableBody>
                          </Table>
                        </CardBody>
                      </Card>
                    )}

                    {/* Players - Show when not saving OR when complete */}
                    {currentTeamData.parsed_players_for_table && 
                     currentTeamData.parsed_players_for_table.length > 0 && 
                     (!isShowingPlayerSaveDetails || isComplete) && (
                      <Card>
                        <CardBody className="p-2">
                          <h5 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <Icon icon="lucide:users" className="w-3 h-3" />
                            Players ({currentTeamData.parsed_players_for_table.length})
                            {isComplete && <Chip size="sm" color="success" variant="flat" className="ml-2 h-4"><span className="text-[10px]">Final Data</span></Chip>}
                          </h5>
                          <Table aria-label="Player list" removeWrapper>
                            <TableHeader>
                              <TableColumn>#</TableColumn>
                              <TableColumn>Name</TableColumn>
                              <TableColumn>Pos</TableColumn>
                              <TableColumn>Nation</TableColumn>
                              <TableColumn>Value</TableColumn>
                              <TableColumn>OVR</TableColumn>
                            </TableHeader>
                            <TableBody>
                              {currentTeamData.parsed_players_for_table.map((player: any, idx: number) => {
                                // Get saved player data if available
                                const savedPlayerData = playerSaveStatus[currentTeam.teamname]?.[idx];
                                
                                // Get rating from separate storage first, then fallback to saved player data
                                const savedRating = savedPlayerRatings[currentTeam.teamname]?.[idx];
                                const displayOverallRating = savedRating ?? savedPlayerData?.overall_rating ?? player.overall_rating; // Prioritize savedRating, then playerSaveStatus, then original
                                
                                const displayPosition = savedPlayerData?.position || player.position;
                                const isSaved = savedPlayerData?.status === 'saved';
                                
                                // Debug logging
                                if (idx < 5) { // Only log first 5 players to avoid spam
                                  console.log(`[Player ${idx}] ${player.name}:`, {
                                    savedPlayerData,
                                    savedRating,
                                    displayOverallRating,
                                    isSaved,
                                    originalRating: player.overall_rating
                                  });
                                }
                                
                                return (
                                  <TableRow 
                                    key={idx}
                                    className={isSaved ? "bg-success-50 dark:bg-success-900/20" : "dark:bg-default-100/50"}
                                  >
                                    <TableCell className="text-xs dark:text-default-300">
                                      <div className="flex items-center gap-1">
                                        {player.number || '-'}
                                        {isSaved && (
                                          <Icon icon="lucide:check-circle" className="w-3 h-3 text-success ml-1" />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs font-medium dark:text-default-200">{player.name}</TableCell>
                                    <TableCell>
                                      <Chip size="sm" variant="flat" className="h-4">
                                        <span className="text-[10px]">{displayPosition}</span>
                                      </Chip>
                                    </TableCell>
                                    <TableCell className="text-xs dark:text-default-300">{player.nationality}</TableCell>
                                    <TableCell className="text-xs dark:text-default-300">{player.value || '-'}</TableCell>
                                    <TableCell>
                                      {displayOverallRating ? (
                                        <Chip 
                                          size="sm" 
                                          color={displayOverallRating >= 70 ? "success" : displayOverallRating >= 65 ? "warning" : "default"}
                                          variant={isSaved ? "solid" : "flat"}
                                          className="h-4"
                                        >
                                          <span className="text-[10px] font-bold">
                                            {displayOverallRating}
                                          </span>
                                        </Chip>
                                      ) : (
                                        <span className="text-xs text-default-400">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
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
              </ScrollShadow>
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="pt-1 pb-2">
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
          {isProcessing && !isComplete && (
            <div className="w-full text-center">
              <p className="text-xs text-default-500">
                Processing teams... Please wait
              </p>
            </div>
          )}
          {isComplete && (
            <Button
              color="primary"
              variant="flat"
              onPress={handleClose}
              size="sm"
            >
              Close
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}