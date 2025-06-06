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
} from "@heroui/react";
import { Icon } from "@iconify/react";
import TeamDivider from "../components/TeamDivider";
import { TeamFilters } from "../components/TeamFilters";

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
  // Additional fields from teams.json
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

interface Nation {
  nationid: string;
  nationname: string;
  isocountrycode: string;
}

interface ProjectTeamsPageProps {
  projectId?: string;
}

const ProjectTeamsPage: React.FC<ProjectTeamsPageProps> = ({ projectId }) => {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [playerCounts, setPlayerCounts] = React.useState<{ [teamId: string]: number }>({});
  const [selectedTeam, setSelectedTeam] = React.useState<Team | null>(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = React.useState(false);
  const [loadingPlayerCounts, setLoadingPlayerCounts] = React.useState(false);
  const [teamLeagues, setTeamLeagues] = React.useState<{ [teamId: string]: { id: string; name: string; countryId: string } }>({});
  const [loadingLeagues, setLoadingLeagues] = React.useState(false);
  const [restOfWorldTeams, setRestOfWorldTeams] = React.useState<{ [teamId: string]: string }>({});
  const [nations, setNations] = React.useState<{ [nationId: string]: Nation }>({});
  
  // Filter states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedLeague, setSelectedLeague] = React.useState("");
  const [selectedCountry, setSelectedCountry] = React.useState("");
  const [ratingRange, setRatingRange] = React.useState<[number, number]>([0, 100]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const teamsPerPage = 20;

  // Ref to track if we're already fetching data
  const isFetching = React.useRef(false);
  const playerCountsFetched = React.useRef(false);
  const leaguesFetched = React.useRef(false);

  // Helper functions - declared before useMemo to avoid initialization errors
  const getTeamLogoUrl = (teamId: string): string => {
    return `http://localhost:8000/images/teams/${teamId}`;
  };

  const getCountryFlagUrl = (countryId: string): string => {
    return `http://localhost:8000/images/flags/${countryId}`;
  };

  const getLeagueLogoUrl = (leagueId: string): string => {
    return `http://localhost:8000/images/leagues/${leagueId}`;
  };

  const getCountryName = (countryId: string): string => {
    return nations[countryId]?.nationname || `Country ${countryId}`;
  };

  const getPlayersCount = (team: Team): number => {
    return playerCounts[team.teamid] || 0;
  };

  const getTeamLeague = (team: Team): string => {
    return teamLeagues[team.teamid]?.name || "Unknown League";
  };

  const getTeamLeagueId = (team: Team): string => {
    return teamLeagues[team.teamid]?.id || "";
  };

  const getTeamLeagueCountryId = (team: Team): string => {
    return teamLeagues[team.teamid]?.countryId || "";
  };

  const getTeamCountryId = (team: Team): string => {
    const leagueId = getTeamLeagueId(team);
    // Special leagues that use team's actual country instead of league country
    const specialLeagues = ["76", "1003", "1014"]; // Rest of World, CONMEBOL Libertadores, CONMEBOL Sudamericana
    
    if (specialLeagues.includes(leagueId)) {
      return restOfWorldTeams[team.teamid] || team.countryid;
    }
    
    return getTeamLeagueCountryId(team);
  };

  // Team colors helper functions
  const getTeamColor = (team: Team, colorNumber: 1 | 2 | 3): string => {
    const r = parseInt(team[`teamcolor${colorNumber}r`] || "255");
    const g = parseInt(team[`teamcolor${colorNumber}g`] || "255");
    const b = parseInt(team[`teamcolor${colorNumber}b`] || "255");
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getTeamColorsGradient = (team: Team): string => {
    const color1 = getTeamColor(team, 1);
    const color2 = getTeamColor(team, 2);
    const color3 = getTeamColor(team, 3);
    return `linear-gradient(135deg, ${color1} 0%, ${color2} 50%, ${color3} 100%)`;
  };

  const getTeamColorsPalette = (team: Team): React.ReactNode => {
    return (
      <div className="flex gap-1">
        <div 
          className="w-3 h-3 rounded-full border border-white/50 shadow-sm"
          style={{ backgroundColor: getTeamColor(team, 1) }}
          title="Primary Color"
        />
        <div 
          className="w-3 h-3 rounded-full border border-white/50 shadow-sm"
          style={{ backgroundColor: getTeamColor(team, 2) }}
          title="Secondary Color"
        />
        <div 
          className="w-3 h-3 rounded-full border border-white/50 shadow-sm"
          style={{ backgroundColor: getTeamColor(team, 3) }}
          title="Accent Color"
        />
      </div>
    );
  };

  // Helper function to convert RGB to HEX
  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // Helper function to create transparent color
  const getTeamColorHex = (team: Team, colorNumber: 1 | 2 | 3): string => {
    const r = parseInt(team[`teamcolor${colorNumber}r`] || "255");
    const g = parseInt(team[`teamcolor${colorNumber}g`] || "255");
    const b = parseInt(team[`teamcolor${colorNumber}b`] || "255");
    return rgbToHex(r, g, b);
  };

  const getTeamColorWithOpacity = (team: Team, colorNumber: 1 | 2 | 3, opacity: number): string => {
    const r = parseInt(team[`teamcolor${colorNumber}r`] || "255");
    const g = parseInt(team[`teamcolor${colorNumber}g`] || "255");
    const b = parseInt(team[`teamcolor${colorNumber}b`] || "255");
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Filter teams based on all criteria
  const filteredTeams = React.useMemo(() => {
    return teams.filter((team) => {
      // Search by team name
      if (searchTerm && !team.teamname.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Filter by league
      if (selectedLeague && getTeamLeagueId(team) !== selectedLeague) {
        return false;
      }

      // Filter by country
      if (selectedCountry && getTeamCountryId(team) !== selectedCountry) {
        return false;
      }

      // Filter by rating range
      const rating = parseInt(team.overallrating);
      if (rating < ratingRange[0] || rating > ratingRange[1]) {
        return false;
      }

      return true;
    });
  }, [teams, searchTerm, selectedLeague, selectedCountry, ratingRange, teamLeagues, restOfWorldTeams]);

  // Get unique leagues and countries for filter options
  const availableLeagues = React.useMemo(() => {
    const leagueSet = new Set<string>();
    const leagues: Array<{ id: string; name: string }> = [];
    
    Object.values(teamLeagues).forEach((league) => {
      if (!leagueSet.has(league.id)) {
        leagueSet.add(league.id);
        leagues.push({ id: league.id, name: league.name });
      }
    });
    
    return leagues.sort((a, b) => a.name.localeCompare(b.name));
  }, [teamLeagues]);

  const availableCountries = React.useMemo(() => {
    const countrySet = new Set<string>();
    const countries: Array<{ id: string; name: string }> = [];
    
    teams.forEach((team) => {
      const countryId = getTeamCountryId(team);
      if (countryId && !countrySet.has(countryId)) {
        countrySet.add(countryId);
        countries.push({ id: countryId, name: getCountryName(countryId) });
      }
    });
    
    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, teamLeagues, restOfWorldTeams]);

  // Pagination calculations for filtered teams
  const totalPages = Math.ceil(filteredTeams.length / teamsPerPage);
  const startIndex = (currentPage - 1) * teamsPerPage;
  const endIndex = startIndex + teamsPerPage;
  const currentTeams = filteredTeams.slice(startIndex, endIndex);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedLeague, selectedCountry, ratingRange]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedLeague("");
    setSelectedCountry("");
    setRatingRange([0, 100]);
  };

  // Load teams first (fast)
  React.useEffect(() => {
    if (isFetching.current) return;

    const fetchTeams = async () => {
      if (isFetching.current) return;
      
      isFetching.current = true;
      try {
        setLoading(true);
        
        const teamsUrl = projectId ? 
          `http://localhost:8000/teams?project_id=${projectId}` : 
          "http://localhost:8000/teams";


        const teamsResponse = await fetch(teamsUrl);

        if (teamsResponse.ok) {
          const teamsData = await teamsResponse.json();
          setTeams(teamsData);
        } else {
          console.error("Failed to fetch teams data");
        }
      } catch (error) {
        console.error("Error fetching teams:", error);
      } finally {
        setLoading(false);
        isFetching.current = false;
      }
    };

    fetchTeams();
  }, [projectId]);

  // Load nations data
  React.useEffect(() => {
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
        } else {
          console.error("Failed to fetch nations:", nationsResponse.status, nationsResponse.statusText);
        }
      } catch (error) {
        console.error("Error fetching nations:", error);
      }
    };

    fetchNations();
  }, [projectId]);

  // Load player counts after teams are loaded (lazy loading)
  React.useEffect(() => {
    if (teams.length === 0 || loadingPlayerCounts || playerCountsFetched.current) return;

    const fetchPlayerCounts = async () => {
      setLoadingPlayerCounts(true);
      playerCountsFetched.current = true;
      
      try {
        const teamPlayerLinksUrl = projectId ? 
          `http://localhost:8000/teamplayerlinks?project_id=${projectId}` : 
          "http://localhost:8000/teamplayerlinks";


        const teamPlayerLinksResponse = await fetch(teamPlayerLinksUrl);

        if (teamPlayerLinksResponse.ok) {
          const teamPlayerLinksData = await teamPlayerLinksResponse.json();
          
          // Calculate player counts per team
          const playerCountsMap: { [teamId: string]: number } = {};
          teamPlayerLinksData.forEach((link: any) => {
            const teamId = link.teamid;
            if (!playerCountsMap[teamId]) {
              playerCountsMap[teamId] = 0;
            }
            playerCountsMap[teamId]++;
          });
          
          setPlayerCounts(playerCountsMap);
        } else {
          console.error("Failed to fetch player counts");
        }
      } catch (error) {
        console.error("Error fetching player counts:", error);
      } finally {
        setLoadingPlayerCounts(false);
      }
    };

    // Delay loading player counts to prioritize teams loading
    const timeoutId = setTimeout(fetchPlayerCounts, 500);
    return () => clearTimeout(timeoutId);
  }, [teams.length, projectId]);

  // Load league information after teams are loaded
  React.useEffect(() => {
    if (teams.length === 0 || loadingLeagues || leaguesFetched.current) return;

    const fetchLeagueInfo = async () => {
      setLoadingLeagues(true);
      leaguesFetched.current = true;
      
      try {
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
          
          // Create team ID to league name mapping
          const teamIdToLeague: { [teamId: string]: { id: string; name: string; countryId: string } } = {};
          leagueTeamLinksData.forEach((link: any) => {
            const leagueName = leagueIdToName[link.leagueid];
            const leagueCountryId = leagueIdToCountry[link.leagueid];
            if (leagueName) {
              teamIdToLeague[link.teamid] = { 
                id: link.leagueid, 
                name: leagueName,
                countryId: leagueCountryId || ""
              };
            }
          });
          
          setTeamLeagues(teamIdToLeague);
        } else {
          console.error("Failed to fetch league information");
        }
      } catch (error) {
        console.error("Error fetching league information:", error);
      } finally {
        setLoadingLeagues(false);
      }
    };

    // Delay loading league info to prioritize teams loading
    const timeoutId = setTimeout(fetchLeagueInfo, 1000);
    return () => clearTimeout(timeoutId);
  }, [teams.length, projectId]);

  const getRatingColor = (rating: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const ratingNum = parseInt(rating);
    if (ratingNum >= 85) return "success";
    if (ratingNum >= 80) return "primary";
    if (ratingNum >= 75) return "warning";
    if (ratingNum >= 70) return "secondary";
    return "default";
  };

  const getPopularityColor = (popularity: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const popularityNum = parseInt(popularity);
    if (popularityNum >= 9) return "success";
    if (popularityNum >= 7) return "primary";
    if (popularityNum >= 5) return "warning";
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

  const getTrophyColor = (trophyCount: number): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    if (trophyCount >= 20) return "success";
    if (trophyCount >= 10) return "primary";
    if (trophyCount >= 5) return "warning";
    if (trophyCount >= 1) return "secondary";
    return "default";
  };

  const formatStadiumCapacity = (capacity: string): string => {
    const capacityNum = parseInt(capacity);
    if (capacityNum >= 1000) {
      return `${(capacityNum / 1000).toFixed(0)}K`;
    }
    return capacityNum.toString();
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

  const hasSpecialFeatures = (team: Team): boolean => {
    return team.hasYouthSystem === "1" || 
           team.hasWomensTeam === "1" || 
           team.hasReserveTeam === "1";
  };

  const getFeaturesDetails = (team: Team): React.ReactNode => {
    const totalTrophies = getTotalTrophies(team);
    return (
      <div className="space-y-3 max-w-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="font-semibold">Founded:</span>
          <span>{team.foundationyear}</span>
          
          <span className="font-semibold">League:</span>
          <span>{loadingLeagues ? "Loading..." : getTeamLeague(team)}</span>
          
          <span className="font-semibold">Overall Rating:</span>
          <span className="font-bold">{team.overallrating}</span>
          
          <span className="font-semibold">Attack:</span>
          <span>{team.attackrating}</span>
          
          <span className="font-semibold">Midfield:</span>
          <span>{team.midfieldrating}</span>
          
          <span className="font-semibold">Defense:</span>
          <span>{team.defenserating}</span>
          
          <span className="font-semibold">Popularity:</span>
          <span>{team.popularity}/10</span>
          
          <span className="font-semibold">Stadium:</span>
          <span>{formatStadiumCapacity(team.teamstadiumcapacity)} capacity</span>
          
          <span className="font-semibold">Club Worth:</span>
          <span>€{formatBudget(team.clubworth || team.club_worth)}</span>
        </div>
        
        <div className="pt-2 border-t border-default-200">
          <p className="font-semibold text-xs mb-2">Trophies ({totalTrophies}):</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>League: {team.leaguetitles}</span>
            <span>Cups: {team.domesticcups}</span>
            <span>Champions League: {team.uefa_cl_wins}</span>
            <span>Europa League: {team.uefa_el_wins}</span>
            {parseInt(team.uefa_uecl_wins) > 0 && (
              <span>Conference League: {team.uefa_uecl_wins}</span>
            )}
          </div>
        </div>
        
        <div className="pt-2 border-t border-default-200">
          <p className="font-semibold text-xs mb-1">Features:</p>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <span>Youth System: {team.hasYouthSystem === "1" ? "✅" : "❌"}</span>
            <span>Women's Team: {team.hasWomensTeam === "1" ? "✅" : "❌"}</span>
            <span>Reserve Team: {team.hasReserveTeam === "1" ? "✅" : "❌"}</span>
          </div>
        </div>
      </div>
    );
  };

  const handleTeamClick = (team: Team) => {
    setSelectedTeam(team);
    setIsTeamModalOpen(true);
  };

  const handleCloseTeamModal = () => {
    setIsTeamModalOpen(false);
    setSelectedTeam(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="pt-5 px-2">
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" label="Loading teams..." />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-5 px-2">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-lg font-semibold">Team Management</h3>
          <p className="text-sm text-default-500">
            {filteredTeams.length} teams • Page {currentPage} of {totalPages}
          </p>
        </div>
        <Button color="success" startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}>
          Add Team
        </Button>
      </div>
      
      <TeamFilters
        key="team-filters"
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedLeague={selectedLeague}
        onLeagueChange={setSelectedLeague}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        ratingRange={ratingRange}
        onRatingRangeChange={(value) => setRatingRange(value as [number, number])}
        onClearFilters={handleClearFilters}
        leagues={availableLeagues}
        countries={availableCountries}
        totalTeams={teams.length}
        filteredTeams={filteredTeams.length}
      />
      
      <Table aria-label="Teams table">
        <TableHeader>
          <TableColumn>Team</TableColumn>
          <TableColumn>League</TableColumn>
          <TableColumn>Colors</TableColumn>
          <TableColumn>Overall Rating</TableColumn>
          <TableColumn>Popularity</TableColumn>
          <TableColumn>Players</TableColumn>
          <TableColumn>Trophies</TableColumn>
          <TableColumn>Features</TableColumn>
        </TableHeader>
        <TableBody>
          {currentTeams.map((team) => (
            <TableRow 
              key={team.teamid}
              className="cursor-pointer transition-all duration-300 group hover:shadow-md"
              onClick={() => handleTeamClick(team)}
              style={{
                '--team-color-1': getTeamColor(team, 1),
                '--team-color-2': getTeamColor(team, 2),
                '--team-color-3': getTeamColor(team, 3),
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                const row = e.currentTarget;
                const color1 = getTeamColorWithOpacity(team, 1, 0.18);
                const color2 = getTeamColorWithOpacity(team, 2, 0.12);
                const color3 = getTeamColorWithOpacity(team, 3, 0.18);
                const borderColor = getTeamColorWithOpacity(team, 1, 0.3);
                
                row.style.setProperty('background', `linear-gradient(90deg, ${color1} 0%, ${color2} 50%, ${color3} 100%)`, 'important');
                row.style.setProperty('box-shadow', `inset 0 0 0 1px ${borderColor}`, 'important');
              }}
              onMouseLeave={(e) => {
                const row = e.currentTarget;
                row.style.removeProperty('background');
                row.style.removeProperty('box-shadow');
              }}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Image
                    src={getTeamLogoUrl(team.teamid)}
                    alt={`${team.teamname} logo`}
                    className="w-8 h-8 object-contain"
                    fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2306d6a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'/%3E%3C/svg%3E"
                  />
                  {!loadingLeagues && getTeamCountryId(team) && (
                    <img 
                      src={getCountryFlagUrl(getTeamCountryId(team))}
                      alt={`Flag of ${getCountryName(getTeamCountryId(team))}`}
                      className="w-5 h-4 object-cover rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <Tooltip content={team.teamname} placement="top">
                      <span className="font-medium block w-48 truncate cursor-help">
                        {team.teamname}
                      </span>
                    </Tooltip>
                    <p className="text-xs text-default-500">ID: {team.teamid}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {loadingLeagues ? (
                  <Spinner size="sm" />
                ) : (
                  <Tooltip content={getTeamLeague(team)} placement="top">
                    <div className="flex justify-center cursor-help">
                      <Image
                        src={getLeagueLogoUrl(getTeamLeagueId(team))}
                        alt={`${getTeamLeague(team)} logo`}
                        className="w-6 h-6 object-contain"
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%2306d6a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'/%3E%3C/svg%3E"
                      />
                    </div>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                <Tooltip 
                  content={
                    <div className="flex flex-col gap-1 p-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getTeamColor(team, 1) }}
                        />
                        <span className="text-xs">Primary: {getTeamColor(team, 1)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getTeamColor(team, 2) }}
                        />
                        <span className="text-xs">Secondary: {getTeamColor(team, 2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getTeamColor(team, 3) }}
                        />
                        <span className="text-xs">Accent: {getTeamColor(team, 3)}</span>
                      </div>
                    </div>
                  }
                  placement="top"
                >
                  <div className="cursor-help">
                    {getTeamColorsPalette(team)}
                  </div>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Chip
                  color={getRatingColor(team.overallrating)}
                  variant="flat"
                  size="sm"
                >
                  {team.overallrating}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip
                  color={getPopularityColor(team.popularity)}
                  variant="flat"
                  size="sm"
                >
                  {team.popularity}/10
                </Chip>
              </TableCell>
              <TableCell>
                {loadingPlayerCounts ? (
                  <Spinner size="sm" />
                ) : (
                  getPlayersCount(team)
                )}
              </TableCell>
              <TableCell>
                <Chip
                  color={getTrophyColor(getTotalTrophies(team))}
                  variant="flat"
                  size="sm"
                >
                  {getTotalTrophies(team)}
                </Chip>
              </TableCell>
              <TableCell>
                <Tooltip content={getFeaturesDetails(team)} placement="left" className="cursor-help">
                  <div className="cursor-help">
                    {hasSpecialFeatures(team) ? (
                      <Chip color="success" variant="flat" size="sm">
                        Enhanced
                      </Chip>
                    ) : (
                      <Chip color="default" variant="flat" size="sm">
                        Basic
                      </Chip>
                    )}
                  </div>
                </Tooltip>
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
            color="success"
            aria-label="Teams table pagination"
          />
        </div>
      )}

      <TeamDivider
        team={selectedTeam}
        isOpen={isTeamModalOpen}
        onClose={handleCloseTeamModal}
        playerCount={selectedTeam ? getPlayersCount(selectedTeam) : 0}
        projectId={projectId}
      />
    </div>
  );
};

export default ProjectTeamsPage; 