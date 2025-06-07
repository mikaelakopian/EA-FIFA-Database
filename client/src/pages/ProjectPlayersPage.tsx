import React from "react";
import {
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Image,
  Spinner,
  Tooltip,
  Pagination,
  Progress,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { PlayerFilters } from "../components/PlayerFilters";
import { useProgress } from "../context/ProgressContext";

interface Player {
  playerid: string;
  firstnameid: string;
  lastnameid: string;
  commonname: string;
  height: string;
  weight: string;
  birthdate: string;
  age: string;
  nationality: string;
  overallrating: string;
  potential: string;
  preferredposition1: string;
  preferredposition2: string;
  preferredposition3: string;
  preferredposition4: string;
  playerworkrate: string;
  playerskillmoves: string;
  weakfootabilitytypecode: string;
  attackingworkrate: string;
  defensiveworkrate: string;
  pace: string;
  shooting: string;
  passing: string;
  dribbling: string;
  defending: string;
  physic: string;
  gkdiving: string;
  gkhandling: string;
  gkkicking: string;
  gkpositioning: string;
  gkreflexes: string;
  preferredfoot: string;
  internationalrep: string;
  jerseynumber: string;
  contractvaliduntil: string;
  value: string;
  wage: string;
  jerseystylecode: string;
  // Additional fields for calculated values
  acceleration?: string;
  sprintspeed?: string;
  finishing?: string;
  shotpower?: string;
  shortpassing?: string;
  longpassing?: string;
  ballcontrol?: string;
  defensiveawareness?: string;
  standingtackle?: string;
  strength?: string;
  stamina?: string;
}

interface Nation {
  nationid: string;
  nationname: string;
  isocountrycode: string;
}

interface Team {
  teamid: string;
  teamname: string;
}

interface TeamPlayerLink {
  teamid: string;
  playerid: string;
}

interface PlayerName {
  nameid: string;
  commentaryid: string;
  name: string;
}

interface ProjectPlayersPageProps {
  projectId?: string;
}

// Position mapping for display
const POSITION_NAMES: { [key: string]: string } = {
  "1": "GK", "2": "RWB", "3": "RB", "4": "CB", "5": "LB", "6": "LWB",
  "7": "CDM", "8": "RM", "9": "CM", "10": "CAM", "11": "LM", "12": "RW",
  "13": "RF", "14": "CF", "15": "LF", "16": "LW", "17": "ST"
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ProjectPlayersPage({ projectId }: ProjectPlayersPageProps) {
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [teamPlayerLinks, setTeamPlayerLinks] = React.useState<{ [playerId: string]: string }>({});
  const [teams, setTeams] = React.useState<{ [teamId: string]: Team }>({});
  const [nations, setNations] = React.useState<{ [nationId: string]: Nation }>({});
  const [playerNames, setPlayerNames] = React.useState<{ [nameId: string]: string }>({});
  const [loadingTeams, setLoadingTeams] = React.useState(false);
  const [loadingNations, setLoadingNations] = React.useState(false);
  const [loadingPlayerNames, setLoadingPlayerNames] = React.useState(false);
  const [isLazyLoading, setIsLazyLoading] = React.useState(false);
  
  // Enhanced progress tracking with multiple stages
  const [progressState, setProgressState] = React.useState<{
    stage: 'idle' | 'database_loading' | 'data_transfer' | 'processing' | 'completed' | 'error';
    percentage: number;
    message: string;
    isActive: boolean;
    substages: {
      database: { percentage: number; status: 'pending' | 'active' | 'completed' };
      transfer: { percentage: number; status: 'pending' | 'active' | 'completed' };
      processing: { percentage: number; status: 'pending' | 'active' | 'completed' };
    };
    startTime?: number;
    estimatedTotal?: number;
  }>({
    stage: 'idle',
    percentage: 0,
    message: '',
    isActive: false,
    substages: {
      database: { percentage: 0, status: 'pending' },
      transfer: { percentage: 0, status: 'pending' },
      processing: { percentage: 0, status: 'pending' }
    }
  });
  
  // Filter states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedTeam, setSelectedTeam] = React.useState("");
  const [selectedPosition, setSelectedPosition] = React.useState("");
  const [selectedCountry, setSelectedCountry] = React.useState("");
  const [ratingRange, setRatingRange] = React.useState<[number, number]>([0, 100]);
  const [ageRange, setAgeRange] = React.useState<[number, number]>([16, 45]);
  
  // Debounced filter values for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedSelectedTeam = useDebounce(selectedTeam, 150);
  const debouncedSelectedPosition = useDebounce(selectedPosition, 150);
  const debouncedSelectedCountry = useDebounce(selectedCountry, 150);
  const debouncedRatingRange = useDebounce(ratingRange, 200);
  const debouncedAgeRange = useDebounce(ageRange, 200);
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const playersPerPage = 50;

  // Loading performance tracking
  const [loadingStats, setLoadingStats] = React.useState<{
    startTime?: number;
    lastUpdateTime?: number;
    playersPerSecond?: number;
    estimatedTimeRemaining?: number;
    bytesReceived?: number;
  }>({});


  // Refs to track fetch status
  const isFetching = React.useRef(false);
  const teamsFetched = React.useRef(false);
  const nationsFetched = React.useRef(false);
  const playerNamesFetched = React.useRef(false);

  // Get progress context for monitoring lazy loading
  const { progresses } = useProgress();
  const serverProgress = React.useMemo(() => {
    return progresses.find(p => 
      p.function_name === 'load_players_lazy' && 
      (p.status === 'processing' || p.status === 'starting' || p.status === 'completed')
    );
  }, [progresses]);



  // Update loading statistics
  React.useEffect(() => {
    if (serverProgress) {
      const now = Date.now();
      if (serverProgress.status === 'starting') {
        setLoadingStats({ startTime: now, lastUpdateTime: now });
      } else if (serverProgress.status === 'processing' && serverProgress.current && serverProgress.total) {
        setLoadingStats(prev => {
          const timeSinceStart = prev.startTime ? (now - prev.startTime) / 1000 : 0;
          const playersLoaded = serverProgress.current || 0;
          const totalPlayers = serverProgress.total || 1;
          const playersPerSecond = timeSinceStart > 0 ? playersLoaded / timeSinceStart : 0;
          const playersRemaining = totalPlayers - playersLoaded;
          const estimatedTimeRemaining = playersPerSecond > 0 ? playersRemaining / playersPerSecond : 0;
          
          return {
            ...prev,
            lastUpdateTime: now,
            playersPerSecond,
            estimatedTimeRemaining
          };
        });
      }
    } else {
      setLoadingStats({});
    }
  }, [serverProgress]);

  // Enhanced progress calculation with realistic stages
  React.useEffect(() => {
    const now = Date.now();
    
    if (serverProgress) {
      const current = serverProgress.current || 0;
      const total = serverProgress.total || 1;
      
      if (serverProgress.status === 'starting') {
        setProgressState({
          stage: 'database_loading',
          percentage: 5,
          message: 'Initializing database connection...',
          isActive: true,
          substages: {
            database: { percentage: 5, status: 'active' },
            transfer: { percentage: 0, status: 'pending' },
            processing: { percentage: 0, status: 'pending' }
          },
          startTime: now,
          estimatedTotal: total
        });
      } else if (serverProgress.status === 'processing') {
        // Database loading: 5% to 60% (55% range)
        const dbPercent = Math.min(60, 5 + (current / total) * 55);
        
        let message = `Loading from database: ${current.toLocaleString()}/${total.toLocaleString()}`;
        if (loadingStats.playersPerSecond && loadingStats.playersPerSecond > 0) {
          message += ` (${Math.round(loadingStats.playersPerSecond)}/s)`;
        }
        
        setProgressState(prev => ({
          ...prev,
          stage: 'database_loading',
          percentage: Math.max(prev.percentage, dbPercent),
          message,
          substages: {
            database: { percentage: Math.min(100, (current / total) * 100), status: 'active' },
            transfer: { percentage: 0, status: 'pending' },
            processing: { percentage: 0, status: 'pending' }
          }
        }));
      } else if (serverProgress.status === 'completed') {
        console.log("Database loading completed, players.length:", players.length);
        
        if (players.length > 0) {
          // Data already received - jump to completed
          setProgressState({
            stage: 'completed',
            percentage: 100,
            message: `Successfully loaded ${players.length.toLocaleString()} players`,
            isActive: true,
            substages: {
              database: { percentage: 100, status: 'completed' },
              transfer: { percentage: 100, status: 'completed' },
              processing: { percentage: 100, status: 'completed' }
            },
            startTime: progressState.startTime,
            estimatedTotal: total
          });
          
          setTimeout(() => {
            setProgressState(prev => ({ ...prev, isActive: false }));
          }, 2000);
        } else {
          // Database complete, waiting for data transfer
          setProgressState(prev => ({
            ...prev,
            stage: 'data_transfer',
            percentage: 65,
            message: 'Database ready, transferring data...',
            substages: {
              database: { percentage: 100, status: 'completed' },
              transfer: { percentage: 10, status: 'active' },
              processing: { percentage: 0, status: 'pending' }
            }
          }));
        }
      }
    } else if (isLazyLoading && !serverProgress) {
      // HTTP request initiated
      setProgressState({
        stage: 'data_transfer',
        percentage: 2,
        message: 'Initiating data request...',
        isActive: true,
        substages: {
          database: { percentage: 0, status: 'pending' },
          transfer: { percentage: 5, status: 'active' },
          processing: { percentage: 0, status: 'pending' }
        },
        startTime: now
      });
    } else if (players.length > 0) {
      // Data received and processed - complete regardless of other states
      if (progressState.stage !== 'completed' || progressState.percentage < 100) {
        console.log("Completing progress - players loaded:", players.length);
        setProgressState(prev => ({
          ...prev,
          stage: 'completed',
          percentage: 100,
          message: `Successfully loaded ${players.length.toLocaleString()} players`,
          isActive: true,
          substages: {
            database: { percentage: 100, status: 'completed' },
            transfer: { percentage: 100, status: 'completed' },
            processing: { percentage: 100, status: 'completed' }
          }
        }));
        
        // Hide progress after 3 seconds when data is fully loaded
        setTimeout(() => {
          setProgressState(prev => ({ ...prev, isActive: false }));
        }, 3000);
      }
    } else if (!isLazyLoading && !serverProgress && players.length === 0) {
      // No loading, no players - idle state
      if (progressState.stage !== 'idle') {
        setProgressState(prev => ({
          ...prev,
          stage: 'idle',
          percentage: 0,
          message: '',
          isActive: false
        }));
      }
    }
  }, [serverProgress, players.length, isLazyLoading, loadingStats]);

  // Effect to handle data transfer progress simulation
  React.useEffect(() => {
    if (progressState.stage === 'data_transfer' && progressState.substages.transfer.status === 'active') {
      const interval = setInterval(() => {
        setProgressState(prev => {
          if (prev.stage !== 'data_transfer' || players.length > 0) {
            clearInterval(interval);
            return prev;
          }
          
          const newTransferPercent = Math.min(90, prev.substages.transfer.percentage + 10);
          const newOverallPercent = 65 + (newTransferPercent / 100) * 25; // 65% to 90%
          
          return {
            ...prev,
            percentage: newOverallPercent,
            message: 'Transferring player data...',
            substages: {
              ...prev.substages,
              transfer: { percentage: newTransferPercent, status: 'active' }
            }
          };
        });
      }, 500);

      return () => clearInterval(interval);
    }
  }, [progressState.stage, progressState.substages.transfer.status, players.length]);

  // Timeout for data transfer - if data doesn't arrive within 15 seconds, show error
  React.useEffect(() => {
    if (progressState.stage === 'data_transfer') {
      const timeoutId = setTimeout(() => {
        if (players.length === 0 && progressState.stage === 'data_transfer') {
          console.error("Timeout: Data not received after 15 seconds");
          setProgressState(prev => ({
            ...prev,
            stage: 'error',
            percentage: 0,
            message: 'Data transfer timeout - please retry',
            isActive: false
          }));
        }
      }, 15000);

      return () => clearTimeout(timeoutId);
    }
  }, [progressState.stage, players.length]);

  // Helper functions (memoized for better performance)
  const getPlayerName = React.useCallback((player: Player): string => {
    if (player.commonname && player.commonname.trim()) {
      return player.commonname;
    }
    
    const firstName = playerNames[player.firstnameid] || `Unknown(${player.firstnameid})`;
    const lastName = playerNames[player.lastnameid] || `Unknown(${player.lastnameid})`;
    
    return `${firstName} ${lastName}`;
  }, [playerNames]);

  const getPlayerPosition = React.useCallback((player: Player): string => {
    return POSITION_NAMES[player.preferredposition1] || player.preferredposition1;
  }, []);

  const getPlayerTeamName = React.useCallback((player: Player): string => {
    const teamId = teamPlayerLinks[player.playerid];
    return teamId ? teams[teamId]?.teamname || `Team ${teamId}` : "Free Agent";
  }, [teamPlayerLinks, teams]);

  const getPlayerTeamId = React.useCallback((player: Player): string => {
    return teamPlayerLinks[player.playerid] || "";
  }, [teamPlayerLinks]);

  const getCountryName = React.useCallback((countryId: string): string => {
    return nations[countryId]?.nationname || `Country ${countryId}`;
  }, [nations]);

  const getPlayerAvatarUrl = React.useCallback((playerId: string): string => {
    return `http://localhost:8000/images/players/${playerId}`;
  }, []);

  const getTeamLogoUrl = React.useCallback((teamId: string): string => {
    return `http://localhost:8000/images/teams/${teamId}`;
  }, []);

  const getCountryFlagUrl = React.useCallback((countryId: string): string => {
    return `http://localhost:8000/images/flags/${countryId}`;
  }, []);

  // Calculate age from birthdate (EA format)
  const calculateAge = React.useCallback((birthdate: string): number => {
    if (!birthdate) return 0;
    
    // EA birthdate is in format like "154625" which represents days since some base date
    // For now, we'll use the age field directly if available, or calculate a rough estimate
    const birthdateNum = parseInt(birthdate);
    if (birthdateNum > 0) {
      // This is a rough calculation - in a real implementation you'd need the exact EA date format
      const baseYear = 1900;
      const estimatedYear = baseYear + Math.floor(birthdateNum / 365);
      const currentYear = new Date().getFullYear();
      return Math.max(16, Math.min(45, currentYear - estimatedYear));
    }
    
    return 25; // Default age if can't calculate
  }, []);

  // Color functions (memoized for better performance)
  const getRatingColor = React.useCallback((rating: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const ratingNum = parseInt(rating);
    if (ratingNum >= 90) return "success";
    if (ratingNum >= 85) return "primary";
    if (ratingNum >= 80) return "warning";
    if (ratingNum >= 75) return "secondary";
    return "default";
  }, []);

  const getPositionColor = React.useCallback((position: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const posColors: { [key: string]: "default" | "primary" | "secondary" | "success" | "warning" | "danger" } = {
      'GK': 'warning',
      'CB': 'success', 'RB': 'secondary', 'LB': 'secondary', 'RWB': 'secondary', 'LWB': 'secondary',
      'CDM': 'primary', 'CM': 'primary', 'CAM': 'primary', 'RM': 'primary', 'LM': 'primary',
      'RW': 'danger', 'LW': 'danger', 'RF': 'danger', 'LF': 'danger', 'CF': 'danger', 'ST': 'danger'
    };
    return posColors[position] || 'default';
  }, []);

  const getAgeColor = React.useCallback((age: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const ageNum = parseInt(age);
    if (ageNum <= 21) return "success"; // Young talent
    if (ageNum <= 26) return "primary"; // Prime age
    if (ageNum <= 30) return "warning"; // Experienced
    return "secondary"; // Veteran
  }, []);

  // Filter players based on all criteria
  const filteredPlayers = React.useMemo(() => {
    return players.filter((player) => {
      const playerName = getPlayerName(player).toLowerCase();
      const playerAge = parseInt(player.age) || calculateAge(player.birthdate);
      
      // Search by player name (using debounced search term)
      if (debouncedSearchTerm && !playerName.includes(debouncedSearchTerm.toLowerCase())) {
        return false;
      }

      // Filter by team (using debounced value)
      if (debouncedSelectedTeam && getPlayerTeamId(player) !== debouncedSelectedTeam) {
        return false;
      }

      // Filter by position (using debounced value)
      if (debouncedSelectedPosition && player.preferredposition1 !== debouncedSelectedPosition) {
        return false;
      }

      // Filter by country (using debounced value)
      if (debouncedSelectedCountry && player.nationality !== debouncedSelectedCountry) {
        return false;
      }

      // Filter by rating range (using debounced value)
      const rating = parseInt(player.overallrating);
      if (rating < debouncedRatingRange[0] || rating > debouncedRatingRange[1]) {
        return false;
      }

      // Filter by age range (using debounced value)
      if (playerAge < debouncedAgeRange[0] || playerAge > debouncedAgeRange[1]) {
        return false;
      }

      return true;
    });
  }, [players, debouncedSearchTerm, debouncedSelectedTeam, debouncedSelectedPosition, debouncedSelectedCountry, debouncedRatingRange, debouncedAgeRange, teamPlayerLinks, teams]);

  // Get unique teams and countries for filter options
  const availableTeams = React.useMemo(() => {
    const teamSet = new Set<string>();
    const teamsList: Array<{ id: string; name: string }> = [];
    
    Object.entries(teamPlayerLinks).forEach(([, teamId]) => {
      if (teamId && !teamSet.has(teamId) && teams[teamId]) {
        teamSet.add(teamId);
        teamsList.push({ id: teamId, name: teams[teamId].teamname });
      }
    });
    
    return teamsList.sort((a, b) => a.name.localeCompare(b.name));
  }, [teamPlayerLinks, teams]);

  const availableCountries = React.useMemo(() => {
    const countrySet = new Set<string>();
    const countries: Array<{ id: string; name: string }> = [];
    
    players.forEach((player) => {
      if (player.nationality && !countrySet.has(player.nationality)) {
        countrySet.add(player.nationality);
        countries.push({ id: player.nationality, name: getCountryName(player.nationality) });
      }
    });
    
    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }, [players, nations]);

  // Pagination calculations for filtered players
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
  const startIndex = (currentPage - 1) * playersPerPage;
  const endIndex = startIndex + playersPerPage;
  
  // Use memo for current players to avoid unnecessary recalculations
  const currentPlayers = React.useMemo(() => {
    return filteredPlayers.slice(startIndex, endIndex);
  }, [filteredPlayers, startIndex, endIndex]);

  // Reset page when filters change (using debounced values)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, debouncedSelectedTeam, debouncedSelectedPosition, debouncedSelectedCountry, debouncedRatingRange, debouncedAgeRange]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedTeam("");
    setSelectedPosition("");
    setSelectedCountry("");
    setRatingRange([0, 100]);
    setAgeRange([16, 45]);
  };

  // Function to start lazy loading
  const startLazyLoading = async () => {
    if (isLazyLoading || isFetching.current) return;

    // Reset progress state at the beginning
    setProgressState({
      stage: 'data_transfer',
      percentage: 1,
      message: 'Initializing player data loading...',
      isActive: true,
      substages: {
        database: { percentage: 0, status: 'pending' },
        transfer: { percentage: 1, status: 'active' },
        processing: { percentage: 0, status: 'pending' }
      },
      startTime: Date.now()
    });
    
    setIsLazyLoading(true);
    isFetching.current = true;
    setLoadingStats({}); // Reset loading stats

    try {
      const playersUrl = projectId ? 
        `http://localhost:8000/players/lazy?project_id=${projectId}&batch_size=1000` : 
        "http://localhost:8000/players/lazy?batch_size=1000";

      console.log("Starting lazy loading from:", playersUrl);
      
      // Update progress to show transfer starting
      setProgressState(prev => ({
        ...prev,
        stage: 'data_transfer',
        percentage: 70,
        message: 'Requesting player data from server...',
        substages: {
          database: { percentage: 100, status: 'completed' },
          transfer: { percentage: 20, status: 'active' },
          processing: { percentage: 0, status: 'pending' }
        }
      }));
      
      const playersResponse = await fetch(playersUrl);
      
      // Update progress to show data received
      setProgressState(prev => ({
        ...prev,
        percentage: 85,
        message: 'Data received, preparing...',
        substages: {
          database: { percentage: 100, status: 'completed' },
          transfer: { percentage: 80, status: 'active' },
          processing: { percentage: 0, status: 'pending' }
        }
      }));
      
      if (playersResponse.ok) {
        const playersData = await playersResponse.json();
        console.log("Received players data:", playersData ? playersData.length : 0, "players");
        
        if (playersData && Array.isArray(playersData)) {
          console.log("Players state updated with", playersData.length, "players");
          
          // Start processing phase when data is received
          setProgressState(prev => ({
            ...prev,
            stage: 'processing',
            percentage: 90,
            message: `Processing ${playersData.length.toLocaleString()} players...`,
            substages: {
              database: { percentage: 100, status: 'completed' },
              transfer: { percentage: 100, status: 'completed' },
              processing: { percentage: 10, status: 'active' }
            }
          }));
          
          // Simulate processing with incremental updates
          let processingProgress = 10;
          const processingInterval = setInterval(() => {
            processingProgress += 20;
            
            if (processingProgress >= 100) {
              clearInterval(processingInterval);
              
              // Set players data and complete
              setPlayers(playersData);
              setProgressState(prev => ({
                ...prev,
                stage: 'completed',
                percentage: 100,
                message: `Successfully loaded ${playersData.length.toLocaleString()} players`,
                substages: {
                  database: { percentage: 100, status: 'completed' },
                  transfer: { percentage: 100, status: 'completed' },
                  processing: { percentage: 100, status: 'completed' }
                }
              }));
              
              // Hide progress after 2 seconds
              setTimeout(() => {
                setProgressState(prev => ({ ...prev, isActive: false }));
              }, 2000);
            } else {
              // Update processing progress
              setProgressState(prev => ({
                ...prev,
                percentage: 90 + (processingProgress / 100) * 10, // 90% to 100%
                message: `Processing players... ${Math.round(processingProgress)}%`,
                substages: {
                  ...prev.substages,
                  processing: { percentage: processingProgress, status: 'active' }
                }
              }));
            }
          }, 200); // Update every 200ms
        } else {
          console.error("Invalid players data format:", typeof playersData);
          setProgressState(prev => ({
            ...prev,
            stage: 'error',
            percentage: 0,
            message: 'Invalid data format received',
            isActive: false
          }));
        }
      } else {
        console.error("Failed to start lazy loading:", playersResponse.status, playersResponse.statusText);
        const errorText = await playersResponse.text();
        console.error("Error details:", errorText);
        
        // Show error state
        setProgressState(prev => ({
          ...prev,
          stage: 'error',
          percentage: 0,
          message: 'Failed to load players',
          isActive: false
        }));
      }
    } catch (error) {
      console.error("Error starting lazy loading:", error);
      
      // Show error state
      setProgressState(prev => ({
        ...prev,
        stage: 'error',
        percentage: 0,
        message: 'Error loading players',
        isActive: false
      }));
    } finally {
      setIsLazyLoading(false);
      isFetching.current = false;
    }
  };

  // Load players on component mount or project change
  React.useEffect(() => {
    console.log("Players effect triggered, players.length:", players.length, "isFetching:", isFetching.current);
    // Auto-start lazy loading when component mounts
    if (!isFetching.current && players.length === 0) {
      startLazyLoading();
    }
  }, [projectId]);

  // Debug effect to track players state changes and force completion
  React.useEffect(() => {
    console.log("Players state changed:", players.length, "players loaded");
    
    // If we have players but progress is not completed, force completion
    if (players.length > 0 && (progressState.stage !== 'completed' || progressState.percentage < 100)) {
      console.log("Force completing progress due to players state change");
      setProgressState(prev => ({
        ...prev,
        stage: 'completed',
        percentage: 100,
        message: `Successfully loaded ${players.length.toLocaleString()} players`,
        isActive: true,
        substages: {
          database: { percentage: 100, status: 'completed' },
          transfer: { percentage: 100, status: 'completed' },
          processing: { percentage: 100, status: 'completed' }
        }
      }));
      
      // Hide after 2 seconds
      setTimeout(() => {
        setProgressState(prev => ({ ...prev, isActive: false }));
      }, 2000);
    }
  }, [players.length, progressState.stage, progressState.percentage]);

  // Load nations data
  React.useEffect(() => {
    if (nationsFetched.current) return;

    const fetchNations = async () => {
      setLoadingNations(true);
      nationsFetched.current = true;
      
      try {
        const nationsUrl = projectId ? 
          `http://localhost:8000/nations?project_id=${projectId}` : 
          "http://localhost:8000/nations";


        const nationsResponse = await fetch(nationsUrl);
        if (nationsResponse.ok) {
          const nationsData: Nation[] = await nationsResponse.json();
          
          // Convert array to object with nationid as key
          const nationsMap: { [nationId: string]: Nation } = {};
          nationsData.forEach((nation) => {
            nationsMap[nation.nationid] = nation;
          });
          
          setNations(nationsMap);
        } else {
          console.error("Failed to fetch nations");
        }
      } catch (error) {
        console.error("Error fetching nations:", error);
      } finally {
        setLoadingNations(false);
      }
    };

    fetchNations();
  }, [projectId]);

  // Load player names data
  React.useEffect(() => {
    if (players.length === 0 || playerNamesFetched.current) return;

    const fetchPlayerNames = async () => {
      setLoadingPlayerNames(true);
      playerNamesFetched.current = true;
      
      try {
        const playerNamesUrl = projectId ? 
          `http://localhost:8000/playernames?project_id=${projectId}` : 
          "http://localhost:8000/playernames";


        const playerNamesResponse = await fetch(playerNamesUrl);
        if (playerNamesResponse.ok) {
          const playerNamesData: PlayerName[] = await playerNamesResponse.json();
          
          // Convert array to object with nameid as key
          const playerNamesMap: { [nameId: string]: string } = {};
          playerNamesData.forEach((playerName) => {
            playerNamesMap[playerName.nameid] = playerName.name;
          });
          
          setPlayerNames(playerNamesMap);
        } else {
          console.error("Failed to fetch player names");
        }
      } catch (error) {
        console.error("Error fetching player names:", error);
      } finally {
        setLoadingPlayerNames(false);
      }
    };

    // Delay loading player names to prioritize players loading
    const timeoutId = setTimeout(fetchPlayerNames, 200);
    return () => clearTimeout(timeoutId);
  }, [players.length, projectId]);

  // Load team-player links and teams after players are loaded
  React.useEffect(() => {
    if (players.length === 0 || teamsFetched.current) return;

    const fetchTeamsData = async () => {
      setLoadingTeams(true);
      teamsFetched.current = true;
      
      try {
        const teamPlayerLinksUrl = projectId ? 
          `http://localhost:8000/teamplayerlinks?project_id=${projectId}` : 
          "http://localhost:8000/teamplayerlinks";
        
        const teamsUrl = projectId ? 
          `http://localhost:8000/teams?project_id=${projectId}` : 
          "http://localhost:8000/teams";


        const [teamPlayerLinksResponse, teamsResponse] = await Promise.all([
          fetch(teamPlayerLinksUrl),
          fetch(teamsUrl)
        ]);

        if (teamPlayerLinksResponse.ok && teamsResponse.ok) {
          const teamPlayerLinksData = await teamPlayerLinksResponse.json();
          const teamsData = await teamsResponse.json();
          
          
          // Create player to team mapping
          const playerTeamMap: { [playerId: string]: string } = {};
          teamPlayerLinksData.forEach((link: TeamPlayerLink) => {
            playerTeamMap[link.playerid] = link.teamid;
          });
          setTeamPlayerLinks(playerTeamMap);
          
          // Create teams mapping
          const teamsMap: { [teamId: string]: Team } = {};
          teamsData.forEach((team: Team) => {
            teamsMap[team.teamid] = team;
          });
          setTeams(teamsMap);
        } else {
          console.error("Failed to fetch teams data");
        }
      } catch (error) {
        console.error("Error fetching teams data:", error);
      } finally {
        setLoadingTeams(false);
      }
    };

    // Delay loading teams to prioritize players loading
    const timeoutId = setTimeout(fetchTeamsData, 500);
    return () => clearTimeout(timeoutId);
  }, [players.length, projectId]);

  const handlePageChange = React.useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to table top with optimized behavior
    const tableElement = document.querySelector('[aria-label="Players table"]');
    if (tableElement) {
      tableElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    } else {
      // Fallback to window scroll
      window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="pt-5 px-2">
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" label="Loading players..." />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-5 px-2">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-lg font-semibold">Player Management</h3>
            <p className="text-sm text-default-500">
              {players.length > 0 ? (
                <>
                  {filteredPlayers.length} players • Page {currentPage} of {totalPages}
                  <span className="text-default-600"> • {players.length} total loaded</span>
                  <span className="text-primary-600"> • Progress: {progressState.isActive ? 'Active' : 'Inactive'}</span>
                  {(searchTerm || selectedTeam || selectedPosition || selectedCountry || 
                    ratingRange[0] > 0 || ratingRange[1] < 100 || 
                    ageRange[0] > 16 || ageRange[1] < 45) && (
                    <span className="text-warning-600"> • Filtering active</span>
                  )}
                  {(searchTerm !== debouncedSearchTerm || 
                    selectedTeam !== debouncedSelectedTeam || 
                    selectedPosition !== debouncedSelectedPosition || 
                    selectedCountry !== debouncedSelectedCountry ||
                    JSON.stringify(ratingRange) !== JSON.stringify(debouncedRatingRange) ||
                    JSON.stringify(ageRange) !== JSON.stringify(debouncedAgeRange)) && (
                    <span className="text-primary-600"> • Updating...</span>
                  )}
                </>
              ) : progressState.isActive ? (
                <>
                  {progressState.stage === 'database_loading' ? 'Loading player data from database...' : 
                   progressState.stage === 'data_transfer' ? 'Transferring player data...' : 'Loading player data...'}
                  {loadingStats.playersPerSecond && loadingStats.playersPerSecond > 0 && (
                    <span className="text-primary-600"> • {Math.round(loadingStats.playersPerSecond)} players/s</span>
                  )}
                </>
              ) : (
                "No players data available"
              )}
              {loadingPlayerNames && (
                <span className="text-warning-600"> • Loading names...</span>
              )}
              {loadingTeams && (
                <span className="text-warning-600"> • Loading teams...</span>
              )}
              {loadingNations && (
                <span className="text-warning-600"> • Loading countries...</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button color="warning" startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}>
              Add Player
            </Button>
            {players.length > 0 && (
              <Button 
                color="primary" 
                variant="flat"
                startContent={<Icon icon="lucide:refresh-cw" className="h-4 w-4" />}
                onPress={() => {
                  setPlayers([]);
                  setLoadingStats({});
                  setProgressState({
                    stage: 'idle',
                    percentage: 0,
                    message: '',
                    isActive: false,
                    substages: {
                      database: { percentage: 0, status: 'pending' },
                      transfer: { percentage: 0, status: 'pending' },
                      processing: { percentage: 0, status: 'pending' }
                    }
                  });
                  isFetching.current = false;
                  setTimeout(() => startLazyLoading(), 100);
                }}
                isDisabled={progressState.isActive}
              >
                Reload
              </Button>
            )}
          </div>
        </div>

        {/* Simplified Progress Bar */}
        {progressState.isActive && (
          <div className="mb-6 p-4 border border-warning-200 rounded-lg">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <Icon 
                  icon={progressState.percentage >= 100 ? "lucide:check-circle" : "lucide:loader-2"} 
                  className={`h-4 w-4 ${progressState.percentage >= 100 ? 'text-success-600' : 'text-warning-600 animate-spin'}`}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-default-800">
                    Loading Players
                  </span>
                  <span className="text-xs text-default-500">
                    {progressState.message}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Chip 
                  color={progressState.percentage >= 100 ? "success" : "warning"} 
                  variant="flat" 
                  size="sm"
                  className="text-xs font-mono font-bold"
                >
                  {progressState.percentage.toFixed(1)}%
                </Chip>
                {loadingStats.playersPerSecond && loadingStats.playersPerSecond > 0 && (
                  <Chip color="secondary" variant="flat" size="sm" className="text-xs">
                    {Math.round(loadingStats.playersPerSecond)}/s
                  </Chip>
                )}
                {serverProgress?.current && serverProgress?.total && (
                  <span className="text-xs text-default-500 font-mono">
                    {serverProgress.current.toLocaleString()}/{serverProgress.total.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Single Progress Bar */}
            <div className="space-y-2">
              <Progress
                value={progressState.percentage}
                color={progressState.percentage >= 100 ? "success" : "warning"}
                className="flex-1"
                size="md"
                aria-label="Loading progress"
              />
            </div>
          </div>
        )}

        {players.length > 0 && (
          <>
            <PlayerFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedTeam={selectedTeam}
              onTeamChange={setSelectedTeam}
              selectedPosition={selectedPosition}
              onPositionChange={setSelectedPosition}
              selectedCountry={selectedCountry}
              onCountryChange={setSelectedCountry}
              ratingRange={ratingRange}
              onRatingRangeChange={(value) => setRatingRange(value as [number, number])}
              ageRange={ageRange}
              onAgeRangeChange={(value) => setAgeRange(value as [number, number])}
              onClearFilters={handleClearFilters}
              teams={availableTeams}
              countries={availableCountries}
              totalPlayers={players.length}
              filteredPlayers={filteredPlayers.length}
            />
          </>
        )}

        {players.length === 0 && !progressState.isActive ? (
          <div className="text-center py-12">
            <Icon icon="lucide:database-x" className="h-16 w-16 mx-auto text-default-300 mb-4" />
            <h3 className="text-xl font-semibold text-default-500 mb-2">No Players Data</h3>
            <p className="text-default-400 mb-6">
              Unable to load player data. Please check your connection and try again.
            </p>
            <Button 
              color="primary" 
              size="lg"
              startContent={<Icon icon="lucide:refresh-cw" className="h-5 w-5" />}
              onPress={() => {
                setPlayers([]);
                setLoadingStats({});
                setProgressState({
                  stage: 'idle',
                  percentage: 0,
                  message: '',
                  isActive: false,
                  substages: {
                    database: { percentage: 0, status: 'pending' },
                    transfer: { percentage: 0, status: 'pending' },
                    processing: { percentage: 0, status: 'pending' }
                  }
                });
                isFetching.current = false;
                setTimeout(() => startLazyLoading(), 100);
              }}
            >
              Retry Loading
            </Button>
          </div>
        ) : players.length === 0 && progressState.isActive ? (
          <div className="text-center py-12">
            <Icon icon="lucide:loader-2" className="h-12 w-12 mx-auto text-warning-500 mb-4 animate-spin" />
            <h3 className="text-lg font-semibold text-default-600 mb-2">Loading Players...</h3>
            <p className="text-default-500">
              Please wait while we load all player data. Progress is shown at the top of the page.
            </p>
          </div>
        ) : players.length > 0 ? (
          <>
            <Table
              aria-label="Players table"
              className="min-h-[400px]"
              classNames={{
                wrapper: "shadow-md rounded-lg",
              }}
            >
              <TableHeader>
                <TableColumn>Player</TableColumn>
                <TableColumn>Team</TableColumn>
                <TableColumn>Position</TableColumn>
                <TableColumn>Age</TableColumn>
                <TableColumn>Overall</TableColumn>
                <TableColumn>Potential</TableColumn>
                <TableColumn>Value</TableColumn>
                <TableColumn>Skills</TableColumn>
              </TableHeader>
              <TableBody>
                {currentPlayers.map((player) => (
                  <TableRow
                    key={player.playerid}
                    className="cursor-pointer hover:bg-default-50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Image
                          src={getPlayerAvatarUrl(player.playerid)}
                          alt={getPlayerName(player)}
                          className="w-10 h-10 object-cover rounded-full"
                          fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2306d6a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'/%3E%3C/svg%3E"
                        />
                        <img 
                          src={getCountryFlagUrl(player.nationality)}
                          alt={`Flag of ${getCountryName(player.nationality)}`}
                          className="w-6 h-4 object-cover rounded-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div>
                          <Tooltip content={getPlayerName(player)} placement="top">
                            <span className="font-medium block w-32 truncate cursor-help">
                              {getPlayerName(player)}
                            </span>
                          </Tooltip>
                          <p className="text-xs text-default-500">ID: {player.playerid}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {loadingTeams ? (
                        <Spinner size="sm" />
                      ) : (
                        <div className="flex items-center gap-2">
                          {getPlayerTeamId(player) && (
                            <Image
                              src={getTeamLogoUrl(getPlayerTeamId(player))}
                              alt={`${getPlayerTeamName(player)} logo`}
                              className="w-6 h-6 object-contain"
                              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2306d6a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'/%3E%3C/svg%3E"
                            />
                          )}
                          <Tooltip content={getPlayerTeamName(player)} placement="top">
                            <span className="text-sm cursor-help block w-24 truncate">
                              {getPlayerTeamName(player)}
                            </span>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getPositionColor(getPlayerPosition(player))}
                        variant="flat"
                        size="sm"
                      >
                        {getPlayerPosition(player)}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getAgeColor(player.age)}
                        variant="flat"
                        size="sm"
                      >
                        {player.age}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getRatingColor(player.overallrating)}
                        variant="flat"
                        size="sm"
                      >
                        {player.overallrating}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={getRatingColor(player.potential)}
                        variant="flat"
                        size="sm"
                      >
                        {player.potential}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">€{player.value || "N/A"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip content={`Skill Moves: ${player.playerskillmoves}★`}>
                          <Chip color="warning" variant="flat" size="sm">
                            {player.playerskillmoves}★
                          </Chip>
                        </Tooltip>
                        <Tooltip content={`Weak Foot: ${player.weakfootabilitytypecode}★`}>
                          <Chip color="secondary" variant="flat" size="sm">
                            {player.weakfootabilitytypecode}★
                          </Chip>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  total={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
                  showControls
                  color="warning"
                  aria-label="Players table pagination"
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
} 