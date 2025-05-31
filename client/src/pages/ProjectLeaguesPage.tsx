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
} from "@heroui/react";
import { Icon } from "@iconify/react";
import LeagueDivider from "../components/LeagueDivider";
import AddLeagueModal from "../components/AddLeagueModal";

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

interface Nation {
  nationid: string;
  nationname: string;
  isocountrycode: string;
}

interface ProjectLeaguesPageProps {
  projectId?: string;
}

// Debounce utility function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => ReturnType<F>;
}

export default function ProjectLeaguesPage({ projectId }: ProjectLeaguesPageProps) {
  const [leagues, setLeagues] = React.useState<League[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [teamCounts, setTeamCounts] = React.useState<{ [leagueId: string]: number }>({});
  const [selectedLeague, setSelectedLeague] = React.useState<League | null>(null);
  const [isLeagueModalOpen, setIsLeagueModalOpen] = React.useState(false);
  const [isAddLeagueModalOpen, setIsAddLeagueModalOpen] = React.useState(false);
  const [nations, setNations] = React.useState<{ [nationId: string]: Nation }>({});
  const [originalLeagues, setOriginalLeagues] = React.useState<Set<string>>(new Set());

  // Ref to track if we're already fetching data
  const isFetching = React.useRef(false);

  // Original refreshTeamCounts logic
  const _refreshTeamCounts = React.useCallback(async () => {
    try {
      const leagueTeamLinksUrl = projectId ? 
        `http://localhost:8000/leagueteamlinks?project_id=${projectId}` : 
        "http://localhost:8000/leagueteamlinks";

      const leagueTeamLinksResponse = await fetch(leagueTeamLinksUrl);
      
      if (leagueTeamLinksResponse.ok) {
        const leagueTeamLinksData = await leagueTeamLinksResponse.json();
        
        const teamCountsMap: { [leagueId: string]: number } = {};
        leagueTeamLinksData.forEach((link: any) => {
          const leagueId = link.leagueid;
          if (!teamCountsMap[leagueId]) {
            teamCountsMap[leagueId] = 0;
          }
          teamCountsMap[leagueId]++;
        });
        
        setTeamCounts(teamCountsMap);
        console.log("Debounced team counts refreshed:", teamCountsMap);
      }
    } catch (error) {
      console.error("Error refreshing team counts (debounced):", error);
    }
  }, [projectId]);

  // Debounced version of refreshTeamCounts
  const refreshTeamCounts = React.useMemo(
    () => debounce(_refreshTeamCounts, 500), // 500ms debounce delay
    [_refreshTeamCounts]
  );

  // Helper function to get league logo URL
  const getLeagueLogoUrl = (leagueId: string): string => {
    return `http://localhost:8000/images/leagues/${leagueId}`;
  };

  // Helper function to get country flag URL
  const getCountryFlagUrl = (countryId: string): string => {
    return `http://localhost:8000/images/flags/${countryId}`;
  };

  React.useEffect(() => {
    if (isFetching.current) return;

    const fetchData = async () => {
      if (isFetching.current) return;
      
      isFetching.current = true;
      try {
        setLoading(true);
        
        // Fetch leagues, leagueteamlinks data, and original leagues in parallel
        const leaguesUrl = projectId ? 
          `http://localhost:8000/leagues?project_id=${projectId}` : 
          "http://localhost:8000/leagues";
        
        const leagueTeamLinksUrl = projectId ? 
          `http://localhost:8000/leagueteamlinks?project_id=${projectId}` : 
          "http://localhost:8000/leagueteamlinks";

        const originalLeaguesUrl = "http://localhost:8000/leagues/original"; // Always load original file

        console.log("[DEBUG] projectId:", projectId);
        console.log("[DEBUG] leaguesUrl:", leaguesUrl);
        console.log("[DEBUG] leagueTeamLinksUrl:", leagueTeamLinksUrl);
        console.log("[DEBUG] originalLeaguesUrl:", originalLeaguesUrl);

        const [leaguesResponse, leagueTeamLinksResponse, originalLeaguesResponse] = await Promise.all([
          fetch(leaguesUrl),
          fetch(leagueTeamLinksUrl),
          fetch(originalLeaguesUrl)
        ]);

        if (leaguesResponse.ok && leagueTeamLinksResponse.ok && originalLeaguesResponse.ok) {
          const leaguesData = await leaguesResponse.json();
          const leagueTeamLinksData = await leagueTeamLinksResponse.json();
          const originalLeaguesData = await originalLeaguesResponse.json();
          
          console.log("Total leagues from API:", leaguesData.length);
          console.log("Total league-team links:", leagueTeamLinksData.length);
          console.log("Total original leagues:", originalLeaguesData.length);
          
          // Create set of original league IDs
          const originalLeagueIds = new Set<string>(originalLeaguesData.map((league: League) => league.leagueid));
          setOriginalLeagues(originalLeagueIds);
          
          // Calculate team counts per league
          const teamCountsMap: { [leagueId: string]: number } = {};
          leagueTeamLinksData.forEach((link: any) => {
            const leagueId = link.leagueid;
            if (!teamCountsMap[leagueId]) {
              teamCountsMap[leagueId] = 0;
            }
            teamCountsMap[leagueId]++;
          });
          
          console.log("Team counts per league:", teamCountsMap);
          console.log("Original league IDs:", originalLeagueIds);
          
          setLeagues(leaguesData);
          setTeamCounts(teamCountsMap);
        } else {
          console.error("Failed to fetch data");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
        isFetching.current = false;
      }
    };

    fetchData();
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
        }
      } catch (error) {
        console.error("Error fetching nations:", error);
      }
    };

    fetchNations();
  }, [projectId]);

  const getCountryName = (countryId: string): string => {
    return nations[countryId]?.nationname || `Country ${countryId}`;
  };

  const getTeamsCount = (league: League): number => {
    return teamCounts[league.leagueid] || 0;
  };

  const getLeagueGender = (league: League): "men" | "women" => {
    return league.iswomencompetition === "1" ? "women" : "men";
  };

  const getLeagueType = (league: League): string => {
    if (league.isinternationalleague === "1") return "International";
    if (league.countryid === "225") return "Continental";
    if (league.countryid === "211") return "Special";
    if (league.countryid === "0") return "System";
    return "National";
  };

  const hasSpecialFeatures = (league: League): boolean => {
    return league.iscompetitionscarfenabled === "1" || 
           league.isbannerenabled === "1" || 
           league.iscompetitionpoleflagenabled === "1" ||
           league.iscompetitioncrowdcardsenabled === "1";
  };

  const isNewlyAdded = (league: League): boolean => {
    return !originalLeagues.has(league.leagueid);
  };

  const getLevelColor = (level: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    const levelNum = parseInt(level);
    if (levelNum === 1) return "success";
    if (levelNum === 2) return "primary"; 
    if (levelNum === 3) return "warning";
    if (levelNum >= 4) return "secondary";
    return "default";
  };

  const getFeaturesDetails = (league: League): React.ReactNode => {
    return (
      <div className="space-y-2 max-w-xs">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <span className="font-semibold">League Type:</span>
          <span>{league.leaguetype}</span>
          
          <span className="font-semibold">Level:</span>
          <span>{league.level}</span>
          
          <span className="font-semibold">Time Slice:</span>
          <span>{league.leaguetimeslice}</span>
          
          <span className="font-semibold">Women League:</span>
          <span>{league.iswomencompetition === "1" ? "Yes" : "No"}</span>
          
          <span className="font-semibold">International:</span>
          <span>{league.isinternationalleague === "1" ? "Yes" : "No"}</span>
          
          <span className="font-semibold">Transfer Window:</span>
          <span>{league.iswithintransferwindow === "1" ? "Open" : "Closed"}</span>
        </div>
        
        <div className="pt-2 border-t border-default-200">
          <p className="font-semibold text-xs mb-1">Features:</p>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <span>Scarfs: {league.iscompetitionscarfenabled === "1" ? "✅" : "❌"}</span>
            <span>Banners: {league.isbannerenabled === "1" ? "✅" : "❌"}</span>
            <span>Flags: {league.iscompetitionpoleflagenabled === "1" ? "✅" : "❌"}</span>
            <span>Cards: {league.iscompetitioncrowdcardsenabled === "1" ? "✅" : "❌"}</span>
          </div>
        </div>
      </div>
    );
  };

  const handleLeagueClick = (league: League) => {
    setSelectedLeague(league);
    setIsLeagueModalOpen(true);
  };

  const handleCloseLeagueModal = () => {
    setIsLeagueModalOpen(false);
    setSelectedLeague(null);
  };

  const handleAddLeague = (newLeague: League) => {
    // Add the new league to the state and sort by leagueid
    setLeagues(prev => {
      const updated = [...prev, newLeague];
      return updated.sort((a, b) => parseInt(a.leagueid) - parseInt(b.leagueid));
    });
    
    // Refresh team counts after adding league (in case teams were transferred)
    refreshTeamCounts(); // Uses the debounced version
  };

  if (loading) {
    return (
      <div className="pt-5 px-2">
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spinner size="lg" label="Loading leagues..." />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-5 px-2">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-semibold">League Management</h3>
        <Button 
          color="primary" 
          startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}
          onPress={() => setIsAddLeagueModalOpen(true)}
        >
          Add League
        </Button>
      </div>
      
      <Table aria-label="Leagues table">
        <TableHeader>
          <TableColumn>League</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Gender</TableColumn>
          <TableColumn>Level</TableColumn>
          <TableColumn>Teams</TableColumn>
          <TableColumn>Features</TableColumn>
        </TableHeader>
        <TableBody>
          {leagues.map((league) => (
            <TableRow 
              key={league.leagueid}
              className="cursor-pointer hover:bg-default-50"
              onClick={() => handleLeagueClick(league)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Image
                    src={getLeagueLogoUrl(league.leagueid)}
                    alt={`${league.leaguename} logo`}
                    className="w-8 h-8 object-contain"
                    fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%23888' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E"
                  />
                  <img 
                    src={getCountryFlagUrl(league.countryid)}
                    alt={`Flag of ${getCountryName(league.countryid)}`}
                    className="w-5 h-4 object-cover rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Tooltip content={league.leaguename} placement="top">
                        <span className="font-medium block w-48 truncate cursor-help">
                          {league.leaguename}
                        </span>
                      </Tooltip>
                      {isNewlyAdded(league) && (
                        <Chip
                          color="success"
                          variant="flat"
                          size="sm"
                          className="animate-pulse"
                        >
                          New
                        </Chip>
                      )}
                    </div>
                    <p className="text-xs text-default-500">ID: {league.leagueid}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Chip
                  color={getLeagueType(league) === "International" ? "secondary" : 
                         getLeagueType(league) === "Continental" ? "warning" :
                         getLeagueType(league) === "Special" ? "danger" : "default"}
                  variant="flat"
                  size="sm"
                >
                  {getLeagueType(league)}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip
                  color={getLeagueGender(league) === "women" ? "secondary" : "primary"}
                  variant="flat"
                  size="sm"
                >
                  {getLeagueGender(league) === "women" ? "Women" : "Men"}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip
                  color={getLevelColor(league.level)}
                  variant="flat"
                  size="sm"
                >
                  {league.level}
                </Chip>
              </TableCell>
              <TableCell>{getTeamsCount(league)}</TableCell>
              <TableCell>
                <Tooltip content={getFeaturesDetails(league)} placement="left" className="cursor-help">
                  <div className="cursor-help">
                    {hasSpecialFeatures(league) ? (
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

      <LeagueDivider
        league={selectedLeague}
        isOpen={isLeagueModalOpen}
        onClose={handleCloseLeagueModal}
        teamCount={selectedLeague ? getTeamsCount(selectedLeague) : 0}
        projectId={projectId}
        onDataRefresh={refreshTeamCounts}
      />

      <AddLeagueModal
        isOpen={isAddLeagueModalOpen}
        onOpenChange={setIsAddLeagueModalOpen}
        onLeagueAdded={handleAddLeague}
        projectId={projectId}
        onDataRefresh={refreshTeamCounts}
      />
    </div>
  );
}