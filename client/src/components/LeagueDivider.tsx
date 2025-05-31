import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
  Divider,
  Chip,
  Avatar,
  Image,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownSection,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Accordion,
  AccordionItem,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import AddTeams from "./AddTeams";

interface League {
  leagueid: string;
  leaguename: string;
  countryid: string;
  level: string;
  leaguetype: string;
  iswomencompetition: string;
  isinternationalleague: string;
  iscompetitionscarfenabled: string;
  isbannerenabled: string;
  iscompetitionpoleflagenabled: string;
  iscompetitioncrowdcardsenabled: string;
  leaguetimeslice: string;
  iswithintransferwindow: string;
}

interface LeagueDividerProps {
  league: League | null;
  isOpen: boolean;
  onClose: () => void;
  teamCount: number;
  projectId?: string;
  onDataRefresh?: () => void;
}

interface TeamLink {
  teamid: string;
  leagueid: string;
}

interface Nation {
  nationid: string;
  nationname: string;
  isocountrycode: string;
}

interface TransfermarktLeague {
  confederation: string;
  tier: number;
  competition: string;
  country: string;
  competition_url: string;
  competition_logo_url: string;
  clubs: number;
  average_market_value: string;
  total_value: string;
}

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

interface Team {
  teamid: string;
  teamname: string;
  overallrating: string;
  attackrating: string;
  midfieldrating: string;
  defenserating: string;
  domesticprestige: string;
  internationalprestige: string;
  clubworth: string;
  foundationyear: string;
  leaguetitles: string;
  domesticcups: string;
  teamstadiumcapacity: string;
  cityid: string;
}

interface TransfermarktTeamLink {
  teamid: string;
  teamname: string;
  transfermarkt_url: string;
}

// Add CSS animations
const styles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// TeamCard Component
interface TeamCardProps {
  tmTeam: TransfermarktTeam;
  index: number;
  isMatched: boolean;
  selectionMode: "none" | "update" | "export";
  selectedForUpdate: Set<string>;
  selectedForExport: Set<string>;
  handleTeamSelection: (teamId: string, isSelected: boolean) => void;
  teamMatches: { [teamId: string]: Team | null };
  getMatchType: (tmTeam: TransfermarktTeam) => "url" | "manual" | "none";
  getTeamLogoUrl: (teamId: string) => string;
  setLinkTeamModal: (modal: { isOpen: boolean; team: TransfermarktTeam | null }) => void;
  removeManualMatch: (tmTeamId: string) => void;
  animationDelay: number;
}

const TeamCard: React.FC<TeamCardProps> = ({
  tmTeam,
  index,
  isMatched,
  selectionMode,
  selectedForUpdate,
  selectedForExport,
  handleTeamSelection,
  teamMatches,
  getMatchType,
  getTeamLogoUrl,
  setLinkTeamModal,
  removeManualMatch,
  animationDelay
}) => {
  const currentMatch = teamMatches[tmTeam.team_id];
  const matchType = getMatchType(tmTeam);
  const canSelect = (selectionMode === "update" && isMatched) || (selectionMode === "export" && !isMatched);
  const isSelected = (selectionMode === "update" && selectedForUpdate.has(tmTeam.team_id)) || 
                   (selectionMode === "export" && selectedForExport.has(tmTeam.team_id));

  return (
    <div className="relative">
      {/* Selection Mode Overlay */}
      {selectionMode !== "none" && (
        <div 
          className={`
            absolute inset-0 z-10 rounded-xl border-2 transition-all duration-300 cursor-pointer
            ${canSelect 
              ? isSelected 
                ? "border-success-500 bg-success-500/10"
                : "border-default-300 bg-white/80 hover:border-primary-400 hover:bg-primary-50/50"
              : "border-default-200 bg-default-100/50 cursor-not-allowed opacity-40"
            }
          `}
          onClick={() => {
            if (canSelect) {
              handleTeamSelection(tmTeam.team_id, !isSelected);
            }
          }}
        >
          {/* Disabled Indicator */}
          {!canSelect && (
            <div className="absolute top-2 left-2 z-20">
              <div className="w-6 h-6 rounded-lg border-2 bg-default-200 border-default-300 flex items-center justify-center">
                <Icon icon="lucide:minus" className="h-4 w-4 text-default-500" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team Card */}
      <Dropdown backdrop="blur" isDisabled={selectionMode !== "none"}>
        <DropdownTrigger>
          <div 
            className={`
              relative group p-2 rounded-xl border-2 transition-all duration-300 cursor-pointer
              ${isSelected 
                ? "border-success-500 bg-success-50/30"
                : isMatched 
                  ? matchType === "url" 
                    ? "border-blue-300 bg-blue-50 shadow-md shadow-blue-200/30" 
                    : matchType === "manual"
                    ? "border-secondary-400 bg-secondary-50 shadow-lg shadow-secondary-200/50"
                    : "border-default-200 bg-white hover:border-primary-300 hover:shadow-md"
                  : "border-default-200 bg-white hover:border-primary-300 hover:shadow-md"
              }
              ${selectionMode === "none" ? "hover:scale-105" : ""}
            `}
            style={{
              animation: `fadeInUp 0.5s ease-out ${animationDelay}ms forwards`
            }}
          >
            {/* Team Logo */}
            <div className="relative flex items-center justify-center">
              <Image
                src={tmTeam.teamlogo}
                alt={tmTeam.teamname}
                className="w-12 h-12 object-contain"
                radius="sm"
              />
              
              {/* Match Status Badge */}
              {isMatched && matchType !== "none" && (
                <div className="absolute -top-1 -right-1">
                  <div className={`
                    w-4 h-4 rounded-full flex items-center justify-center
                    ${matchType === "url" ? "bg-blue-500" : "bg-secondary-500"}
                  `}>
                    <Icon 
                      icon={matchType === "url" ? "lucide:link" : "lucide:user"} 
                      className="h-2.5 w-2.5 text-white" 
                    />
                  </div>
                </div>
              )}
              
              {/* Game Team Logo Overlay */}
              {currentMatch && (
                <div className="absolute -bottom-1 -right-1">
                  <Image
                    src={getTeamLogoUrl(currentMatch.teamid)}
                    alt={currentMatch.teamname}
                    className="w-4 h-4 object-contain border-2 border-white rounded-full bg-white shadow-md"
                  />
                </div>
              )}
            </div>
          </div>
        </DropdownTrigger>
        
        <DropdownMenu 
          aria-label={`Actions for ${tmTeam.teamname}`}
          variant="flat"
          disableAnimation
          onAction={(key) => {
            if (key === "link") {
              setLinkTeamModal({ isOpen: true, team: tmTeam });
            } else if (key === "change-link") {
              setLinkTeamModal({ isOpen: true, team: tmTeam });
            }
          }}
        >
          <DropdownItem
            key="info"
            isReadOnly
            className="p-0"
            textValue={`Team info for ${tmTeam.teamname}`}
          >
            <Popover placement="right" backdrop="blur">
              <PopoverTrigger>
                <div className="flex items-center gap-2 p-2 w-full hover:bg-default-100 rounded-lg cursor-pointer">
                  <Icon icon="lucide:info" className="h-4 w-4" />
                  <div className="flex items-center gap-2">
                    <Image
                      src={tmTeam.teamlogo}
                      alt={tmTeam.teamname}
                      className="w-5 h-5 object-contain"
                    />
                    <span className="font-medium">{tmTeam.teamname}</span>
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-3 border-b border-default-200 pb-3">
                    <Image
                      src={tmTeam.teamlogo}
                      alt={tmTeam.teamname}
                      className="w-10 h-10 object-contain"
                    />
                    <div>
                      <h3 className="text-lg font-bold">{tmTeam.teamname}</h3>
                      <p className="text-sm text-default-500">Team Information</p>
                    </div>
                  </div>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primary-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon icon="lucide:users" className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Squad</span>
                      </div>
                      <p className="text-xl font-bold text-primary">{tmTeam.squad}</p>
                      <p className="text-xs text-default-500">players</p>
                    </div>
                    
                    <div className="bg-secondary-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon icon="lucide:calendar" className="h-4 w-4 text-secondary" />
                        <span className="text-sm font-medium">Avg Age</span>
                      </div>
                      <p className="text-xl font-bold text-secondary">{tmTeam.avg_age}</p>
                      <p className="text-xs text-default-500">years</p>
                    </div>
                    
                    <div className="bg-warning-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon icon="lucide:globe" className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium">Foreigners</span>
                      </div>
                      <p className="text-xl font-bold text-warning">{tmTeam.foreigners}</p>
                      <p className="text-xs text-default-500">players</p>
                    </div>
                    
                    <div className="bg-success-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon icon="lucide:euro" className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">Value</span>
                      </div>
                      <p className="text-sm font-bold text-success">{tmTeam.total_market_value}</p>
                      <p className="text-xs text-default-500">Avg: {tmTeam.avg_market_value}</p>
                    </div>
                  </div>
                  
                  {/* Transfermarkt Link */}
                  {tmTeam.team_url && (
                    <div className="pt-2 border-t border-default-200">
                      <Button
                        as="a"
                        href={tmTeam.team_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        color="primary"
                        variant="flat"
                        className="w-full"
                        endContent={<Icon icon="lucide:external-link" className="h-3 w-3" />}
                      >
                        View on Transfermarkt
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </DropdownItem>
          
          {!isMatched ? (
            <DropdownItem
              key="link"
              startContent={<Icon icon="lucide:link" className="h-4 w-4" />}
              description="Connect this team with a game team"
              textValue="Link with Game Team"
            >
              Link with Game Team
            </DropdownItem>
          ) : (
            <>
              <DropdownItem
                key="current-match"
                startContent={
                  <Image
                    src={getTeamLogoUrl(currentMatch!.teamid)}
                    alt={currentMatch!.teamname}
                    className="w-4 h-4 object-contain"
                  />
                }
                description={`${matchType === "url" ? "URL Match" : "Manual Match"} • OVR: ${currentMatch!.overallrating || "N/A"}`}
                color="success"
                variant="flat"
                isReadOnly
                textValue={`Linked: ${currentMatch!.teamname}`}
              >
                Linked: {currentMatch!.teamname}
              </DropdownItem>
              
              {matchType === "manual" && (
                <DropdownItem
                  key="unlink"
                  startContent={<Icon icon="lucide:unlink" className="h-4 w-4" />}
                  description="Remove manual link"
                  color="danger"
                  onPress={() => removeManualMatch(tmTeam.team_id)}
                  textValue="Unlink Team"
                >
                  Unlink Team
                </DropdownItem>
              )}
              
              <DropdownItem
                key="change-link"
                startContent={<Icon icon="lucide:refresh-cw" className="h-4 w-4" />}
                description="Change the linked game team"
                textValue="Change Link"
              >
                Change Link
              </DropdownItem>
            </>
          )}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};

export default React.memo(function LeagueDivider({ league, isOpen, onClose, teamCount, projectId, onDataRefresh }: LeagueDividerProps) {
  const [teams, setTeams] = React.useState<string[]>([]);
  const [teamsData, setTeamsData] = React.useState<{ [teamId: string]: Team }>({});
  const [loadingTeams, setLoadingTeams] = React.useState(false);
  const [nations, setNations] = React.useState<{ [nationId: string]: Nation }>({});
  const [transfermarktLeagues, setTransfermarktLeagues] = React.useState<TransfermarktLeague[]>([]);
  const [loadingTransfermarkt, setLoadingTransfermarkt] = React.useState(false);
  const [lastUpdateInfo, setLastUpdateInfo] = React.useState<{timestamp: number, date: string} | null>(null);
  const [loadingTeamsFromTransfermarkt, setLoadingTeamsFromTransfermarkt] = React.useState(false);
  const [transfermarktTeams, setTransfermarktTeams] = React.useState<TransfermarktTeam[]>([]);
  const [progressData, setProgressData] = React.useState<any>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const wsRef = React.useRef<WebSocket | null>(null);
  const [gameTeams, setGameTeams] = React.useState<{ [teamId: string]: Team }>({});
  const reconnectAttemptsRef = React.useRef(0);
  const maxReconnectAttempts = 3;
  const [manualMatches, setManualMatches] = React.useState<{ [tmTeamId: string]: Team }>({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTransfermarktTeams, setSelectedTransfermarktTeams] = React.useState<Set<string>>(new Set());
  const [teamlinksFromTm, setTeamlinksFromTm] = React.useState<{ [teamId: string]: TransfermarktTeamLink }>({});
  const [linkTeamModal, setLinkTeamModal] = React.useState<{ isOpen: boolean; team: TransfermarktTeam | null }>({ isOpen: false, team: null });
  const [selectedForUpdate, setSelectedForUpdate] = React.useState<Set<string>>(new Set());
  const [selectedForExport, setSelectedForExport] = React.useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = React.useState<"none" | "update" | "export">("none");
  const [isGrouped, setIsGrouped] = React.useState(false);
  const [isAddTeamsModalOpen, setIsAddTeamsModalOpen] = React.useState(false);
  const isFetchingTeams = React.useRef(false); // Renamed for clarity

  // Centralized function to fetch league teams data
  const fetchLeagueTeamsData = React.useCallback(async () => {
    if (!league || isFetchingTeams.current) return;

    isFetchingTeams.current = true;
    setLoadingTeams(true);
    console.log(`[LeagueDivider] Fetching teams for league ${league.leagueid}`);

    try {
      const leagueTeamLinksUrl = projectId ? 
        `http://localhost:8000/leagueteamlinks?project_id=${projectId}` : 
        "http://localhost:8000/leagueteamlinks";

      const teamsUrl = projectId ? 
        `http://localhost:8000/teams?project_id=${projectId}` : 
        "http://localhost:8000/teams";

      const [leagueTeamLinksResponse, teamsResponse] = await Promise.all([
        fetch(leagueTeamLinksUrl),
        fetch(teamsUrl)
      ]);

      if (leagueTeamLinksResponse.ok && teamsResponse.ok) {
        const leagueTeamLinksData: TeamLink[] = await leagueTeamLinksResponse.json();
        const allTeamsData: Team[] = await teamsResponse.json();
        
        const leagueTeams = leagueTeamLinksData
          .filter(link => link.leagueid === league.leagueid)
          .map(link => link.teamid);
        
        const teamsMap: { [teamId: string]: Team } = {};
        allTeamsData.forEach((team) => {
          teamsMap[team.teamid] = team;
        });
        
        setTeams(leagueTeams);
        setTeamsData(teamsMap);

        // Also update gameTeams for matching if it depends on the full list
        const gameTeamsMap: { [teamId: string]: Team } = {};
        allTeamsData.forEach((team) => {
          gameTeamsMap[team.teamid] = team;
        });
        setGameTeams(gameTeamsMap);
        console.log(`[LeagueDivider] Successfully fetched and set ${leagueTeams.length} teams for league ${league.leagueid}`);

      } else {
        console.error(`[LeagueDivider] Failed to fetch teams data for league ${league.leagueid}`);
      }
    } catch (error) {
      console.error(`[LeagueDivider] Error fetching teams for league ${league.leagueid}:`, error);
    } finally {
      setLoadingTeams(false);
      isFetchingTeams.current = false;
    }
  }, [league, projectId]); // Dependencies for the fetch logic itself

  // Load teamlinks from Transfermarkt data
  React.useEffect(() => {
    if (!isOpen) return;

    const fetchTeamlinksFromTm = async () => {
      try {
        const response = await fetch("http://localhost:8000/db/teamlinks_from_tm");
        if (response.ok) {
          const teamlinksData: TransfermarktTeamLink[] = await response.json();
          
          // Convert array to object with teamid as key
          const teamlinksMap: { [teamId: string]: TransfermarktTeamLink } = {};
          teamlinksData.forEach((link) => {
            if (link.transfermarkt_url !== "Not found") {
              teamlinksMap[link.teamid] = link;
            }
          });
          
          setTeamlinksFromTm(teamlinksMap);
        }
      } catch (error) {
        console.error("Error fetching teamlinks from TM:", error);
      }
    };

    fetchTeamlinksFromTm();
  }, [isOpen]);

  // Load nations data
  React.useEffect(() => {
    if (!isOpen) return;

    const fetchNations = async () => {
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
        }
      } catch (error) {
        console.error("Error fetching nations:", error);
      }
    };

    fetchNations();
  }, [isOpen, projectId]);

  // Load all game teams for matching (this seems to be a full list, perhaps can be optimized or use teamsData)
  // This useEffect was for `setGameTeams`. The `fetchLeagueTeamsData` now also updates `gameTeams`.
  // Consider if this separate fetch is still needed or if `gameTeams` can be derived from `teamsData` directly.
  // For now, let `fetchLeagueTeamsData` handle updating `gameTeams` as well, to keep it consistent.
  // React.useEffect(() => {
  //   if (!isOpen) return;
  //   const fetchAllGameTeams = async () => { /* ... */ };
  //   fetchAllGameTeams();
  // }, [isOpen, projectId]);

  // Reset transfermarkt teams when league changes
  React.useEffect(() => {
    setTransfermarktTeams([]);
  }, [league?.leagueid]);

  // WebSocket connection for progress updates
  React.useEffect(() => {
    if (!isOpen) return;

    let reconnectTimeout: NodeJS.Timeout;
    let isConnecting = false;

    const connectWebSocket = () => {
      if (isConnecting || wsRef.current?.readyState === WebSocket.CONNECTING) return;
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) wsRef.current.close();
      isConnecting = true;

      try {
        const ws = new WebSocket('ws://localhost:8000/ws');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[LeagueDivider] WebSocket connected');
          setWsConnected(true);
          setProgressData(null); // Clear any stale progress data when connecting
          isConnecting = false;
          reconnectAttemptsRef.current = 0;
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[LeagueDivider] WebSocket message:', data); // Enable logging to debug
            
            if (data.type === 'progress') {
              console.log('[LeagueDivider] Setting progress data:', data);
              setProgressData(data);
              
              // Set timeout to auto-clear progress if no completion message received
              setTimeout(() => {
                if (data.function_name === 'parse_league_teams' && data.percentage >= 90) {
                  console.log('[LeagueDivider] Auto-clearing progress after timeout');
                  setProgressData(null);
                }
              }, 10000); // 10 seconds timeout
            } else if (data.status === 'completed' || data.status === 'error') {
              console.log('[LeagueDivider] Completion/Error message received, clearing progress data');
              setProgressData(null);
              
              if (data.function_name === 'add_teams') { // Check if it's from the add_teams operation
                setLoadingTeamsFromTransfermarkt(false); // This operation is initiated by "Add Teams from Transfermarkt"
                console.log('[LeagueDivider] Teams addition completed via WebSocket, refreshing league teams data...');
                fetchLeagueTeamsData(); // Refresh the current league's teams
                
                if (onDataRefresh) { // Notify parent page (ProjectLeaguesPage)
                  onDataRefresh();
                }
              } else if (data.function_name === 'parse_league_teams') { // Check if it's from parsing teams
                console.log('[LeagueDivider] Transfermarkt team parsing completed via WebSocket');
                setLoadingTeamsFromTransfermarkt(false); // Force clear loading state
                // Note: setLoadingTeamsFromTransfermarkt(false) is already handled in the fetchTransfermarktTeams finally block
              }
            } else if (data.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
          } catch (error) {
            console.error('[LeagueDivider] Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log('[LeagueDivider] WebSocket disconnected', event.code, event.reason);
          setWsConnected(false);
          setProgressData(null);
          isConnecting = false;
          
          if (isOpen && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            const delay = Math.min(5000, 1000 * Math.pow(2, reconnectAttemptsRef.current - 1));
            console.log(`[LeagueDivider] WebSocket reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms`);
            reconnectTimeout = setTimeout(() => { if (isOpen) connectWebSocket(); }, delay);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.log('[LeagueDivider] Max WebSocket reconnection attempts reached');
          }
        };

        ws.onerror = (error) => {
          console.error('[LeagueDivider] WebSocket error:', error);
          setWsConnected(false);
          isConnecting = false;
        };
      } catch (error) {
        console.error('[LeagueDivider] Error creating WebSocket:', error);
        isConnecting = false;
      }
    };

    const initialTimeout = setTimeout(connectWebSocket, 100);
    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectAttemptsRef.current = 0;
      if (wsRef.current) {
        wsRef.current.close(1000, 'LeagueDivider component unmounting');
        wsRef.current = null;
      }
      setWsConnected(false);
      setProgressData(null);
      isConnecting = false;
    };
  }, [isOpen, fetchLeagueTeamsData, onDataRefresh]); // Added fetchLeagueTeamsData and onDataRefresh to dependencies

  // Fetch teams when drawer opens or league changes
  React.useEffect(() => {
    if (isOpen && league) {
      fetchLeagueTeamsData();
    }
  }, [isOpen, league?.leagueid, projectId, fetchLeagueTeamsData]); // Use league.leagueid for more precise trigger and added fetchLeagueTeamsData

  // Fetch Transfermarkt data when drawer opens
  React.useEffect(() => {
    if (!isOpen || !league || league.iswomencompetition === "1") return;

    const fetchTransfermarktData = async () => {
      setLoadingTransfermarkt(true);
      
      try {
        // Use the new mapped endpoint with FIFA country ID
        const response = await fetch(
          `http://localhost:8000/leagues/transfermarkt-mapped?country_id=${league.countryid}&tier=${league.level}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setTransfermarktLeagues(data.leagues || []);
          
          // Store last update info if available
          if (data.last_updated) {
            setLastUpdateInfo({
              timestamp: data.last_updated.timestamp,
              date: data.last_updated.date
            });
          }
          
          // Log mapping info for debugging
          if (data.transfermarkt_country) {
            console.log(`Mapped FIFA country ID ${league.countryid} to Transfermarkt country: ${data.transfermarkt_country}`);
          } else if (data.message) {
            console.log(data.message);
          }
        }
      } catch (error) {
        console.error("Error fetching Transfermarkt data:", error);
      } finally {
        setLoadingTransfermarkt(false);
      }
    };

    fetchTransfermarktData();
  }, [isOpen, league?.leagueid, league?.level, league?.countryid]);

  const handleAddTeamsFromTransfermarkt = async () => {
    if (!transfermarktLeagues.length || !transfermarktLeagues[0].competition_url) {
      console.error("No Transfermarkt league data available");
      return;
    }

    setLoadingTeamsFromTransfermarkt(true);
    
    try {
      const leagueUrl = transfermarktLeagues[0].competition_url;
      console.log("Fetching teams from Transfermarkt league:", leagueUrl);
      
      const response = await fetch("http://localhost:8000/transfermarkt/parse_league_teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ league_url: leagueUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Teams data from Transfermarkt:", data);
        
        if (data.status === "success" && data.teams) {
          console.log(`Found ${data.teams_count} teams:`, data.teams);
          setTransfermarktTeams(data.teams);
          
          // Manually clear progress since server completion message is not coming through
          console.log('[LeagueDivider] HTTP request completed successfully, clearing progress manually');
          setProgressData(null);
        } else {
          console.error("Failed to parse teams:", data);
          // Also clear progress on failure
          setProgressData(null);
        }
      } else {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        setProgressData(null); // Clear progress on error response
      }
    } catch (error) {
      console.error("Error fetching teams from Transfermarkt:", error);
      setProgressData(null); // Clear progress on exception
    } finally {
      setLoadingTeamsFromTransfermarkt(false);
      // Ensure progress is cleared no matter what
      setTimeout(() => setProgressData(null), 100);
    }
  };

  // Function to extract team ID from Transfermarkt URL
  const extractTeamIdFromUrl = (url: string): string | null => {
    // Extract team ID from URL like: https://www.transfermarkt.com/fc-arsenal/startseite/verein/11
    const match = url.match(/\/verein\/(\d+)/);
    return match ? match[1] : null;
  };

  // Memoized team matches
  const teamMatches = React.useMemo(() => {
    if (transfermarktTeams.length === 0 || Object.keys(gameTeams).length === 0) {
      return {};
    }
    
    const matches: { [teamId: string]: Team | null } = {};
    
    transfermarktTeams.forEach(tmTeam => {
      // Check for manual match first
      if (manualMatches[tmTeam.team_id]) {
        matches[tmTeam.team_id] = manualMatches[tmTeam.team_id];
        return;
      }

      // Try to match using teamlinks_from_tm.json data only
      let matchedTeam: Team | null = null;
      
      // First, try to find exact match by Transfermarkt URL
      for (const [gameTeamId, teamLink] of Object.entries(teamlinksFromTm)) {
        if (teamLink.transfermarkt_url === tmTeam.team_url) {
          const gameTeam = gameTeams[gameTeamId];
          if (gameTeam) {
            matchedTeam = gameTeam;
            break;
          }
        }
      }
      
      // If no exact URL match, try to match by team ID extracted from URL
      if (!matchedTeam && tmTeam.team_url) {
        const tmTeamIdFromUrl = extractTeamIdFromUrl(tmTeam.team_url);
        if (tmTeamIdFromUrl) {
          for (const [gameTeamId, teamLink] of Object.entries(teamlinksFromTm)) {
            const gameTeamIdFromUrl = extractTeamIdFromUrl(teamLink.transfermarkt_url);
            if (gameTeamIdFromUrl === tmTeamIdFromUrl) {
              const gameTeam = gameTeams[gameTeamId];
              if (gameTeam) {
                matchedTeam = gameTeam;
                break;
              }
            }
          }
        }
      }
      
      // No automatic name-based matching - only URL matches and manual matches
      matches[tmTeam.team_id] = matchedTeam;
    });
    
    return matches;
  }, [transfermarktTeams, gameTeams, manualMatches, teamlinksFromTm]);

  // Memoized match count
  const matchedCount = React.useMemo(() => {
    return Object.values(teamMatches).filter(Boolean).length;
  }, [teamMatches]);

  // Function to remove manual match
  const removeManualMatch = (tmTeamId: string) => {
    setManualMatches(prev => {
      const newMatches = { ...prev };
      delete newMatches[tmTeamId];
      return newMatches;
    });
  };

  // Get already matched team IDs
  const matchedTeamIds = React.useMemo(() => {
    return new Set(Object.values(teamMatches).filter(Boolean).map(team => team!.teamid));
  }, [teamMatches]);

  // Filter game teams for current league
  const filteredGameTeams = React.useMemo(() => {
    return teams.map(teamId => teamsData[teamId]).filter(Boolean);
  }, [teams, teamsData]);

  // Get available teams for selection
  const getAvailableTeamsForSelection = (currentMatchTeamId?: string) => {
    return filteredGameTeams.filter(team => 
      !matchedTeamIds.has(team.teamid) || team.teamid === currentMatchTeamId
    );
  };

  // Memoize filtered transfermarkt teams
  const filteredTransfermarktTeams = React.useMemo(() => {
    let filtered = transfermarktTeams;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = transfermarktTeams.filter(team => 
        team.teamname.toLowerCase().includes(query)
      );
    }
    // Limit to 50 teams for performance
    return filtered.slice(0, 50);
  }, [transfermarktTeams, searchQuery]);

  // Get matched and unmatched teams
  const matchedTeams = React.useMemo(() => {
    return filteredTransfermarktTeams.filter(team => teamMatches[team.team_id]);
  }, [filteredTransfermarktTeams, teamMatches]);

  const unmatchedTeams = React.useMemo(() => {
    return filteredTransfermarktTeams.filter(team => !teamMatches[team.team_id]);
  }, [filteredTransfermarktTeams, teamMatches]);

  // Handle team selection
  const handleTeamSelection = (teamId: string, isSelected: boolean) => {
    const team = filteredTransfermarktTeams.find(t => t.team_id === teamId);
    if (!team) return;

    const isMatched = !!teamMatches[teamId];

    if (selectionMode === "update" && isMatched) {
      setSelectedForUpdate(prev => {
        const newSet = new Set(prev);
        if (isSelected) {
          newSet.add(teamId);
        } else {
          newSet.delete(teamId);
        }
        return newSet;
      });
    } else if (selectionMode === "export" && !isMatched) {
      setSelectedForExport(prev => {
        const newSet = new Set(prev);
        if (isSelected) {
          newSet.add(teamId);
        } else {
          newSet.delete(teamId);
        }
        return newSet;
      });
    }
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedForUpdate(new Set());
    setSelectedForExport(new Set());
    setSelectionMode("none");
    setIsGrouped(false);
  };

  // Toggle grouping
  const toggleGrouping = () => {
    setIsGrouped(!isGrouped);
  };

  // Auto-group when entering selection mode
  React.useEffect(() => {
    if (selectionMode !== "none") {
      setIsGrouped(true);
    }
  }, [selectionMode]);

  // Get selected teams for export
  const getSelectedTeamsForExport = () => {
    return filteredTransfermarktTeams.filter(team => selectedForExport.has(team.team_id));
  };

  // Handle successful team addition FROM AddTeams.tsx MODAL
  const handleTeamsAdded = React.useCallback(() => {
    clearAllSelections();
    console.log('[LeagueDivider] AddTeams.tsx modal completed. Triggering refresh.');
    fetchLeagueTeamsData(); // Refresh this component's team list
    
    if (onDataRefresh) { // Notify parent (ProjectLeaguesPage)
      onDataRefresh();
    }
  }, [fetchLeagueTeamsData, onDataRefresh]); // Added dependencies

  if (!league) return null;

  const getCountryName = (countryId: string): string => {
    const nation = nations[countryId];
    return nation ? nation.nationname : `Country ${countryId}`;
  };

  const getLeagueLogoUrl = (leagueId: string): string => {
    return `http://localhost:8000/images/leagues/${leagueId}`;
  };

  const getCountryFlagUrl = (countryId: string): string => {
    return `http://localhost:8000/images/flags/${countryId}`;
  };

  const getTeamLogoUrl = (teamId: string): string => {
    return `http://localhost:8000/images/teams/${teamId}`;
  };

  const getLastUpdateInfo = (timestamp: number) => {
    const updateDate = new Date(timestamp * 1000);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - updateDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let timeText = "";
    if (diffDays === 1) {
      timeText = "сегодня";
    } else if (diffDays === 2) {
      timeText = "вчера";
    } else {
      timeText = `${diffDays - 1} дней назад`;
    }
    
    return {
      date: updateDate.toLocaleDateString('ru-RU'),
      timeText: timeText
    };
  };

  const getLeagueType = (league: League): string => {
    if (league.isinternationalleague === "1") return "International";
    if (league.countryid === "225") return "Continental";
    if (league.countryid === "211") return "Special";
    if (league.countryid === "0") return "System";
    return "National";
  };

  const getLeagueGender = (league: League): "men" | "women" => {
    return league.iswomencompetition === "1" ? "women" : "men";
  };

  const hasSpecialFeatures = (league: League): boolean => {
    return league.iscompetitionscarfenabled === "1" || 
           league.isbannerenabled === "1" || 
           league.iscompetitionpoleflagenabled === "1" ||
           league.iscompetitioncrowdcardsenabled === "1";
  };

  const getLevelColor = (level: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const levelNum = parseInt(level);
    if (levelNum === 1) return "success";
    if (levelNum === 2) return "primary"; 
    if (levelNum === 3) return "warning";
    if (levelNum >= 4) return "secondary";
    return "default";
  };

  // Function to get match type for display
  const getMatchType = (tmTeam: TransfermarktTeam): "url" | "manual" | "none" => {
    const match = teamMatches[tmTeam.team_id];
    if (!match) return "none";
    
    if (manualMatches[tmTeam.team_id]) return "manual";
    
    // Check if it was matched via URL
    for (const [gameTeamId, teamLink] of Object.entries(teamlinksFromTm)) {
      if (teamLink.transfermarkt_url === tmTeam.team_url && gameTeamId === match.teamid) {
        return "url";
      }
      
      const tmTeamIdFromUrl = extractTeamIdFromUrl(tmTeam.team_url);
      const gameTeamIdFromUrl = extractTeamIdFromUrl(teamLink.transfermarkt_url);
      if (tmTeamIdFromUrl && gameTeamIdFromUrl === tmTeamIdFromUrl && gameTeamId === match.teamid) {
        return "url";
      }
    }
    
    return "none";
  };

  return (
    <>
      <Drawer 
        isOpen={isOpen} 
        onClose={onClose}
        size="5xl"
        placement="right"
        backdrop="blur"
        classNames={{
          base: "bg-gradient-to-br from-white via-default-50 to-primary-50/20 dark:from-default-100 dark:via-default-50 dark:to-primary-100/10",
          backdrop: "bg-black/50 backdrop-blur-md",
          header: "border-b border-default-200/60 bg-white/90 dark:bg-default-100/90 backdrop-blur-xl shadow-sm",
          body: "bg-transparent",
          footer: "border-t border-default-200/60 bg-white/90 dark:bg-default-100/90 backdrop-blur-xl shadow-sm",
        }}
      >
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-4 pb-6">
            {/* League Header */}
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Image
                    src={getLeagueLogoUrl(league.leagueid)}
                    alt={`${league.leaguename} logo`}
                    className="w-16 h-16 object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-300"
                    fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E"
                  />
                  <div className="absolute -top-1 -right-1 group-hover:scale-110 transition-transform duration-300 z-10">
                    <img 
                      src={getCountryFlagUrl(league.countryid)}
                      alt={`Flag of ${getCountryName(league.countryid)}`}
                      className="w-6 h-4 object-cover rounded border-2 border-white shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-default-900 bg-gradient-to-r from-default-900 to-primary-700 bg-clip-text text-transparent">
                    {league.leaguename}
                  </h1>
                  {/* Transfermarkt Info */}
                  {transfermarktLeagues.length > 0 && league.iswomencompetition !== "1" && (
                    <Tooltip
                      content={
                        <div className="p-3 max-w-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Image
                              src="/transfermarkt_logo.png"
                              alt="Transfermarkt"
                              className="w-5 h-5 object-contain"
                            />
                            <Image
                              src={transfermarktLeagues[0].competition_logo_url}
                              alt={transfermarktLeagues[0].competition}
                              className="w-5 h-5 object-contain"
                            />
                            <span className="font-semibold text-primary-700">Real League Data</span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-default-600">League:</span>
                              <span className="font-medium">{transfermarktLeagues[0].competition}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-default-600">Clubs:</span>
                              <span className="font-medium">{transfermarktLeagues[0].clubs}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-default-600">Average Value:</span>
                              <span className="font-medium">{transfermarktLeagues[0].average_market_value}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-default-600">Total Value:</span>
                              <span className="font-medium">{transfermarktLeagues[0].total_value}</span>
                            </div>
                            {lastUpdateInfo && (
                              <div className="flex justify-between pt-1 border-t border-default-200">
                                <span className="text-default-600">Updated:</span>
                                <div className="text-right">
                                  <div className="font-medium">{getLastUpdateInfo(lastUpdateInfo.timestamp).timeText}</div>
                                  <div className="text-xs text-default-500">{getLastUpdateInfo(lastUpdateInfo.timestamp).date}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      }
                      placement="bottom"
                      delay={500}
                      closeDelay={100}
                      showArrow
                      color="primary"
                    >
                      <Image
                        src="/transfermarkt_logo.png"
                        alt="Transfermarkt Real Data"
                        className="w-6 h-6 object-contain cursor-pointer hover:scale-110 transition-transform duration-200"
                      />
                    </Tooltip>
                  )}
                </div>
                
                {/* Main Info Grid */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Chip 
                    color="primary" 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon="lucide:map-pin" className="h-3 w-3" />}
                  >
                    {getCountryName(league.countryid)}
                  </Chip>
                  <Chip 
                    color="secondary" 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon="lucide:layers" className="h-3 w-3" />}
                  >
                    Division {league.level}
                  </Chip>
                  <Chip 
                    color="success" 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon="lucide:users" className="h-3 w-3" />}
                  >
                    {teamCount} teams
                  </Chip>
                  <Chip 
                    color="warning" 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon="lucide:hash" className="h-3 w-3" />}
                  >
                    ID: {league.leagueid}
                  </Chip>
                  <Chip 
                    color="default" 
                    variant="bordered" 
                    size="sm"
                    startContent={<Icon icon="lucide:settings" className="h-3 w-3" />}
                  >
                    Type: {league.leaguetype}
                  </Chip>
                  <Chip 
                    color="default" 
                    variant="bordered" 
                    size="sm"
                    startContent={<Icon icon="lucide:clock" className="h-3 w-3" />}
                  >
                    Time Slice: {league.leaguetimeslice}
                  </Chip>
                  <Chip 
                    color={getLeagueType(league) === "International" ? "secondary" : 
                           getLeagueType(league) === "Continental" ? "warning" :
                           getLeagueType(league) === "Special" ? "danger" : "primary"} 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon="lucide:globe" className="h-3 w-3" />}
                  >
                    {getLeagueType(league)}
                  </Chip>
                  <Chip 
                    color={getLeagueGender(league) === "women" ? "secondary" : "default"} 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon={getLeagueGender(league) === "women" ? "lucide:user-x" : "lucide:user"} className="h-3 w-3" />}
                  >
                    {getLeagueGender(league) === "women" ? "Women's League" : "Men's League"}
                  </Chip>
                  <Chip 
                    color={league.iswithintransferwindow === "1" ? "success" : "danger"} 
                    variant="flat" 
                    size="sm"
                    startContent={<Icon icon={league.iswithintransferwindow === "1" ? "lucide:unlock" : "lucide:lock"} className="h-3 w-3" />}
                  >
                    Transfer {league.iswithintransferwindow === "1" ? "Open" : "Closed"}
                  </Chip>
                  {hasSpecialFeatures(league) && (
                    <Chip 
                      color="warning" 
                      variant="flat" 
                      size="sm"
                      startContent={<Icon icon="lucide:star" className="h-3 w-3" />}
                    >
                      Enhanced Features
                    </Chip>
                  )}
                  
                  {/* Enhanced Features Details */}
                  {hasSpecialFeatures(league) && (
                    <>
                      {league.iscompetitionscarfenabled === "1" && (
                        <Chip color="warning" variant="flat" size="sm" className="text-xs">Scarfs</Chip>
                      )}
                      {league.isbannerenabled === "1" && (
                        <Chip color="warning" variant="flat" size="sm" className="text-xs">Banners</Chip>
                      )}
                      {league.iscompetitionpoleflagenabled === "1" && (
                        <Chip color="warning" variant="flat" size="sm" className="text-xs">Flags</Chip>
                      )}
                      {league.iscompetitioncrowdcardsenabled === "1" && (
                        <Chip color="warning" variant="flat" size="sm" className="text-xs">Cards</Chip>
                      )}
                    </>
                  )}
                </div>
                
                
                {loadingTransfermarkt && (
                  <div className="mb-4">
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50">
                      <CardBody className="p-3">
                        <div className="flex items-center gap-3 text-blue-600">
                          <Spinner size="sm" className="w-4 h-4" />
                          <span className="text-sm animate-pulse">Loading real league data...</span>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </DrawerHeader>
          
          <DrawerBody className="gap-6 py-6">
            {/* Teams Section - Full Width */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-default-900 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg">
                    <Icon icon="lucide:users" className="h-6 w-6 text-primary-700" />
                  </div>
                  <span>Teams ({teams.length})</span>
                  {teams.length > 0 && (
                    <Chip 
                      color="primary" 
                      variant="flat" 
                      size="sm"
                      className="animate-pulse"
                    >
                      Active
                    </Chip>
                  )}
                </h3>
                <div className="flex gap-3">
                  <Dropdown backdrop="blur">
                    <DropdownTrigger>
                      <Button 
                        color="secondary" 
                        size="sm" 
                        variant="flat"
                        startContent={<Icon icon="lucide:download" className="h-4 w-4" />}
                      >
                        Export
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu 
                      aria-label="Export actions"
                      variant="flat"
                      className="min-w-[200px]"
                    >
                      <DropdownItem 
                        key="export-csv"
                        startContent={<Icon icon="lucide:file-text" className="h-4 w-4" />}
                        textValue="Export as CSV"
                      >
                        Export as CSV
                      </DropdownItem>
                      <DropdownItem 
                        key="export-json"
                        startContent={<Icon icon="lucide:code" className="h-4 w-4" />}
                        textValue="Export as JSON"
                      >
                        Export as JSON
                      </DropdownItem>
                      <DropdownItem 
                        key="export-teams"
                        startContent={<Icon icon="lucide:users" className="h-4 w-4" />}
                        textValue="Export Teams List"
                      >
                        Export Teams List
                      </DropdownItem>
                      <DropdownItem 
                        key="add-team-manual"
                        startContent={<Icon icon="lucide:user-plus" className="h-4 w-4" />}
                        textValue="Add Team Manually"
                      >
                        Add Team Manually
                      </DropdownItem>
                      <DropdownItem 
                        key="add-transfermarkt-teams"
                        startContent={
                          loadingTeamsFromTransfermarkt ? (
                            <Spinner size="sm" className="w-4 h-4" />
                          ) : (
                            <Image
                              src="/transfermarkt_logo.png"
                              alt="Transfermarkt"
                              className="w-4 h-4 object-contain"
                              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%232563eb' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E"
                            />
                          )
                        }
                        isDisabled={transfermarktLeagues.length === 0 || loadingTeamsFromTransfermarkt || league.iswomencompetition === "1"}
                        className={transfermarktLeagues.length === 0 || loadingTeamsFromTransfermarkt || league.iswomencompetition === "1" ? "opacity-50" : ""}
                        onPress={handleAddTeamsFromTransfermarkt}
                        textValue={loadingTeamsFromTransfermarkt ? "Loading teams..." : "Add Teams from Transfermarkt"}
                      >
                        {loadingTeamsFromTransfermarkt ? "Loading teams..." : "Add Teams from Transfermarkt"}
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                  <Dropdown backdrop="blur">
                    <DropdownTrigger>
                      <Button 
                        color="primary" 
                        size="sm" 
                        startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}
                      >
                        Add Team
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu 
                      aria-label="Add team actions"
                      variant="flat"
                      className="min-w-[220px]"
                    >
                      <DropdownItem 
                        key="add-team-manual"
                        startContent={<Icon icon="lucide:user-plus" className="h-4 w-4" />}
                        textValue="Add Team Manually"
                      >
                        Add Team Manually
                      </DropdownItem>
                      <DropdownItem 
                        key="add-transfermarkt-teams"
                        startContent={
                          loadingTeamsFromTransfermarkt ? (
                            <Spinner size="sm" className="w-4 h-4" />
                          ) : (
                            <Image
                              src="/transfermarkt_logo.png"
                              alt="Transfermarkt"
                              className="w-4 h-4 object-contain"
                              fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%232563eb' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E"
                            />
                          )
                        }
                        isDisabled={transfermarktLeagues.length === 0 || loadingTeamsFromTransfermarkt || league.iswomencompetition === "1"}
                        className={transfermarktLeagues.length === 0 || loadingTeamsFromTransfermarkt || league.iswomencompetition === "1" ? "opacity-50" : ""}
                        onPress={handleAddTeamsFromTransfermarkt}
                        textValue={loadingTeamsFromTransfermarkt ? "Loading teams..." : "Add Teams from Transfermarkt"}
                      >
                        {loadingTeamsFromTransfermarkt ? "Loading teams..." : "Add Teams from Transfermarkt"}
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>

              {/* Mode Information Cards - Now using tooltips on buttons instead */}

              {/* Progress Display */}
              {(loadingTeamsFromTransfermarkt || progressData) && (
                <div className="space-y-4">
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 shadow-lg">
                    <CardBody className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Spinner size="md" color="primary" />
                            <div className="absolute inset-0 animate-ping">
                              <Spinner size="md" color="primary" className="opacity-20" />
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-blue-900">
                              {progressData?.message || "Loading teams from Transfermarkt..."}
                            </h4>
                            {progressData?.details && (
                              <p className="text-sm text-blue-700">{progressData.details}</p>
                            )}
                            {progressData && (
                              <div className="flex items-center gap-2 mt-2">
                                <Chip color="primary" variant="flat" size="sm">
                                  {progressData.current || 0} / {progressData.total || 0}
                                </Chip>
                                {progressData.percentage !== undefined && (
                                  <Chip color="success" variant="flat" size="sm">
                                    {Math.round(progressData.percentage)}%
                                  </Chip>
                                )}
                                <div className="flex items-center gap-1 text-xs text-blue-600">
                                  <Icon icon="lucide:wifi" className={`h-3 w-3 ${wsConnected ? 'text-green-500' : 'text-red-500'}`} />
                                  <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {progressData?.percentage !== undefined && (
                          <div className="flex-1 max-w-xs">
                            <div className="w-full bg-blue-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, progressData.percentage))}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </div>
              )}

              {/* Transfermarkt Teams Section */}
              {transfermarktTeams.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Image
                        src="/transfermarkt_logo.png"
                        alt="Transfermarkt"
                        className="w-6 h-6 object-contain"
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%232563eb' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E"
                      />
                      <span className="text-lg font-semibold">
                        Teams from Transfermarkt ({transfermarktTeams.length})
                      </span>
                      <Chip color="warning" variant="flat" size="sm">
                        Available to Add
                      </Chip>
                      {matchedCount > 0 && (
                        <Chip color="success" variant="flat" size="sm" startContent={<Icon icon="lucide:check-circle" className="h-3 w-3" />}>
                          {matchedCount} Matched
                        </Chip>
                      )}
                      {selectedTransfermarktTeams.size > 0 && (
                        <Chip color="primary" variant="flat" size="sm" startContent={<Icon icon="lucide:users" className="h-3 w-3" />}>
                          {selectedTransfermarktTeams.size} Selected
                        </Chip>
                      )}
                    </div>
                  </div>

                  {/* Selection Mode Controls */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tooltip
                          content={
                            <div className="p-2 max-w-xs">
                              <div className="font-semibold text-primary-700 mb-1">Update Mode</div>
                              <div className="text-sm text-default-600 mb-2">
                                Update existing teams in your game with fresh data from Transfermarkt. Only teams that are already matched can be updated.
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                                <span>Available for update</span>
                                <div className="w-2 h-2 rounded-full bg-default-300 ml-2"></div>
                                <span>Not available</span>
                              </div>
                            </div>
                          }
                          placement="bottom"
                          delay={500}
                          closeDelay={100}
                          showArrow
                          color="primary"
                        >
                          <Button
                            size="sm"
                            color={selectionMode === "update" ? "primary" : "default"}
                            variant={selectionMode === "update" ? "solid" : "flat"}
                            startContent={<Icon icon="lucide:refresh-cw" className="h-4 w-4" />}
                            onPress={() => {
                              if (selectionMode === "update") {
                                clearAllSelections();
                              } else {
                                setSelectionMode("update");
                                setSelectedForExport(new Set());
                              }
                            }}
                            isDisabled={matchedTeams.length === 0}
                            className={selectionMode === "update" ? "shadow-lg" : ""}
                          >
                            Update Mode ({matchedTeams.length})
                          </Button>
                        </Tooltip>
                        
                        <Tooltip
                          content={
                            <div className="p-2 max-w-xs">
                              <div className="font-semibold text-success-700 mb-1">Export Mode</div>
                              <div className="text-sm text-default-600 mb-2">
                                Export new teams to your game. Only teams that don't have matches yet can be exported as new teams.
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full bg-success-500"></div>
                                <span>Available for export</span>
                                <div className="w-2 h-2 rounded-full bg-default-300 ml-2"></div>
                                <span>Not available</span>
                              </div>
                            </div>
                          }
                          placement="bottom"
                          delay={500}
                          closeDelay={100}
                          showArrow
                          color="success"
                        >
                          <Button
                            size="sm"
                            color={selectionMode === "export" ? "success" : "default"}
                            variant={selectionMode === "export" ? "solid" : "flat"}
                            startContent={<Icon icon="lucide:download" className="h-4 w-4" />}
                            onPress={() => {
                              if (selectionMode === "export") {
                                clearAllSelections();
                              } else {
                                setSelectionMode("export");
                                setSelectedForUpdate(new Set());
                              }
                            }}
                            isDisabled={unmatchedTeams.length === 0}
                            className={selectionMode === "export" ? "shadow-lg" : ""}
                          >
                            Export Mode ({unmatchedTeams.length})
                          </Button>
                        </Tooltip>

                        {/* Bulk Selection Buttons */}
                        {selectionMode !== "none" && (
                          <>
                            <div className="w-px h-6 bg-default-300 mx-1"></div>
                            <Button
                              size="sm"
                              color="default"
                              variant="flat"
                              startContent={<Icon icon="lucide:check-square" className="h-4 w-4" />}
                              onPress={() => {
                                if (selectionMode === "update") {
                                  setSelectedForUpdate(new Set(matchedTeams.map(team => team.team_id)));
                                } else if (selectionMode === "export") {
                                  setSelectedForExport(new Set(unmatchedTeams.map(team => team.team_id)));
                                }
                              }}
                            >
                              Select All
                            </Button>
                            
                            <Button
                              size="sm"
                              color="default"
                              variant="flat"
                              startContent={<Icon icon="lucide:square" className="h-4 w-4" />}
                              onPress={() => {
                                if (selectionMode === "update") {
                                  setSelectedForUpdate(new Set());
                                } else if (selectionMode === "export") {
                                  setSelectedForExport(new Set());
                                }
                              }}
                            >
                              Clear All
                            </Button>
                          </>
                        )}

                        {/* Grouping Toggle */}
                        {transfermarktTeams.length > 0 && (matchedTeams.length > 0 && unmatchedTeams.length > 0) && (
                          <>
                            <div className="w-px h-6 bg-default-300 mx-1"></div>
                            <Button
                              size="sm"
                              color={isGrouped ? "secondary" : "default"}
                              variant={isGrouped ? "solid" : "flat"}
                              startContent={<Icon icon={isGrouped ? "lucide:layers" : "lucide:grid-3x3"} className="h-4 w-4" />}
                              onPress={toggleGrouping}
                              className={isGrouped ? "shadow-lg" : ""}
                            >
                              {isGrouped ? "Grouped" : "Group"}
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {selectionMode !== "none" && (
                        <div className="flex items-center gap-2">
                          {selectionMode === "update" && selectedForUpdate.size > 0 && (
                            <Button
                              size="sm"
                              color="primary"
                              variant="solid"
                              startContent={<Icon icon="lucide:refresh-cw" className="h-4 w-4" />}
                              className="shadow-lg animate-pulse"
                            >
                              Update Selected ({selectedForUpdate.size})
                            </Button>
                          )}
                          
                          {selectionMode === "export" && selectedForExport.size > 0 && (
                            <Button
                              size="sm"
                              color="success"
                              variant="solid"
                              startContent={<Icon icon="lucide:download" className="h-4 w-4" />}
                              className="shadow-lg animate-pulse"
                              onPress={() => setIsAddTeamsModalOpen(true)}
                            >
                              Export Selected ({selectedForExport.size})
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            startContent={<Icon icon="lucide:x" className="h-4 w-4" />}
                            onPress={clearAllSelections}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      {/* Manual Match Clear Button */}
                      {Object.keys(manualMatches).length > 0 && selectionMode === "none" && (
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          startContent={<Icon icon="lucide:x" className="h-4 w-4" />}
                          onPress={() => setManualMatches({})}
                        >
                          Clear Manual ({Object.keys(manualMatches).length})
                        </Button>
                      )}
                    </div>

                    {/* Selection Progress Bar */}
                    {selectionMode !== "none" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {selectionMode === "update" ? "Teams to Update" : "Teams to Export"}
                          </span>
                          <span className="text-default-500">
                            {selectionMode === "update" 
                              ? `${selectedForUpdate.size} of ${matchedTeams.length} selected`
                              : `${selectedForExport.size} of ${unmatchedTeams.length} selected`
                            }
                          </span>
                        </div>
                        <div className="w-full bg-default-200 rounded-full h-2">
                          <div 
                            className={`
                              h-2 rounded-full transition-all duration-500 ease-out
                              ${selectionMode === "update" 
                                ? "bg-gradient-to-r from-primary-400 to-primary-600" 
                                : "bg-gradient-to-r from-success-400 to-success-600"
                              }
                            `}
                            style={{ 
                              width: `${selectionMode === "update" 
                                ? (selectedForUpdate.size / Math.max(matchedTeams.length, 1)) * 100
                                : (selectedForExport.size / Math.max(unmatchedTeams.length, 1)) * 100
                              }%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  

                  {/* Teams Grid with Logos */}
                  {isGrouped ? (
                    /* Grouped View */
                    <div className="space-y-6 animate-in fade-in duration-500">
                      {/* Export Mode: Show Unmatched Teams first */}
                      {selectionMode === "export" && (
                        <>
                          {/* Unmatched Teams Group (For Export) */}
                          {unmatchedTeams.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 pb-2 border-b border-warning-200">
                                <div className="p-2 bg-warning-100 rounded-lg">
                                  <Icon icon="lucide:plus-circle" className="h-5 w-5 text-warning-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-warning-700">Unmatched Teams</h3>
                                  <p className="text-sm text-warning-600">
                                    {unmatchedTeams.length} teams available for export
                                    {selectedForExport.size > 0 && ` • ${selectedForExport.size} selected`}
                                  </p>
                                </div>
                                <div className="ml-auto">
                                  <Chip 
                                    color="success" 
                                    variant="flat" 
                                    size="sm"
                                    className="animate-pulse"
                                  >
                                    Export Mode
                                  </Chip>
                                </div>
                              </div>
                              <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3">
                                {unmatchedTeams.map((tmTeam, index) => (
                                  <TeamCard 
                                    key={tmTeam.team_id}
                                    tmTeam={tmTeam}
                                    index={index}
                                    isMatched={false}
                                    selectionMode={selectionMode}
                                    selectedForUpdate={selectedForUpdate}
                                    selectedForExport={selectedForExport}
                                    handleTeamSelection={handleTeamSelection}
                                    teamMatches={teamMatches}
                                    getMatchType={getMatchType}
                                    getTeamLogoUrl={getTeamLogoUrl}
                                    setLinkTeamModal={setLinkTeamModal}
                                    removeManualMatch={removeManualMatch}
                                    animationDelay={index * 30}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Matched Teams Group (Inactive in Export Mode) */}
                          {matchedTeams.length > 0 && (
                            <div className="space-y-3 opacity-40">
                              <div className="flex items-center gap-3 pb-2 border-b border-default-200">
                                <div className="p-2 bg-default-100 rounded-lg">
                                  <Icon icon="lucide:check-circle" className="h-5 w-5 text-default-500" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-default-500">Matched Teams</h3>
                                  <p className="text-sm text-default-400">
                                    {matchedTeams.length} teams (not available for export)
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3">
                                {matchedTeams.map((tmTeam, index) => (
                                  <TeamCard 
                                    key={tmTeam.team_id}
                                    tmTeam={tmTeam}
                                    index={index + unmatchedTeams.length}
                                    isMatched={true}
                                    selectionMode="none"
                                    selectedForUpdate={selectedForUpdate}
                                    selectedForExport={selectedForExport}
                                    handleTeamSelection={handleTeamSelection}
                                    teamMatches={teamMatches}
                                    getMatchType={getMatchType}
                                    getTeamLogoUrl={getTeamLogoUrl}
                                    setLinkTeamModal={setLinkTeamModal}
                                    removeManualMatch={removeManualMatch}
                                    animationDelay={(index + unmatchedTeams.length) * 30}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Update Mode: Show Matched Teams first */}
                      {selectionMode === "update" && (
                        <>
                          {/* Matched Teams Group (For Update) */}
                          {matchedTeams.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 pb-2 border-b border-success-200">
                                <div className="p-2 bg-success-100 rounded-lg">
                                  <Icon icon="lucide:check-circle" className="h-5 w-5 text-success-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-success-700">Matched Teams</h3>
                                  <p className="text-sm text-success-600">
                                    {matchedTeams.length} teams available for update
                                    {selectedForUpdate.size > 0 && ` • ${selectedForUpdate.size} selected`}
                                  </p>
                                </div>
                                <div className="ml-auto">
                                  <Chip 
                                    color="primary" 
                                    variant="flat" 
                                    size="sm"
                                    className="animate-pulse"
                                  >
                                    Update Mode
                                  </Chip>
                                </div>
                              </div>
                              <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3">
                                {matchedTeams.map((tmTeam, index) => (
                                  <TeamCard 
                                    key={tmTeam.team_id}
                                    tmTeam={tmTeam}
                                    index={index}
                                    isMatched={true}
                                    selectionMode={selectionMode}
                                    selectedForUpdate={selectedForUpdate}
                                    selectedForExport={selectedForExport}
                                    handleTeamSelection={handleTeamSelection}
                                    teamMatches={teamMatches}
                                    getMatchType={getMatchType}
                                    getTeamLogoUrl={getTeamLogoUrl}
                                    setLinkTeamModal={setLinkTeamModal}
                                    removeManualMatch={removeManualMatch}
                                    animationDelay={index * 30}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unmatched Teams Group (Inactive in Update Mode) */}
                          {unmatchedTeams.length > 0 && (
                            <div className="space-y-3 opacity-40">
                              <div className="flex items-center gap-3 pb-2 border-b border-default-200">
                                <div className="p-2 bg-default-100 rounded-lg">
                                  <Icon icon="lucide:plus-circle" className="h-5 w-5 text-default-500" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-default-500">Unmatched Teams</h3>
                                  <p className="text-sm text-default-400">
                                    {unmatchedTeams.length} teams (not available for update)
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3">
                                {unmatchedTeams.map((tmTeam, index) => (
                                  <TeamCard 
                                    key={tmTeam.team_id}
                                    tmTeam={tmTeam}
                                    index={index + matchedTeams.length}
                                    isMatched={false}
                                    selectionMode="none"
                                    selectedForUpdate={selectedForUpdate}
                                    selectedForExport={selectedForExport}
                                    handleTeamSelection={handleTeamSelection}
                                    teamMatches={teamMatches}
                                    getMatchType={getMatchType}
                                    getTeamLogoUrl={getTeamLogoUrl}
                                    setLinkTeamModal={setLinkTeamModal}
                                    removeManualMatch={removeManualMatch}
                                    animationDelay={(index + matchedTeams.length) * 30}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* None Mode: Show both groups normally */}
                      {selectionMode === "none" && (
                        <>
                          {/* Matched Teams Group */}
                          {matchedTeams.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 pb-2 border-b border-success-200">
                                <div className="p-2 bg-success-100 rounded-lg">
                                  <Icon icon="lucide:check-circle" className="h-5 w-5 text-success-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-success-700">Matched Teams</h3>
                                  <p className="text-sm text-success-600">
                                    {matchedTeams.length} teams matched with game teams
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3">
                                {matchedTeams.map((tmTeam, index) => (
                                  <TeamCard 
                                    key={tmTeam.team_id}
                                    tmTeam={tmTeam}
                                    index={index}
                                    isMatched={true}
                                    selectionMode={selectionMode}
                                    selectedForUpdate={selectedForUpdate}
                                    selectedForExport={selectedForExport}
                                    handleTeamSelection={handleTeamSelection}
                                    teamMatches={teamMatches}
                                    getMatchType={getMatchType}
                                    getTeamLogoUrl={getTeamLogoUrl}
                                    setLinkTeamModal={setLinkTeamModal}
                                    removeManualMatch={removeManualMatch}
                                    animationDelay={index * 30}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unmatched Teams Group */}
                          {unmatchedTeams.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 pb-2 border-b border-warning-200">
                                <div className="p-2 bg-warning-100 rounded-lg">
                                  <Icon icon="lucide:plus-circle" className="h-5 w-5 text-warning-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-warning-700">Unmatched Teams</h3>
                                  <p className="text-sm text-warning-600">
                                    {unmatchedTeams.length} teams not yet matched
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3">
                                {unmatchedTeams.map((tmTeam, index) => (
                                  <TeamCard 
                                    key={tmTeam.team_id}
                                    tmTeam={tmTeam}
                                    index={index + matchedTeams.length}
                                    isMatched={false}
                                    selectionMode={selectionMode}
                                    selectedForUpdate={selectedForUpdate}
                                    selectedForExport={selectedForExport}
                                    handleTeamSelection={handleTeamSelection}
                                    teamMatches={teamMatches}
                                    getMatchType={getMatchType}
                                    getTeamLogoUrl={getTeamLogoUrl}
                                    setLinkTeamModal={setLinkTeamModal}
                                    removeManualMatch={removeManualMatch}
                                    animationDelay={(index + matchedTeams.length) * 30}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    /* Ungrouped View */
                    <div className="grid grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-16 gap-3 animate-in fade-in duration-500">
                      {filteredTransfermarktTeams.map((tmTeam, index) => (
                        <TeamCard 
                          key={tmTeam.team_id}
                          tmTeam={tmTeam}
                          index={index}
                          isMatched={!!teamMatches[tmTeam.team_id]}
                          selectionMode={selectionMode}
                          selectedForUpdate={selectedForUpdate}
                          selectedForExport={selectedForExport}
                          handleTeamSelection={handleTeamSelection}
                          teamMatches={teamMatches}
                          getMatchType={getMatchType}
                          getTeamLogoUrl={getTeamLogoUrl}
                          setLinkTeamModal={setLinkTeamModal}
                          removeManualMatch={removeManualMatch}
                          animationDelay={index * 30}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Teams Count Info */}
                  {transfermarktTeams.length > 0 && (
                    <div className="flex items-center justify-between text-sm text-default-500 pt-4 border-t border-default-200">
                      <span>
                        {isGrouped ? (
                          `Showing ${matchedTeams.length + unmatchedTeams.length} teams in 2 groups`
                        ) : (
                          `Showing ${filteredTransfermarktTeams.length} of ${transfermarktTeams.length} teams`
                        )}
                        {searchQuery && ` (filtered by "${searchQuery}")`}
                      </span>
                      <div className="flex items-center gap-4">
                        {selectionMode === "none" ? (
                          <>
                            <span className="text-success">Matched: {matchedCount}</span>
                            <span className="text-secondary">Manual: {Object.keys(manualMatches).length}</span>
                            <span className="text-default-400">Unmatched: {filteredTransfermarktTeams.length - matchedCount}</span>
                          </>
                        ) : (
                          <>
                            {selectionMode === "update" && (
                              <>
                                <span className="text-primary">Available for Update: {matchedTeams.length}</span>
                                <span className="text-primary font-medium">Selected: {selectedForUpdate.size}</span>
                              </>
                            )}
                            {selectionMode === "export" && (
                              <>
                                <span className="text-success">Available for Export: {unmatchedTeams.length}</span>
                                <span className="text-success font-medium">Selected: {selectedForExport.size}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {loadingTeams ? (
                <Card className="p-12 bg-white/70 dark:bg-default-100/70 backdrop-blur-md border border-default-200/50 shadow-xl">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <Spinner size="lg" color="primary" />
                      <div className="absolute inset-0 animate-ping">
                        <Spinner size="lg" color="primary" className="opacity-20" />
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="font-semibold text-default-700 text-lg mb-2">Loading Teams</h4>
                      <p className="text-sm text-default-500">Please wait while we fetch team data...</p>
                      <div className="flex justify-center gap-1 mt-3">
                        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : teams.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {teams.map((teamId, index) => {
                    const team = teamsData[teamId];
                    return (
                      <Card 
                        key={teamId}
                        isPressable
                        className="group p-3 bg-white/80 dark:bg-default-100/80 backdrop-blur-md border border-default-200/50 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.03] hover:border-primary-300 hover:bg-white/90 dark:hover:bg-default-100/90"
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animation: 'fadeInUp 0.5s ease-out forwards'
                        }}
                      >
                        <div className="space-y-3">
                          {/* Team Header */}
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-gradient-to-br from-primary/10 via-secondary/5 to-primary/5 rounded-xl flex items-center justify-center border border-default-200/30 shadow-sm group-hover:shadow-lg group-hover:scale-105 transition-all duration-300 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <Image
                                src={getTeamLogoUrl(teamId)}
                                alt={`${team?.teamname || 'Team'} logo`}
                                className="w-11 h-11 object-contain relative z-10"
                                fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236366f1' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'/%3E%3C/svg%3E"
                              />
                            </div>
                            
                            <div className="text-center w-full">
                              <h4 className="font-semibold text-sm text-default-900 truncate group-hover:text-primary-600 transition-colors duration-300">
                                {team?.teamname || `Team ${index + 1}`}
                              </h4>
                              <p className="text-xs text-default-500 font-mono truncate">#{teamId}</p>
                            </div>
                          </div>
                          
                          {team && (
                            <>
                              {/* Overall Rating */}
                              {team.overallrating && (
                                <div className="text-center">
                                  <Chip 
                                    color={parseInt(team.overallrating) >= 85 ? "success" : 
                                           parseInt(team.overallrating) >= 75 ? "warning" : 
                                           parseInt(team.overallrating) >= 65 ? "primary" : "default"} 
                                    variant="flat" 
                                    size="sm"
                                    className="font-bold text-xs group-hover:scale-105 transition-transform duration-200"
                                  >
                                    {team.overallrating} OVR
                                  </Chip>
                                </div>
                              )}
                              
                              {/* Compact Ratings */}
                              <div className="grid grid-cols-3 gap-1">
                                <div className="text-center p-1.5 rounded-lg bg-gradient-to-br from-red-50 to-red-100 border border-red-200/50 group-hover:shadow-sm transition-shadow duration-200">
                                  <p className="text-red-600 font-bold text-xs">{team.attackrating}</p>
                                  <p className="text-red-700 text-xs font-medium">ATT</p>
                                </div>
                                <div className="text-center p-1.5 rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200/50 group-hover:shadow-sm transition-shadow duration-200">
                                  <p className="text-yellow-600 font-bold text-xs">{team.midfieldrating}</p>
                                  <p className="text-yellow-700 text-xs font-medium">MID</p>
                                </div>
                                <div className="text-center p-1.5 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/50 group-hover:shadow-sm transition-shadow duration-200">
                                  <p className="text-blue-600 font-bold text-xs">{team.defenserating}</p>
                                  <p className="text-blue-700 text-xs font-medium">DEF</p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon icon="lucide:users" className="h-8 w-8 text-default-400" />
                  </div>
                  <h4 className="text-lg font-medium text-default-600 mb-2">No Teams Found</h4>
                  <p className="text-sm text-default-500 mb-6">This league doesn't have any teams assigned yet.</p>
                  <Button 
                    color="primary" 
                    variant="flat"
                    size="sm"
                    startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}
                  >
                    Add First Team
                  </Button>
                </div>
              )}
            </div>
          </DrawerBody>
          
          <DrawerFooter className="gap-2 pt-3 pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button 
                  color="danger" 
                  variant="light" 
                  onPress={onClose}
                  size="sm"
                  startContent={<Icon icon="lucide:x" className="h-4 w-4" />}
                >
                  Close
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  color="warning" 
                  variant="flat"
                  size="sm"
                  startContent={<Icon icon="lucide:settings" className="h-4 w-4" />}
                >
                  Settings
                </Button>
                <Button 
                  color="primary" 
                  size="sm"
                  startContent={<Icon icon="lucide:edit" className="h-4 w-4" />}
                  className="px-4"
                >
                  Edit League
                </Button>
              </div>
            </div>
            
            {/* League Stats Summary */}
            <div className="w-full pt-0">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="space-y-0.5">
                  <p className="text-xs text-default-500 uppercase tracking-wide">Teams</p>
                  <p className="text-sm font-bold text-primary-600">{teamCount}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-default-500 uppercase tracking-wide">Division</p>
                  <p className="text-sm font-bold text-secondary-600">{league.level}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-default-500 uppercase tracking-wide">Type</p>
                  <p className="text-sm font-bold text-warning-600">{league.leaguetype}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-default-500 uppercase tracking-wide">Status</p>
                  <Chip 
                    color={league.iswithintransferwindow === "1" ? "success" : "danger"} 
                    variant="flat" 
                    size="sm"
                    className="text-xs font-bold"
                  >
                    {league.iswithintransferwindow === "1" ? "Active" : "Closed"}
                  </Chip>
                </div>
              </div>
            </div>

            {/* Manual Match Controls */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {Object.keys(manualMatches).length > 0 && (
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    startContent={<Icon icon="lucide:x" className="h-4 w-4" />}
                    onPress={() => setManualMatches({})}
                  >
                    Clear Manual ({Object.keys(manualMatches).length})
                  </Button>
                )}
                {selectedTransfermarktTeams.size > 0 && (
                  <Button
                    size="sm"
                    color="primary"
                    variant="solid"
                    startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}
                  >
                    Add Selected ({selectedTransfermarktTeams.size})
                  </Button>
                )}
              </div>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Link Team Modal */}
      <Modal 
        isOpen={linkTeamModal.isOpen} 
        onClose={() => setLinkTeamModal({ isOpen: false, team: null })}
        size="3xl"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-3">
              {linkTeamModal.team && (
                <>
                  <Image
                    src={linkTeamModal.team.teamlogo}
                    alt={linkTeamModal.team.teamname}
                    className="w-8 h-8 object-contain"
                  />
                  <span className="text-xl font-bold">Link {linkTeamModal.team.teamname}</span>
                </>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            {linkTeamModal.team && (
              <div className="space-y-4">
                <p className="text-default-600">
                  Select a game team to link with <strong>{linkTeamModal.team.teamname}</strong>:
                </p>
                
                <Select
                  placeholder="Select a game team..."
                  aria-label={`Select game team for ${linkTeamModal.team.teamname}`}
                  size="lg"
                  variant="bordered"
                  selectedKeys={teamMatches[linkTeamModal.team.team_id] ? [teamMatches[linkTeamModal.team.team_id]!.teamid] : []}
                  onSelectionChange={(keys) => {
                    const selectedKey = Array.from(keys)[0] as string;
                    if (selectedKey) {
                      const selectedTeam = getAvailableTeamsForSelection().find(t => t.teamid === selectedKey);
                      if (selectedTeam) {
                        setManualMatches(prev => ({
                          ...prev,
                          [linkTeamModal.team!.team_id]: selectedTeam
                        }));
                      }
                    }
                  }}
                  className="w-full"
                  disableAnimation
                >
                  {getAvailableTeamsForSelection(teamMatches[linkTeamModal.team.team_id]?.teamid).map((gameTeam) => (
                    <SelectItem 
                      key={gameTeam.teamid} 
                      textValue={`${gameTeam.teamname} ${gameTeam.overallrating ? `(${gameTeam.overallrating})` : ''}`}
                      startContent={
                        <Image
                          src={getTeamLogoUrl(gameTeam.teamid)}
                          alt={gameTeam.teamname}
                          className="w-6 h-6 object-contain"
                        />
                      }
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{gameTeam.teamname}</span>
                        {gameTeam.overallrating && (
                          <Chip color="primary" variant="flat" size="sm">
                            OVR {gameTeam.overallrating}
                          </Chip>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </Select>
                
                {teamMatches[linkTeamModal.team.team_id] && (
                  <Card className="bg-success-50 border border-success-200">
                    <CardBody className="p-4">
                      <div className="flex items-center gap-3">
                        <Icon icon="lucide:check-circle" className="h-5 w-5 text-success" />
                        <span className="font-medium text-success">Successfully linked!</span>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button 
              color="danger" 
              variant="light" 
              onPress={() => setLinkTeamModal({ isOpen: false, team: null })}
            >
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={() => setLinkTeamModal({ isOpen: false, team: null })}
            >
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Teams Modal */}
      <AddTeams
        isOpen={isAddTeamsModalOpen}
        onClose={() => setIsAddTeamsModalOpen(false)}
        selectedTeams={getSelectedTeamsForExport()}
        projectId={projectId}
        leagueId={league?.leagueid || ""}
        onTeamsAdded={handleTeamsAdded} // This now correctly triggers local and parent refresh
      />
    </>
  );
}); 