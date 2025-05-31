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
  Image,
  Card,
  Spinner,
  Avatar
} from "@heroui/react";
import { Icon } from "@iconify/react";

interface Team {
  teamid: string;
  teamname: string;
  foundationyear: string;
  gender: string;
  profitability: string;
  domesticprestige: string;
  internationalprestige: string;
  transferbudget: string;
  isusertransferbudgetset: string;
  club_worth: string;
  rivalteam: string;
  league1transferbudget: string;
  league2transferbudget: string;
  youthrating: string;
  trainingfacilities: string;
  youthdevelopment: string;
  hasYouthSystem: string;
  hasWomensTeam: string;
  hasReserveTeam: string;
  countryid: string;
  overallrating: string;
  attackrating: string;
  defenserating: string;
  midfieldrating: string;
  popularity: string;
  leaguetitles: string;
  domesticcups: string;
  uefa_cl_wins: string;
  uefa_el_wins: string;
  uefa_uecl_wins: string;
  teamstadiumcapacity: string;
  captainid: string;
  penaltytakerid: string;
  form: string;
  clubworth: string;
  // Team colors
  teamcolor1r: string;
  teamcolor1g: string;
  teamcolor1b: string;
  teamcolor2r: string;
  teamcolor2g: string;
  teamcolor2b: string;
  teamcolor3r: string;
  teamcolor3g: string;
  teamcolor3b: string;
}

interface TeamDividerProps {
  team: Team | null;
  isOpen: boolean;
  onClose: () => void;
  playerCount: number;
  projectId?: string;
}

interface Player {
  playerid: string;
  playerjerseyname: string;
  firstname: string;
  lastname: string;
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
}

interface TeamPlayerLink {
  teamid: string;
  playerid: string;
}

interface Nation {
  nationid: string;
  nationname: string;
  isocountrycode: string;
}

// Position code mapping function
const getPositionName = (positionCode: string): string => {
  const positionMap: { [key: string]: string } = {
    "0": "GK",  // Goalkeeper
    "3": "RB",  // Right back
    "5": "CB",  // Center back
    "7": "LB",  // Left back
    "10": "CDM", // Defensive midfielder
    "12": "RM",  // Right midfielder
    "14": "CM",  // Central midfielder
    "16": "LM",  // Left midfielder
    "18": "CAM", // Attacking midfielder
    "23": "RW",  // Right winger
    "25": "ST",  // Striker
    "27": "LW",  // Left winger
  };
  
  return positionMap[positionCode] || positionCode;
};

// Function to group players by position category
const groupPlayersByPosition = (players: Player[]): {
  goalkeepers: Player[],
  defenders: Player[],
  midfielders: Player[],
  attackers: Player[]
} => {
  const goalkeepers: Player[] = [];
  const defenders: Player[] = [];
  const midfielders: Player[] = [];
  const attackers: Player[] = [];
  
  players.forEach(player => {
    const posCode = player.preferredposition1;
    
    if (posCode === "0") {
      goalkeepers.push(player);
    } else if (["3", "5", "7"].includes(posCode)) {
      defenders.push(player);
    } else if (["10", "12", "14", "16", "18"].includes(posCode)) {
      midfielders.push(player);
    } else if (["23", "25", "27"].includes(posCode)) {
      attackers.push(player);
    } else {
      // Default case - use midfield as fallback
      midfielders.push(player);
    }
  });
  
  return { goalkeepers, defenders, midfielders, attackers };
};

// Minimalist PlayerCard component
const PlayerCard = React.memo(({ player, team, getPlayerAvatarUrl, getTeamColor }: {
  player: Player;
  team: Team;
  getPlayerAvatarUrl: (playerId: string) => string;
  getTeamColor: (team: Team, colorNumber: 1 | 2 | 3) => string;
}) => {
  const getPlayerRatingColor = (rating: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const ratingNum = parseInt(rating);
    if (ratingNum >= 90) return "success";
    if (ratingNum >= 80) return "primary";
    if (ratingNum >= 70) return "secondary";
    return "default";
  };
  
  // Calculate more accurate positions as arrays
  const positions = [
    player.preferredposition1, 
    player.preferredposition2, 
    player.preferredposition3, 
    player.preferredposition4
  ].filter(pos => pos !== "-1");
  
  // Calculate player attributes categories
  const pace = Math.round((parseInt(player.acceleration || "0") + parseInt(player.sprintspeed || "0")) / 2);
  const shooting = Math.round((
    parseInt(player.positioning || "0") + 
    parseInt(player.finishing || "0") + 
    parseInt(player.shotpower || "0") + 
    parseInt(player.longshots || "0") + 
    parseInt(player.volleys || "0") + 
    parseInt(player.penalties || "0")
  ) / 6);
  const passing = Math.round((
    parseInt(player.vision || "0") + 
    parseInt(player.crossing || "0") + 
    parseInt(player.freekickaccuracy || "0") + 
    parseInt(player.shortpassing || "0") + 
    parseInt(player.longpassing || "0") + 
    parseInt(player.curve || "0")
  ) / 6);
  const dribbling = Math.round((
    parseInt(player.agility || "0") + 
    parseInt(player.balance || "0") + 
    parseInt(player.reactions || "0") + 
    parseInt(player.ballcontrol || "0") + 
    parseInt(player.dribbling || "0") + 
    parseInt(player.composure || "0")
  ) / 6);
  const defending = Math.round((
    parseInt(player.interceptions || "0") + 
    parseInt(player.headingaccuracy || "0") + 
    parseInt(player.defensiveawareness || "0") + 
    parseInt(player.standingtackle || "0") + 
    parseInt(player.slidingtackle || "0")
  ) / 5);
  const physical = Math.round((
    parseInt(player.jumping || "0") + 
    parseInt(player.stamina || "0") + 
    parseInt(player.strength || "0") + 
    parseInt(player.aggression || "0")
  ) / 4);

  // Define player attributes for radar chart
  let attributes: [string, number, string][] = [];
  
  // Show appropriate attributes based on position
  if (player.preferredposition1 === "0") {
    // GK attributes
    attributes = [
      ["DIV", parseInt(player.gkdiving || "0"), "Diving"],
      ["HAN", parseInt(player.gkhandling || "0"), "Handling"],
      ["KIC", parseInt(player.gkkicking || "0"), "Kicking"],
      ["REF", parseInt(player.gkreflexes || "0"), "Reflexes"],
      ["SPD", parseInt(player.gkpositioning || "0"), "Positioning"],
      ["POS", parseInt(player.positioning || "0"), "Positioning"]
    ];
  } else {
    // Outfield player attributes
    attributes = [
      ["PAC", pace, "Pace"],
      ["SHO", shooting, "Shooting"],
      ["PAS", passing, "Passing"],
      ["DRI", dribbling, "Dribbling"],
      ["DEF", defending, "Defending"],
      ["PHY", physical, "Physical"]
    ];
  }
  
  // Max value for scaling the radar chart
  const maxValue = 99;
  
  // Calculate position display with proper names
  const positionDisplay = positions.map(pos => getPositionName(pos));
  
  return (
    <Card 
      key={player.playerid}
      isPressable
      className="border border-default-100 bg-background shadow-sm hover:shadow-md transition-all duration-200"
      classNames={{
        base: "overflow-hidden",
      }}
    >
      <div className="flex p-3">
        <Avatar
          src={getPlayerAvatarUrl(player.playerid)}
          name={`${player.firstname} ${player.lastname}`}
          className="mr-3"
          size="md"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-default-900 truncate">
              {player.firstname} {player.lastname}
            </h4>
            <div className="flex gap-1">
              <Chip 
                color={getPlayerRatingColor(player.overallrating)} 
                variant="flat" 
                size="sm"
              >
                {player.overallrating}
              </Chip>
              <Chip 
                color="secondary" 
                variant="flat" 
                size="sm"
              >
                POT {player.potential}
              </Chip>
            </div>
          </div>
          
          <div className="flex items-center text-xs text-default-500 mt-1">
            <span className="font-medium">{positionDisplay[0]}</span>
            {positionDisplay.length > 1 && (
              <span className="ml-1 text-default-400">
                {positionDisplay.slice(1).join(", ")}
              </span>
            )}
            <span className="mx-1">•</span>
            <span>{player.height}cm</span>
            <span className="mx-1">•</span>
            <span>
              <Icon icon="lucide:sparkles" className="w-3 h-3 text-yellow-500 inline mr-0.5" />
              {player.skillmoves}★
            </span>
            <span className="mx-1">•</span>
            <span>
              {player.preferredfoot === "1" ? "Left" : "Right"} 
              <span className="ml-1 text-default-400">{player.weakfootabilitytypecode}★</span>
            </span>
          </div>
        </div>
        
        <Button 
          isIconOnly 
          variant="light" 
          size="sm" 
          className="ml-2"
        >
          <Icon icon="lucide:chevron-right" className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Radar/Spider Chart for Player Attributes */}
      <div className="px-3 pb-3">
        <div className="relative h-[120px] w-full">
          {/* Chart background */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[100px] h-[100px] rounded-full border border-default-200 opacity-20"></div>
            <div className="absolute w-[75px] h-[75px] rounded-full border border-default-200 opacity-20"></div>
            <div className="absolute w-[50px] h-[50px] rounded-full border border-default-200 opacity-20"></div>
            <div className="absolute w-[25px] h-[25px] rounded-full border border-default-200 opacity-20"></div>
            {/* Axis lines */}
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <div 
                key={i} 
                className="absolute w-[100px] h-[1px] bg-default-200 opacity-30"
                style={{ transform: `rotate(${deg}deg)` }}
              ></div>
            ))}
          </div>
          
          {/* Chart data polygon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="100" height="100" viewBox="-50 -50 100 100">
              <polygon
                points={attributes.map((attr, i) => {
                  const angle = (Math.PI * 2 * i) / attributes.length;
                  const value = Math.min(attr[1], maxValue) / maxValue;
                  const x = Math.sin(angle) * value * 50;
                  const y = -Math.cos(angle) * value * 50;
                  return `${x},${y}`;
                }).join(' ')}
                fill={`${getTeamColor(team, 1)}30`}
                stroke={getTeamColor(team, 1)}
                strokeWidth="1.5"
              />
            </svg>
          </div>
          
          {/* Stat labels */}
          <div className="absolute inset-0">
            {attributes.map((attr, i) => {
              const angle = (Math.PI * 2 * i) / attributes.length;
              const x = Math.sin(angle) * 50;
              const y = -Math.cos(angle) * 50;
              const labelX = Math.sin(angle) * 60;
              const labelY = -Math.cos(angle) * 60;
              
              return (
                <React.Fragment key={i}>
                  <div 
                    className="absolute w-2 h-2 bg-default-700 rounded-full"
                    style={{ 
                      left: `calc(50% + ${x}px)`, 
                      top: `calc(50% + ${y}px)`,
                      transform: 'translate(-50%, -50%)' 
                    }}
                  ></div>
                  <div 
                    className="absolute text-[10px] font-medium text-default-800"
                    style={{ 
                      left: `calc(50% + ${labelX}px)`, 
                      top: `calc(50% + ${labelY}px)`,
                      transform: 'translate(-50%, -50%)' 
                    }}
                  >
                    {attr[0]}
                    <span 
                      className="block text-[9px] text-default-600 font-normal"
                      style={{
                        backgroundColor: 
                          attr[1] >= 80 ? `${getTeamColor(team, 1)}20` : 
                          attr[1] >= 70 ? `${getTeamColor(team, 2)}20` : 
                          'transparent',
                        borderRadius: '4px',
                        padding: '0 2px'
                      }}
                    >
                      {attr[1]}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
});

PlayerCard.displayName = "PlayerCard";

// Main TeamDivider component
export default function TeamDivider({ team, isOpen, onClose, playerCount, projectId }: TeamDividerProps) {
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = React.useState(false);
  const [teamLeague, setTeamLeague] = React.useState<{ id: string; name: string; countryId: string }>({ id: "", name: "Unknown League", countryId: "" });
  const [loadingLeague, setLoadingLeague] = React.useState(false);
  const [restOfWorldTeams, setRestOfWorldTeams] = React.useState<{ [teamId: string]: string }>({});
  const [nations, setNations] = React.useState<{ [nationId: string]: Nation }>({});
  const [loadingNations, setLoadingNations] = React.useState(false);
  const [visiblePlayersCount, setVisiblePlayersCount] = React.useState(10);
  const [activeSection, setActiveSection] = React.useState<'details' | 'players' | 'stats'>('details');
  const isFetching = React.useRef(false);
  const leagueFetched = React.useRef(false);

  // Load nations data first (lightweight)
  React.useEffect(() => {
    if (!isOpen || Object.keys(nations).length > 0) return;

    const fetchNations = async () => {
      setLoadingNations(true);
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
      } finally {
        setLoadingNations(false);
      }
    };

    fetchNations();
  }, [isOpen, projectId, nations]);

  // Load league info after nations
  React.useEffect(() => {
    if (!isOpen || !team || loadingLeague || leagueFetched.current) return;
    if (Object.keys(nations).length === 0) return; // Wait for nations

    const fetchLeagueInfo = async () => {
      setLoadingLeague(true);
      leagueFetched.current = true;
      
      try {
        // Add small delay to prevent simultaneous requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const leagueTeamLinksUrl = projectId ? 
          `http://localhost:8000/leagueteamlinks?project_id=${projectId}` : 
          "http://localhost:8000/leagueteamlinks";
        
        const leaguesUrl = projectId ? 
          `http://localhost:8000/leagues?project_id=${projectId}` : 
          "http://localhost:8000/leagues";

        const [leagueTeamLinksResponse, leaguesResponse, restOfWorldResponse] = await Promise.all([
          fetch(leagueTeamLinksUrl),
          fetch(leaguesUrl),
          fetch("http://localhost:8000/db/rest_of_world_teams")
        ]);

        if (leagueTeamLinksResponse.ok && leaguesResponse.ok) {
          const leagueTeamLinksData = await leagueTeamLinksResponse.json();
          const leaguesData = await leaguesResponse.json();
          
          // Load rest of world teams data
          let restOfWorldTeamsData = [];
          if (restOfWorldResponse.ok) {
            restOfWorldTeamsData = await restOfWorldResponse.json();
          }
          
          // Create rest of world teams mapping
          const restOfWorldTeamsMap: { [teamId: string]: string } = {};
          restOfWorldTeamsData.forEach((team: any) => {
            restOfWorldTeamsMap[team.teamid.toString()] = team.countryid;
          });
          setRestOfWorldTeams(restOfWorldTeamsMap);
          
          // Create league ID to name and country mapping
          const leagueIdToName: { [leagueId: string]: string } = {};
          const leagueIdToCountry: { [leagueId: string]: string } = {};
          leaguesData.forEach((league: any) => {
            leagueIdToName[league.leagueid] = league.leaguename;
            leagueIdToCountry[league.leagueid] = league.countryid;
          });
          
          // Find the league for this team
          const teamLeagueLink = leagueTeamLinksData.find((link: any) => link.teamid === team.teamid);
          if (teamLeagueLink && leagueIdToName[teamLeagueLink.leagueid]) {
            setTeamLeague({
              id: teamLeagueLink.leagueid,
              name: leagueIdToName[teamLeagueLink.leagueid],
              countryId: leagueIdToCountry[teamLeagueLink.leagueid] || ""
            });
          }
        }
      } catch (error) {
        console.error("Error fetching league information:", error);
      } finally {
        setLoadingLeague(false);
      }
    };

    const timeoutId = setTimeout(fetchLeagueInfo, 200);
    return () => clearTimeout(timeoutId);
  }, [isOpen, team?.teamid, projectId, nations]);

  // Load players
  React.useEffect(() => {
    if (!isOpen || !team || isFetching.current) return;
    if (!teamLeague.id && loadingLeague) return; // Wait for league info

    const fetchPlayers = async () => {
      if (isFetching.current) return;
      
      isFetching.current = true;
      setLoadingPlayers(true);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const playersUrl = projectId ? 
          `http://localhost:8000/players?project_id=${projectId}&team_id=${team.teamid}&limit=30` : 
          `http://localhost:8000/players?team_id=${team.teamid}&limit=30`;

        const playersResponse = await fetch(playersUrl);
        if (playersResponse.ok) {
          const teamPlayers: Player[] = await playersResponse.json();
          setPlayers(teamPlayers);
        } else {
          setPlayers([]);
        }
      } catch (error) {
        console.error("Error fetching players:", error);
        setPlayers([]);
      } finally {
        setLoadingPlayers(false);
        isFetching.current = false;
      }
    };

    fetchPlayers();
  }, [isOpen, team?.teamid, projectId, teamLeague.id, loadingLeague]);

  // Reset state when drawer closes
  React.useEffect(() => {
    if (!isOpen) {
      isFetching.current = false;
      leagueFetched.current = false;
      setPlayers([]);
      setTeamLeague({ id: "", name: "Unknown League", countryId: "" });
      setRestOfWorldTeams({});
      setVisiblePlayersCount(10);
      setActiveSection('details');
    }
  }, [isOpen]);

  if (!team) return null;

  // Helper functions
  const getCountryName = (countryId: string): string => {
    const nation = nations[countryId];
    return nation ? nation.nationname : `Country ${countryId}`;
  };

  const getTeamLogoUrl = (teamId: string): string => {
    return `http://localhost:8000/images/teams/${teamId}`;
  };

  const getCountryFlagUrl = (countryId: string): string => {
    return `http://localhost:8000/images/flags/${countryId}`;
  };

  const getLeagueLogoUrl = (leagueId: string): string => {
    return `http://localhost:8000/images/leagues/${leagueId}`;
  };

  const getPlayerAvatarUrl = (playerId: string): string => {
    return `http://localhost:8000/images/players/${playerId}`;
  };

  const getTeamCountryId = (team: Team): string => {
    // Special leagues that use team's actual country instead of league country
    const specialLeagues = ["76", "1003", "1014"]; // Rest of World, CONMEBOL Libertadores, CONMEBOL Sudamericana
    
    if (specialLeagues.includes(teamLeague.id)) {
      return restOfWorldTeams[team.teamid] || team.countryid;
    }
    
    return teamLeague.countryId;
  };

  // Team colors helper functions
  const getTeamColor = (team: Team, colorNumber: 1 | 2 | 3): string => {
    const r = parseInt(team[`teamcolor${colorNumber}r`] || "255");
    const g = parseInt(team[`teamcolor${colorNumber}g`] || "255");
    const b = parseInt(team[`teamcolor${colorNumber}b`] || "255");
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getTeamPrimaryColor = (team: Team): string => {
    return getTeamColor(team, 1);
  };

  const formatBudget = (budget: string): string => {
    const budgetNum = parseInt(budget);
    if (budgetNum >= 1000000) {
      return `${(budgetNum / 1000000).toFixed(1)}M`;
    }
    if (budgetNum >= 1000) {
      return `${(budgetNum / 1000).toFixed(0)}K`;
    }
    return budgetNum.toString();
  };

  const formatStadiumCapacity = (capacity: string): string => {
    const capacityNum = parseInt(capacity);
    if (capacityNum >= 1000) {
      return `${(capacityNum / 1000).toFixed(0)}K`;
    }
    return capacityNum.toString();
  };

  const getRatingColor = (rating: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const ratingNum = parseInt(rating);
    if (ratingNum >= 85) return "success";
    if (ratingNum >= 75) return "primary";
    if (ratingNum >= 65) return "warning";
    return "default";
  };

  const getTotalTrophies = (team: Team): number => {
    const leagueTitles = parseInt(team.leaguetitles) || 0;
    const domesticCups = parseInt(team.domesticcups) || 0;
    const clWins = parseInt(team.uefa_cl_wins) || 0;
    const elWins = parseInt(team.uefa_el_wins) || 0;
    const ueclWins = parseInt(team.uefa_uecl_wins) || 0;
    return leagueTitles + domesticCups + clWins + elWins + ueclWins;
  };

  const handleLoadMorePlayers = () => {
    setVisiblePlayersCount(prev => Math.min(prev + 10, players.length));
  };

  const visiblePlayers = players.slice(0, visiblePlayersCount);
  const hasMorePlayers = visiblePlayersCount < players.length;

  // Section content components
  const TeamDetailsSection = () => (
    <div className="space-y-6">
      {/* Club Info */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Club Information</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Founded</div>
            <div className="text-base font-semibold">{team.foundationyear}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Stadium Capacity</div>
            <div className="text-base font-semibold">{formatStadiumCapacity(team.teamstadiumcapacity)}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Transfer Budget</div>
            <div className="text-base font-semibold">€{formatBudget(team.transferbudget)}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Club Worth</div>
            <div className="text-base font-semibold">€{formatBudget(team.clubworth)}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Rival Team</div>
            <div className="text-base font-semibold">{team.rivalteam || "None"}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Gender</div>
            <div className="text-base font-semibold">{team.gender === "0" ? "Men's Team" : "Women's Team"}</div>
          </div>
        </div>
      </div>

      {/* Stadium Info */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Stadium Details</h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Surface Type</div>
            <div className="text-sm font-semibold">{
              {
                "0": "Natural",
                "1": "Artificial",
                "2": "Hybrid"
              }[team.playsurfacetype] || "Unknown"
            }</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Pitch Color</div>
            <div className="text-sm font-semibold">{team.pitchcolor || "Standard"}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Pitch Wear</div>
            <div className="text-sm font-semibold">{team.pitchwear || "None"}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Mowing Pattern</div>
            <div className="text-sm font-semibold">{team.stadiummowpattern_code || "Standard"}</div>
          </div>
        </div>
      </div>

      {/* Team Colors */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Team Colors</h3>
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div 
              className="w-12 h-12 rounded-md border border-default-100 shadow-sm" 
              style={{ backgroundColor: getTeamColor(team, 1) }}
            ></div>
            <span className="text-xs text-default-500 mt-1">Primary</span>
            <span className="text-[10px] text-default-400">RGB: {team.teamcolor1r},{team.teamcolor1g},{team.teamcolor1b}</span>
          </div>
          <div className="flex flex-col items-center">
            <div 
              className="w-12 h-12 rounded-md border border-default-100 shadow-sm" 
              style={{ backgroundColor: getTeamColor(team, 2) }}
            ></div>
            <span className="text-xs text-default-500 mt-1">Secondary</span>
            <span className="text-[10px] text-default-400">RGB: {team.teamcolor2r},{team.teamcolor2g},{team.teamcolor2b}</span>
          </div>
          <div className="flex flex-col items-center">
            <div 
              className="w-12 h-12 rounded-md border border-default-100 shadow-sm" 
              style={{ backgroundColor: getTeamColor(team, 3) }}
            ></div>
            <span className="text-xs text-default-500 mt-1">Accent</span>
            <span className="text-[10px] text-default-400">RGB: {team.teamcolor3r},{team.teamcolor3g},{team.teamcolor3b}</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Team Features</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500 mb-1">Systems & Teams</div>
            <div className="flex flex-wrap gap-2">
              <Chip color={team.hasYouthSystem === "1" ? "success" : "default"} variant="flat" size="sm">
                Youth System
              </Chip>
              <Chip color={team.hasWomensTeam === "1" ? "success" : "default"} variant="flat" size="sm">
                Women's Team
              </Chip>
              <Chip color={team.hasReserveTeam === "1" ? "success" : "default"} variant="flat" size="sm">
                Reserve Team
              </Chip>
            </div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500 mb-1">Stadium Features</div>
            <div className="flex flex-wrap gap-2">
              <Chip color={team.hastifo === "1" ? "success" : "default"} variant="flat" size="sm">
                Tifo
              </Chip>
              <Chip color={team.haslargeflag === "1" ? "success" : "default"} variant="flat" size="sm">
                Large Flag
              </Chip>
              <Chip color={team.hasstandingcrowd === "1" ? "success" : "default"} variant="flat" size="sm">
                Standing Crowd
              </Chip>
              <Chip color={team.hasvikingclap === "1" ? "success" : "default"} variant="flat" size="sm">
                Viking Clap
              </Chip>
            </div>
          </div>
        </div>
      </div>

      {/* Facilities */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Facilities</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Training Facilities</div>
            <div className="text-base font-semibold">{team.trainingfacilities}/10</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Youth Rating</div>
            <div className="text-base font-semibold">{team.youthrating}/10</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Youth Development</div>
            <div className="text-base font-semibold">{team.youthdevelopment}/10</div>
          </div>
        </div>
      </div>
    </div>
  );

  const TeamStatsSection = () => (
    <div className="space-y-6">
      {/* Team Ratings */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Team Ratings</h3>
        <div className="grid grid-cols-6 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Overall</div>
            <div className="text-2xl font-semibold">{team.overallrating}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Attack</div>
            <div className="text-2xl font-semibold">{team.attackrating}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Midfield</div>
            <div className="text-2xl font-semibold">{team.midfieldrating}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Defense</div>
            <div className="text-2xl font-semibold">{team.defenserating}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Build-up</div>
            <div className="text-2xl font-semibold">{team.buildupplay || "-"}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Form</div>
            <div className="text-2xl font-semibold">{team.form || "-"}</div>
          </div>
        </div>
      </div>

      {/* Match Day Ratings */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Match Day Ratings</h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Overall</div>
            <div className="text-xl font-semibold">{team.matchdayoverallrating || "-"}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Attack</div>
            <div className="text-xl font-semibold">{team.matchdayattackrating || "-"}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Midfield</div>
            <div className="text-xl font-semibold">{team.matchdaymidfieldrating || "-"}</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Defense</div>
            <div className="text-xl font-semibold">{team.matchdaydefenserating || "-"}</div>
          </div>
        </div>
      </div>

      {/* Prestige */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Prestige & Popularity</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Domestic</div>
            <div className="text-lg font-semibold">{team.domesticprestige}/10</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">International</div>
            <div className="text-lg font-semibold">{team.internationalprestige}/10</div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="text-xs text-default-500">Popularity</div>
            <div className="text-lg font-semibold">{team.popularity}/10</div>
          </div>
        </div>
      </div>

      {/* Trophies */}
      <div>
        <h3 className="text-sm uppercase text-default-500 font-semibold mb-3">Trophies ({getTotalTrophies(team)} Total)</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="flex justify-between items-center">
              <div className="text-sm">League Titles</div>
              <div className="text-lg font-semibold">{team.leaguetitles}</div>
            </div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="flex justify-between items-center">
              <div className="text-sm">Domestic Cups</div>
              <div className="text-lg font-semibold">{team.domesticcups}</div>
            </div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="flex justify-between items-center">
              <div className="text-sm">UEFA CL</div>
              <div className="text-lg font-semibold">{team.uefa_cl_wins}</div>
            </div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="flex justify-between items-center">
              <div className="text-sm">UEFA EL</div>
              <div className="text-lg font-semibold">{team.uefa_el_wins}</div>
            </div>
          </div>
          <div className="p-3 rounded-md bg-gradient-to-br from-background to-content2/30 border border-default-100">
            <div className="flex justify-between items-center">
              <div className="text-sm">UEFA UECL</div>
              <div className="text-lg font-semibold">{team.uefa_uecl_wins}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Update the TeamPlayersSection to group players by position
  const TeamPlayersSection = () => {
    // Group players by position
    const { goalkeepers, defenders, midfielders, attackers } = groupPlayersByPosition(players);
    
    // Position section component
    const PositionSection = ({ title, players, icon }: { title: string, players: Player[], icon: string }) => (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon icon={icon} className="h-4 w-4 text-default-600" />
          <h4 className="text-sm uppercase text-default-600 font-medium">{title} ({players.length})</h4>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {players.map((player) => (
            <PlayerCard 
              key={player.playerid}
              player={player}
              team={team}
              getPlayerAvatarUrl={getPlayerAvatarUrl}
              getTeamColor={getTeamColor}
            />
          ))}
        </div>
        
        {players.length === 0 && (
          <div className="py-2 text-center text-sm text-default-400">
            No {title.toLowerCase()} in team
          </div>
        )}
      </div>
    );
    
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm uppercase text-default-500 font-semibold">Players ({players.length})</h3>
            {team.captainid && (
              <p className="text-xs text-default-400">Captain ID: {team.captainid}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="flat" 
              color="default"
              startContent={<Icon icon="lucide:filter" className="h-3.5 w-3.5" />}
            >
              Filter
            </Button>
            <Button 
              size="sm" 
              variant="flat" 
              color="primary" 
              startContent={<Icon icon="lucide:plus" className="h-3.5 w-3.5" />}
            >
              Add Player
            </Button>
          </div>
        </div>
        
        {loadingPlayers ? (
          <div className="flex justify-center items-center py-10">
            <Spinner size="lg" color="primary" label="Loading players..." />
          </div>
        ) : players.length === 0 ? (
          <div className="py-8 text-center text-default-400">
            <Icon icon="lucide:users" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No players found for this team</p>
          </div>
        ) : (
          <div className="space-y-8">
            <PositionSection title="Goalkeepers" players={goalkeepers} icon="lucide:hand" />
            <PositionSection title="Defenders" players={defenders} icon="lucide:shield" />
            <PositionSection title="Midfielders" players={midfielders} icon="lucide:infinity" />
            <PositionSection title="Attackers" players={attackers} icon="lucide:flame" />
          </div>
        )}
        
        {hasMorePlayers && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="flat" 
              color="default"
              size="sm"
              onPress={handleLoadMorePlayers}
            >
              Load More ({players.length - visiblePlayersCount} remaining)
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Drawer 
      isOpen={isOpen} 
      onClose={onClose}
      size="5xl" // Changed from "lg" to "5xl" for wider drawer
      placement="right"
      classNames={{
        base: "bg-background",
        header: "border-b border-default-200",
        body: "p-0",
        footer: "border-t border-default-200",
      }}
    >
      <DrawerContent>
        <DrawerHeader className="flex items-center gap-3">
          <Image
            src={getTeamLogoUrl(team.teamid)}
            alt={`${team.teamname} logo`}
            className="w-10 h-10 object-contain"
            fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2306d6a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'/%3E%3C/svg%3E"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-default-900">
              {team.teamname}
            </h2>
            <div className="flex items-center text-sm text-default-500 gap-1">
              {loadingNations ? (
                <span>Loading...</span>
              ) : (
                <>
                  <img 
                    src={getCountryFlagUrl(team.countryid)}
                    alt={`Flag of ${getCountryName(team.countryid)}`}
                    className="w-4 h-3 object-cover rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span>{getCountryName(team.countryid)}</span>
                </>
              )}
              
              {loadingLeague ? (
                <span className="ml-2">• Loading league info...</span>
              ) : teamLeague.name && (
                <>
                  <span className="mx-1">•</span>
                  <span>{teamLeague.name}</span>
                </>
              )}
            </div>
          </div>
          <Chip color={getRatingColor(team.overallrating)} variant="flat">
            OVR {team.overallrating}
          </Chip>
        </DrawerHeader>
        
        <div className="border-b border-default-200">
          <div className="flex">
            <Button 
              variant={activeSection === 'details' ? 'solid' : 'light'} 
              color={activeSection === 'details' ? 'primary' : 'default'}
              className="flex-1 rounded-none"
              onPress={() => setActiveSection('details')}
            >
              Details
            </Button>
            <Button 
              variant={activeSection === 'stats' ? 'solid' : 'light'} 
              color={activeSection === 'stats' ? 'primary' : 'default'}
              className="flex-1 rounded-none"
              onPress={() => setActiveSection('stats')}
            >
              Stats
            </Button>
            <Button 
              variant={activeSection === 'players' ? 'solid' : 'light'} 
              color={activeSection === 'players' ? 'primary' : 'default'}
              className="flex-1 rounded-none"
              onPress={() => setActiveSection('players')}
            >
              Players
            </Button>
          </div>
        </div>

        <DrawerBody className="px-4 py-4 overflow-auto">
          {activeSection === 'details' && <TeamDetailsSection />}
          {activeSection === 'stats' && <TeamStatsSection />}
          {activeSection === 'players' && <TeamPlayersSection />}
        </DrawerBody>
        
        <DrawerFooter>
          <Button 
            color="danger" 
            variant="light" 
            onPress={onClose}
          >
            Close
          </Button>
          <Button 
            color="primary" 
            startContent={<Icon icon="lucide:edit" className="h-4 w-4" />}
          >
            Edit Team
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}