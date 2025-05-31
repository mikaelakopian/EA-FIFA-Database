import { 
  Button, 
  Card, 
  CardBody, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem
} from "@heroui/react"; 
import { Icon } from "@iconify/react"; 
import { useState } from "react";
import DefaultLayout from "../layouts/default"; 
import { title, subtitle } from "../components/primitives"; 
import CreateProjectModal from "../components/CreateProjectModal";
import DeleteConfirmationModal from "../components/DeleteConfirmationModal";
import EditProjectModal from "../components/EditProjectModal";
import { dispatchProjectEvent, PROJECT_EVENTS } from "../utils/projectEvents";
import { useProjects } from "../hooks/useProjects";

const statsData = [ 
  { title: "Leagues", value: "16", icon: "lucide:trophy", iconClassName: "text-blue-500" }, 
  { title: "Teams", value: "342", icon: "lucide:shield", iconClassName: "text-purple-500" }, 
  { title: "Players", value: "8,721", icon: "lucide:users", iconClassName: "text-green-500" }, 
  { title: "Projects", value: "5", icon: "lucide:folder", iconClassName: "text-yellow-500" }, 
];


const gradients = [
  "from-purple-600 to-blue-400",
  "from-indigo-500 to-cyan-400",
  "from-fuchsia-500 to-purple-400",
  "from-violet-600 to-indigo-400",
  "from-purple-500 to-pink-400",
];

export default function IndexPage() { 
  // Use simple state management instead of useDisclosure
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingProjects, setExportingProjects] = useState<Set<string>>(new Set());
  
  // Use the shared projects hook
  const { projects, loading, refetch } = useProjects();

  const handleCreateProject = (projectData: { name: string; description: string; }) => {
    console.log("Creating project:", projectData); 
    // No need to manually refresh here as the event listener will handle it
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:8000/projects/${selectedProject.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete project');
      
      // Dispatch project deleted event
      dispatchProjectEvent(PROJECT_EVENTS.PROJECT_DELETED, { projectId: selectedProject.id });
      
      // Refresh projects list
      refetch();
      
      // Close modal
      setDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (project: any) => {
    setSelectedProject(project);
    setDeleteModalOpen(true);
  };

  const openEditModal = (project: any) => {
    setSelectedProject(project);
    setEditModalOpen(true);
  };

  const handleExportProject = async (project: any) => {
    setExportingProjects(prev => new Set(prev).add(project.id));
    
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
      setExportingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(project.id);
        return newSet;
      });
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }; 
  
  return ( 
    <DefaultLayout> 
      <div className="space-y-12 md:space-y-16 py-8 md:py-10"> 
        {/* Hero Section with Stats moved to the right */} 
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"> 
          {/* Welcome Text - Takes up 5 columns on large screens */} 
          <div className="lg:col-span-5 space-y-6"> 
            <h1 className={title({ size: "displayLg", className: "mb-2 md:mb-3 font-bold" })}> 
              Welcome to EA FC STUDIO 
            </h1> 
            <p className={subtitle({ className: "mb-6 max-w-xl text-lg" })}> 
              Create and manage your football universe with advanced tools for leagues, teams, and players. 
            </p> 
            <div className="flex flex-col sm:flex-row gap-3"> 
              <Button
                color="primary"
                size="lg"
                className="min-w-[180px] shadow-lg"
                onPress={() => setModalOpen(true)}
              >
                Create New Project 
              </Button> 
              <Button variant="bordered" size="lg" className="min-w-[180px]"> 
                Explore Features 
              </Button> 
            </div> 
          </div>

          {/* Stats Cards - Takes up 7 columns on large screens */} 
          <div className="lg:col-span-7"> 
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
              {statsData.map((stat) => ( 
                <Card 
                  key={stat.title} 
                  shadow="sm" 
                  isHoverable 
                  className="bg-content1 border border-default-200 dark:border-default-100 transition-all hover:shadow-md" 
                > 
                  <CardBody className="flex flex-row items-center gap-4 p-5"> 
                    <div className={`p-3 rounded-full bg-opacity-10 ${stat.iconClassName.replace('text-', 'bg-')}`}> 
                      <Icon icon={stat.icon} width={28} height={28} className={stat.iconClassName} /> 
                    </div> 
                    <div> 
                      <p className="text-sm text-default-500 font-medium">{stat.title}</p> 
                      <p className="text-2xl font-bold text-default-800">
                        {stat.title === "Projects" ? projects.length : stat.value}
                      </p>
                    </div> 
                  </CardBody> 
                </Card> 
              ))} 
            </div> 
          </div> 
        </section> 
        
        {/* Projects Section */} 
        <section className="pt-8 md:pt-10 border-t border-default-200 dark:border-default-100"> 
          <h2 className={title({ size: "headingLg", className: "mb-4 md:mb-5 font-semibold text-default-800" })}> 
            Your Projects 
          </h2> 
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6"> 
            {loading ? (
              // Loading skeleton
              Array.from({ length: 4 }).map((_, index) => (
              <Card 
                key={index}
                  radius="lg"
                  className="overflow-hidden border-none h-48 animate-pulse bg-default-100"
                />
              ))
            ) : (
              projects.map((project, index) => (
                <Card
                  key={project.id}
                disableRipple 
                radius="lg" 
                className="overflow-hidden border-none h-48 relative cursor-pointer"
                  onClick={() => window.location.href = `/projects/${project.id}`}
              > 
                {/* Simplified gradient background with blur effect */}
                <div className="absolute inset-0">
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradients[index % gradients.length]} backdrop-filter backdrop-blur-sm`}></div>
                </div>
                
                <div className="absolute inset-0 p-4"> 
                    {/* Top section with date and description */}
                  <div className="flex justify-between items-start"> 
                    <div className="flex gap-2"> 
                      <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm">
                          {formatDate(project.created_at)}
                      </span>
                        {project.description && (
                          <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm max-w-[120px] truncate">
                            {project.description}
                      </span>
                        )}
                    </div> 
                    
                    {/* Dropdown menu without button nesting issue */} 
                    <Dropdown> 
                      <DropdownTrigger>
                        {/* Using a div instead of Button to avoid button nesting */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center h-8 w-8 cursor-pointer hover:bg-white/30 transition-colors">
                          <Icon icon="lucide:more-horizontal" className="h-4 w-4 text-white" />
                        </div>
                      </DropdownTrigger> 
                      <DropdownMenu aria-label="Project actions"> 
                        <DropdownItem 
                          key="open" 
                          startContent={<Icon icon="lucide:external-link" className="text-default-500 h-4 w-4" />}
                          onPress={() => window.location.href = `/projects/${project.id}`}
                        >
                          Open 
                        </DropdownItem> 
                        <DropdownItem
                          key="edit"
                          startContent={<Icon icon="lucide:edit-2" className="text-default-500 h-4 w-4" />}
                          onPress={() => openEditModal(project)}
                        >
                          Edit 
                        </DropdownItem> 
                        <DropdownItem 
                          key="export" 
                          startContent={<Icon icon="lucide:download" className="text-default-500 h-4 w-4" />}
                          onPress={() => handleExportProject(project)}
                          isDisabled={exportingProjects.has(project.id)}
                        > 
                          {exportingProjects.has(project.id) ? 'Exporting...' : 'Export'}
                        </DropdownItem> 
                        <DropdownItem 
                          key="delete" 
                          className="text-danger" 
                          color="danger" 
                          startContent={<Icon icon="lucide:trash-2" className="text-danger h-4 w-4" />} 
                          onPress={() => openDeleteModal(project)}
                        > 
                          Delete 
                        </DropdownItem> 
                      </DropdownMenu> 
                    </Dropdown> 
                  </div> 
                  
                  {/* Bottom section with title and open button - removed arrow icon */} 
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                      <h3 className="text-white font-medium text-lg">{project.name}</h3>
                    <Button 
                      size="sm" 
                      radius="full"
                      className="bg-white/20 backdrop-blur-sm text-white border-none hover:bg-white/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/projects/${project.id}`;
                      }}
                    >
                      Open
                    </Button>
                  </div> 
                </div> 
              </Card> 
              ))
            )}
            
            <Card 
              radius="lg" 
              className="overflow-hidden border-dashed border-2 border-default-300 h-48 flex items-center justify-center bg-default-50 cursor-pointer hover:bg-default-100 transition-colors" 
              onPress={() => setModalOpen(true)}
              isPressable
            > 
              <CardBody className="flex items-center justify-center p-6 text-center"> 
                <div className="flex flex-col items-center"> 
                  <div className="rounded-full bg-default-100 p-3 mb-3"> 
                    <Icon icon="lucide:plus" className="h-6 w-6 text-default-500" /> 
                  </div> 
                  <h3 className="text-default-700 font-medium">New Project</h3> 
                </div> 
              </CardBody> 
            </Card> 
          </div> 
        </section> 
      </div> 
      <CreateProjectModal 
        isOpen={modalOpen}
        onOpenChange={(open) => setModalOpen(open)}
        onCreateProject={handleCreateProject} 
      /> 
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onOpenChange={(open) => setDeleteModalOpen(open)}
        projectName={selectedProject?.name || ''}
        onConfirm={handleDeleteProject}
        isDeleting={isDeleting}
      />
      <EditProjectModal
        isOpen={editModalOpen}
        onOpenChange={(open) => setEditModalOpen(open)}
        project={selectedProject}
      />
    </DefaultLayout>
  ); 
}