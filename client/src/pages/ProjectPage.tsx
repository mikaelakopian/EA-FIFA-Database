import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Button,
  Tabs,
  Tab,
  Spinner,
  Breadcrumbs,
  BreadcrumbItem,
  Divider,
  Progress,
  Badge
} from "@heroui/react";
import { Icon } from "@iconify/react";
import DefaultLayout from "../layouts/default";
import ProjectLeaguesPage from "./ProjectLeaguesPage";
import ProjectTeamsPage from "./ProjectTeamsPage";
import ProjectPlayersPage from "./ProjectPlayersPage";

interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  created_at: string;
  updated_at: string;
  project_code?: string;
}

interface Team {
  id: string;
  name: string;
  league: string;
  players_count: number;
  overall_rating: number;
  badge_url?: string;
}

interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  overall_rating: number;
  age: number;
  value: string;
}

const gradients = [
  "from-purple-600 to-blue-400",
  "from-indigo-500 to-cyan-400",
  "from-emerald-500 to-blue-400",
  "from-orange-500 to-yellow-400"
];

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = React.useState<Project | null>(null);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [exporting, setExporting] = React.useState(false);

  // Ref to track if we're already fetching data
  const isFetching = React.useRef(false);
  const currentId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!id || isFetching.current || currentId.current === id) return;

    isFetching.current = true;
    currentId.current = id;
    const fetchProjectData = async () => {
      setLoading(true);
      try {
        // Try to fetch real project data first
        try {
          const response = await fetch(`http://localhost:8000/projects/${id}`);
          if (response.ok) {
            const projectData = await response.json();
            setProject(projectData);
          } else {
            // Use mock data if API call fails
            const mockProject = {
              id: id as string,
              name: id === "germany" ? "Germany" : id === "3-leagues" ? "3 Leagues Project" : "Premier League 2024",
              description: id === "3-leagues" ? "Three league football simulation" : "English Premier League simulation with all 20 teams",
              path: `/projects/${id}`,
              created_at: "2025-05-23T10:30:00Z",
              updated_at: "2025-05-23T15:45:00Z",
              project_code: id === "germany" ? "444" : "123",
            };
            setProject(mockProject);
          }
        } catch (error) {
          console.log("Using mock data for project");
          const mockProject = {
            id: id as string,
            name: id === "germany" ? "Germany" : id === "3-leagues" ? "3 Leagues Project" : "Premier League 2024",
            description: id === "3-leagues" ? "Three league football simulation" : "English Premier League simulation with all 20 teams",
            path: `/projects/${id}`,
            created_at: "2025-05-23T10:30:00Z",
            updated_at: "2025-05-23T15:45:00Z",
            project_code: id === "germany" ? "444" : "123",
          };
          setProject(mockProject);
        }

        const mockTeams: Team[] = [
          { id: "1", name: "Bayern Munich", league: "Bundesliga", players_count: 25, overall_rating: 86 },
          { id: "2", name: "Borussia Dortmund", league: "Bundesliga", players_count: 24, overall_rating: 84 },
          { id: "3", name: "RB Leipzig", league: "Bundesliga", players_count: 26, overall_rating: 83 },
          { id: "4", name: "Bayer Leverkusen", league: "Bundesliga", players_count: 25, overall_rating: 81 },
        ];

        const mockPlayers: Player[] = [
          { id: "1", name: "Joshua Kimmich", team: "Bayern Munich", position: "CM", overall_rating: 88, age: 30, value: "€70M" },
          { id: "2", name: "Jamal Musiala", team: "Bayern Munich", position: "CAM", overall_rating: 86, age: 22, value: "€120M" },
          { id: "3", name: "Florian Wirtz", team: "Bayer Leverkusen", position: "CAM", overall_rating: 87, age: 23, value: "€130M" },
          { id: "4", name: "Marco Reus", team: "Borussia Dortmund", position: "CAM", overall_rating: 83, age: 35, value: "€15M" },
        ];

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        setTeams(mockTeams);
        setPlayers(mockPlayers);
      } catch (error) {
        console.error("Error fetching project data:", error);
      } finally {
        setLoading(false);
        isFetching.current = false;
      }
    };

    fetchProjectData();

  }, [id]);

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleExport = async () => {
    if (!project) return;
    
    setExporting(true);
    try {
      const response = await fetch(`http://localhost:8000/projects/${project.id}/export-data`);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      // Get the blob and create a download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.id}_data_export.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      // You could add a toast notification here to show the error to user
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <DefaultLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Spinner size="lg" label="Loading project..." />
        </div>
      </DefaultLayout>
    );
  }

  if (!project) {
    return (
      <DefaultLayout>
        <div className="text-center py-20">
          <Icon icon="lucide:folder-x" className="mx-auto h-16 w-16 text-default-400 mb-4" />
          <h1 className="text-2xl font-bold text-default-700 mb-2">Project Not Found</h1>
          <p className="text-default-500 mb-6">The project you're looking for doesn't exist or has been removed.</p>
          <Button color="primary" onPress={() => navigate('/')}>
            <Icon icon="lucide:arrow-left" className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="space-y-4 py-4">
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <BreadcrumbItem onPress={() => navigate('/')}>Home</BreadcrumbItem>
          <BreadcrumbItem>Projects</BreadcrumbItem>
          <BreadcrumbItem>{project.name}</BreadcrumbItem>
        </Breadcrumbs>

        {/* Main Content with Tabs */}
        <Card>
          <CardBody className="p-1">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              className="p-0" // Changed from p-3 to p-4 for more comfortable tab panel spacing
              variant="underlined"
              aria-label="Project management tabs"
            >
              <Tab
                key="overview"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:home" className="h-4 w-4" />
                    <span>Overview</span>
                  </div>
                }
              >
                <div className="space-y-6 pt-0"> {/* Changed from space-y-4 pt-3 to space-y-6 pt-4 for better vertical rhythm */}
                  {/* Project Header */}
                  <div className="relative overflow-hidden rounded-xl bg-content1">
                    <div className={`absolute inset-0 bg-gradient-to-r ${gradients[0]} opacity-10`} />
                    <div className="p-8"> {/* Changed from p-6 to p-8 for more breathing room */}
                      <div className="flex flex-col md:flex-row gap-8 justify-between"> {/* Changed gap-6 to gap-8 */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Icon icon="lucide:folder" className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold">{project.name}</h2>
                              <p className="text-default-500">Project ID: {project.id}</p>
                            </div>
                          </div>
                          <div className="text-3xl font-bold mt-2">{project.project_code}</div>
                          <div className="flex flex-wrap gap-6 text-sm text-default-500">
                            <div className="flex items-center gap-2">
                              <Icon icon="lucide:calendar" className="h-4 w-4" />
                              <span>Created {formatDate(project.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Icon icon="lucide:clock" className="h-4 w-4" />
                              <span>Updated {formatDate(project.updated_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 self-start">
                          <Button color="primary" startContent={<Icon icon="lucide:play" className="h-4 w-4" />}>
                            Launch Game
                          </Button>
                          <Button variant="light" startContent={<Icon icon="lucide:settings" className="h-4 w-4" />}>
                            Settings
                          </Button>
                          <Button 
                            variant="light" 
                            startContent={<Icon icon="lucide:download" className="h-4 w-4" />}
                            onPress={handleExport}
                            isLoading={exporting}
                            isDisabled={exporting}
                          >
                            {exporting ? 'Exporting...' : 'Export'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards - Increasing spacing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"> {/* Changed gap-4 to gap-5 */}
                    <Card className="bg-content2 shadow-none">
                      <CardBody className="p-5"> {/* Changed from p-4 to p-5 */}
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-3 rounded-lg">
                            <Icon icon="lucide:trophy" className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-default-500">Leagues</p>
                            <p className="text-2xl font-bold">3</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    <Card className="bg-content2 shadow-none">
                      <CardBody className="p-5"> {/* Changed from p-4 to p-5 */}
                        <div className="flex items-center gap-3">
                          <div className="bg-success/10 p-3 rounded-lg">
                            <Icon icon="lucide:shield" className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="text-sm text-default-500">Teams</p>
                            <p className="text-2xl font-bold">{teams.length}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    <Card className="bg-content2 shadow-none">
                      <CardBody className="p-5"> {/* Changed from p-4 to p-5 */}
                        <div className="flex items-center gap-3">
                          <div className="bg-warning/10 p-3 rounded-lg">
                            <Icon icon="lucide:users" className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <p className="text-sm text-default-500">Players</p>
                            <p className="text-2xl font-bold">{players.length}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                    <Card className="bg-content2 shadow-none">
                      <CardBody className="p-5"> {/* Changed from p-4 to p-5 */}
                        <div className="flex items-center gap-3">
                          <div className="bg-secondary/10 p-3 rounded-lg">
                            <Icon icon="lucide:star" className="h-5 w-5 text-secondary" />
                          </div>
                          <div>
                            <p className="text-sm text-default-500">Avg Rating</p>
                            <p className="text-2xl font-bold">
                              {teams.length > 0 ? (teams.reduce((sum, team) => sum + team.overall_rating, 0) / teams.length).toFixed(1) : '0'}
                            </p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  <div className="px-2"> {/* Added horizontal padding for better alignment */}
                    <h3 className="text-lg font-semibold mb-5">Project Progress</h3> {/* Changed mb-4 to mb-5 */}
                    <div className="space-y-5"> {/* Changed from space-y-4 to space-y-5 */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Database Setup</span>
                          <span>100%</span>
                        </div>
                        <Progress value={100} color="success" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>League Configuration</span>
                          <span>75%</span>
                        </div>
                        <Progress value={75} color="primary" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Team Data Import</span>
                          <span>60%</span>
                        </div>
                        <Progress value={60} color="warning" />
                      </div>
                    </div>
                  </div>
                  <Divider />
                  <div className="px-2"> {/* Added horizontal padding for better alignment */}
                    <h3 className="text-lg font-semibold mb-5">Recent Activity</h3> {/* Changed mb-4 to mb-5 */}
                    <div className="space-y-4"> {/* Changed from space-y-3 to space-y-4 */}
                      {[
                        { action: "Added new player data", time: "2 hours ago", icon: "lucide:user-plus" },
                        { action: "Updated team formations", time: "5 hours ago", icon: "lucide:edit" },
                        { action: "Imported league standings", time: "1 day ago", icon: "lucide:download" },
                        { action: "Created project", time: "2 days ago", icon: "lucide:folder-plus" },
                      ].map((activity, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-default-50"> {/* Changed gap-3 p-3 to gap-4 p-4 */}
                          <div className="p-2 rounded-full bg-default-100">
                            <Icon icon={activity.icon} className="h-4 w-4 text-default-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{activity.action}</p>
                            <p className="text-xs text-default-500">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Tab>
              <Tab
                key="leagues"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:trophy" className="h-4 w-4" />
                    <span>Leagues</span>
                    <Badge size="sm" color="primary">
                      3
                    </Badge>
                  </div>
                }
              >
                <ProjectLeaguesPage projectId={id} />
              </Tab>
              <Tab
                key="teams"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:shield" className="h-4 w-4" />
                    <span>Teams</span>
                    <Badge size="sm" color="success">
                      {teams.length}
                    </Badge>
                  </div>
                }
              >
                <ProjectTeamsPage teams={teams} />
              </Tab>
              <Tab
                key="players"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:users" className="h-4 w-4" />
                    <span>Players</span>
                    <Badge size="sm" color="warning">
                      {players.length}
                    </Badge>
                  </div>
                }
              >
                <ProjectPlayersPage players={players} />
              </Tab>
            </Tabs>
          </CardBody>
        </Card>
      </div>
    </DefaultLayout>
  );
}