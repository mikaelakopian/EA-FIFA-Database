import React, { useState } from 'react';
import { siteConfig } from '../config/site';
import {
  Button,
  Tooltip,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import CreateProjectModal from './CreateProjectModal';
import { useProjects } from '../hooks/useProjects';

interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  created_at: string;
  updated_at: string;
}

/* ---------- helpers ---------- */

const iconMap: Record<string, string> = {
  home: 'lucide:home',
  'book-open': 'lucide:book-open',
  tag: 'lucide:tag',
  rss: 'lucide:rss',
  info: 'lucide:info',
  users: 'lucide:users',
  settings: 'lucide:settings',
  'help-circle': 'lucide:help-circle',
  'log-out': 'lucide:log-out',
  folder: 'lucide:folder',
  'folder-open': 'lucide:folder-open',
  search: 'lucide:search',
  'refresh-cw': 'lucide:refresh-cw',
};

const tooltipContent = (label: string) => (
  <span className="block px-3 py-2 text-sm font-medium">{label}</span>
);

interface ProjectDisplay {
  id: string;
  name: string;
  description: string;
  href: string;
}

export type NavItemConfig = {
  label: string;
  href: string;
  icon: string;
  projects?: Project[];
};

const isPathActive = (path: string, currentPath: string) =>
  path === '/' ? currentPath === path : currentPath.startsWith(path);

/* ---------- component ---------- */

export const Sidebar = () => {
  /* state ------------------------------------------------------------ */
  const getSavedCollapsedState = () => {
    if (typeof window === 'undefined') return false;
    try {
      return JSON.parse(localStorage.getItem('sidebarCollapsed') ?? 'false');
    } catch {
      return false;
    }
  };

  const [isCollapsed, setIsCollapsed] = React.useState(getSavedCollapsedState);
  const [transitionsEnabled, setTransitionsEnabled] = React.useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = React.useState('');
  const [openDropdownKey, setOpenDropdownKey] = React.useState<string | null>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);
  
  // Use the shared projects hook
  const { projects, loading: loadingProjects } = useProjects();

  const TRANSITION_MS = 500;
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /* mount ------------------------------------------------------------ */
  React.useEffect(() => {
    const t = setTimeout(() => setTransitionsEnabled(true), 100);
    return () => clearTimeout(t);
  }, []);

  /* persist collapsed state ----------------------------------------- */
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
      window.dispatchEvent(new CustomEvent('sidebarStateChange', { detail: { isCollapsed } }));
    }
  }, [isCollapsed]);

  /* handlers --------------------------------------------------------- */
  const toggleCollapse = () => {
    if (isAnimating) return;

    setOpenDropdownKey(null);
    setProjectSearchTerm('');

    requestAnimationFrame(() => {
      setIsAnimating(true);
      setIsCollapsed((prev: boolean) => !prev);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsAnimating(false), TRANSITION_MS);
    });
  };

  const handleDropdownOpenChange = (key: string, isOpenChange: boolean) => {
    if (isAnimating && isOpenChange) return; // Prevent opening dropdown during animation
    if (isOpenChange) {
      setOpenDropdownKey(key);
    } else {
      if (openDropdownKey === key) {
        setOpenDropdownKey(null);
        setProjectSearchTerm('');
      }
    }
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreateProject = () => {
    // Close the current dropdown
    setOpenDropdownKey(null);
    // Open the create project modal
    setIsCreateModalOpen(true);
  };

  const handleProjectCreated = (projectData: {
    name: string;
    description: string;
  }) => {
    console.log('New project created:', projectData);
    // No need to manually refresh here as the event listener will handle it
    setIsCreateModalOpen(false);
  };

  /* widths ----------------------------------------------------------- */
  const sidebarWidth = isCollapsed ? 'w-[72px]' : 'w-[260px]';

  /* render ----------------------------------------------------------- */
  return (
    <aside
      className={`bg-[#1e1e1e] fixed left-0 top-0 z-50 flex h-screen flex-col flex-shrink-0 ${
        transitionsEnabled ? 'transition-all duration-500 ease-in-out' : ''
      } ${sidebarWidth}`}
    >
      {/* ---------- logo / header ---------- */}
      <div
        className={`h-[64px] flex shrink-0 items-center px-4 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {isCollapsed ? (
          <img 
            src="/fc-logo.png" 
            alt="EA FC Studio Logo" 
            className="w-8 h-8 object-contain"
          />
        ) : (
          <a
            href="/"
            className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-xl font-bold transition-colors hover:text-white"
          >
            <img 
              src="/fc-logo.png" 
              alt="EA FC Studio Logo" 
              className="w-9 h-9 object-contain"
            />
            <span className="transition-opacity duration-200">EA FC Studio</span>
          </a>
        )}
      </div>

      {/* ---------- nav ---------- */}
      <nav
        className={`flex-1 space-y-4 overflow-x-hidden overflow-y-auto py-4 flex flex-col ${
          isCollapsed ? 'items-center' : 'items-start w-full px-3'
        }`}
      >
        {(siteConfig.navItems as NavItemConfig[]).map((item) => {
          /* ----- preparation ----- */
          const projectIconName =
            isPathActive(item.href, currentPath) && item.icon === 'folder'
              ? 'folder-open'
              : item.icon;

          const dropdownKey = `${item.label}-projects`;
          const isOpen = openDropdownKey === dropdownKey;

          // Use real projects from API if this is the Projects nav item
          let displayProjects: ProjectDisplay[] = [];
          if (item.label === 'Projects' && item.href === '/projects') {
            // Convert API projects to display format
            displayProjects = projects.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description || 'No description',
              href: `/projects/${p.id}`
            }));
            
            // Filter based on search term
            if (projectSearchTerm) {
              displayProjects = displayProjects.filter(
                (p) =>
                  p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
                  p.description.toLowerCase().includes(projectSearchTerm.toLowerCase()),
              );
            }
          } else if (item.projects) {
            // Use static projects for other nav items
            const filteredProjects = item.projects.filter(
              (p) =>
                p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(projectSearchTerm.toLowerCase())),
            );
            displayProjects = filteredProjects.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description || 'No description',
              href: `/projects/${p.id}`
            }));
          }

          /* ----- item with projects ----- */
          if ((item.label === 'Projects' && item.href === '/projects') || item.projects?.length) {
            const triggerButtonElement = (
              <Button
                isIconOnly
                variant="light"
                aria-label={item.label}
                className={`rounded-lg text-[#ccc] transition-all duration-300 hover:bg-white/10 hover:text-white h-10 w-10 ${
                  isPathActive(item.href, currentPath) || isOpen ? 'bg-white/15 text-white' : ''
                }`}
              >
                <Icon icon={iconMap[projectIconName]} className="h-5 w-5 shrink-0" />
              </Button>
            );

            const expandedTriggerButtonElement = (
              <Button
                variant="light"
                aria-label={item.label}
                className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-[#ccc] transition-all duration-300 hover:bg-white/10 hover:text-white ${
                  isPathActive(item.href, currentPath) || isOpen ? 'bg-white/15 text-white' : ''
                }`}
              >
                <div className="flex items-center">
                  <Icon 
                    icon={iconMap[projectIconName]} 
                    className="mr-3 h-5 w-5 shrink-0 transition-transform duration-300" 
                  />
                  <span className="whitespace-nowrap text-sm font-medium">{item.label}</span>
                </div>
                <Icon 
                  icon="lucide:chevron-down"
                  className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            );

            if (isAnimating && !isCollapsed) {
              return (
                <div key={dropdownKey} className={'w-full'}>
                  {expandedTriggerButtonElement}
                </div>
              );
            }
            
            if (isAnimating && isCollapsed) {
              return (
                <div key={dropdownKey} className="relative">
                  <Tooltip
                    content={tooltipContent(item.label)}
                    placement="right"
                    delay={50}
                    isDisabled={true} // Disable tooltip interactivity during animation
                  >
                    {triggerButtonElement}
                  </Tooltip>
                </div>
              );
            }

            /* -------- collapsed state -------- */
            if (isCollapsed) {
              return (
                <div key={dropdownKey} className="relative">
                  <Tooltip
                    content={tooltipContent(item.label)}
                    placement="right"
                    delay={50}
                    offset={8}
                    color="primary"
                  >
                    <div>
                      <Dropdown
                        isOpen={isOpen}
                        onOpenChange={(open) => handleDropdownOpenChange(dropdownKey, open)}
                        placement="right-start"
                        offset={8}
                        className="[&_div]:!border-0 [&_div]:!outline-0"
                      >
                        <DropdownTrigger>
                          {triggerButtonElement}
                        </DropdownTrigger>
                        <DropdownMenu
                          aria-label={`${item.label} projects`}
                          closeOnSelect
                          items={displayProjects}
                          className="w-[280px] flex flex-col rounded-lg bg-[#1e1e1e] shadow-xl p-0 border border-white/10"
                          classNames={{
                            base: "p-0",
                            list: 'max-h-[260px] overflow-y-auto py-2 px-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20',
                          }}
                          itemClasses={{
                            base: 'p-3 rounded-md text-[#ccc] data-[hover=true]:bg-white/10 data-[hover=true]:text-white focus:outline-none data-[focus-visible=true]:bg-white/10',
                            title: 'text-sm font-medium flex items-center',
                            description: 'mt-1 text-xs text-[#999]',
                          }}
                          topContent={
                            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#222] p-3 rounded-t-lg">
                              <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-semibold text-white">{item.label}</h3>
                                <span className="text-xs text-[#999]">
                                  {loadingProjects && item.label === 'Projects' ? (
                                    'Loading...'
                                  ) : projectSearchTerm ? (
                                    `${displayProjects.length} found`
                                  ) : (
                                    `${displayProjects.length} projects`
                                  )}
                                </span>
                              </div>
                              <Input
                                aria-label={`Search ${item.label}`}
                                size="sm"
                                variant="bordered"
                                placeholder="Search projects..."
                                value={projectSearchTerm}
                                onValueChange={setProjectSearchTerm}
                                startContent={
                                  <Icon icon="lucide:search" className="pointer-events-none h-4 w-4 flex-shrink-0 text-default-400" />
                                }
                                isClearable
                                onClear={() => setProjectSearchTerm('')}
                                classNames={{
                                  base: 'max-w-full',
                                  inputWrapper:
                                    'bg-[#333] data-[hover=true]:bg-[#444] group-data-[focus=true]:bg-[#444] border-white/5',
                                  input: 'text-[#ccc] placeholder:text-[#666]',
                                  clearButton: 'text-[#ccc] hover:text-white',
                                }}
                              />
                            </div>
                          }
                          bottomContent={
                            <div className="sticky bottom-0 border-t border-white/10 bg-[#222] p-3 rounded-b-lg">
                              <Button 
                                color="primary" 
                                variant="shadow"
                                className="w-full"
                                startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}
                                onPress={handleCreateProject}
                              >
                                Create Project
                              </Button>
                            </div>
                          }
                          emptyContent={
                            <div className="p-6 text-center">
                              <Icon icon="lucide:search-x" className="mx-auto h-8 w-8 text-[#666] mb-2" />
                              <p className="text-sm text-[#999] mb-1">No projects found.</p>
                              <p className="text-xs text-[#666]">Try a different search term.</p>
                            </div>
                          }
                          onAction={() => {
                            handleDropdownOpenChange(dropdownKey, false);
                          }}
                        >
                          {(project) => (
                            <DropdownItem
                              key={project.id}
                              href={project.href}
                              description={project.description}
                              startContent={<Icon icon="lucide:file" className="h-4 w-4 mt-0.5 text-[#999]" />}
                              onPress={() => window.location.href = project.href}
                            >
                              {project.name}
                            </DropdownItem>
                          )}
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </Tooltip>
                </div>
              );
            }

            /* -------- expanded state -------- */
            return (
              <div key={dropdownKey} className="w-full">
                <Dropdown
                  isOpen={isOpen}
                  onOpenChange={(open) => handleDropdownOpenChange(dropdownKey, open)}
                  placement="bottom-start"
                  offset={4}
                  className="[&_div]:!border-0 [&_div]:!outline-0 w-full"
                >
                  <DropdownTrigger>
                    {expandedTriggerButtonElement}
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label={`${item.label} projects`}
                    closeOnSelect
                    items={displayProjects}
                    className="w-[280px] flex flex-col rounded-lg bg-[#1e1e1e] shadow-xl p-0 border border-white/10"
                    classNames={{
                      base: "p-0",
                      list: 'max-h-[260px] overflow-y-auto py-2 px-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20',
                    }}
                    itemClasses={{
                      base: 'p-3 rounded-md text-[#ccc] data-[hover=true]:bg-white/10 data-[hover=true]:text-white focus:outline-none data-[focus-visible=true]:bg-white/10',
                      title: 'text-sm font-medium flex items-center',
                      description: 'mt-1 text-xs text-[#999]',
                    }}
                    topContent={
                      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#222] p-3 rounded-t-lg">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-sm font-semibold text-white">{item.label}</h3>
                          <span className="text-xs text-[#999]">
                            {loadingProjects && item.label === 'Projects' ? (
                              'Loading...'
                            ) : projectSearchTerm ? (
                              `${displayProjects.length} found`
                            ) : (
                              `${displayProjects.length} projects`
                            )}
                          </span>
                        </div>
                        <Input
                          aria-label={`Search ${item.label}`}
                          size="sm"
                          variant="bordered"
                          placeholder="Search projects..."
                          value={projectSearchTerm}
                          onValueChange={setProjectSearchTerm}
                          startContent={
                            <Icon icon="lucide:search" className="pointer-events-none h-4 w-4 flex-shrink-0 text-default-400" />
                          }
                          isClearable
                          onClear={() => setProjectSearchTerm('')}
                          classNames={{
                            base: 'max-w-full',
                            inputWrapper:
                              'bg-[#333] data-[hover=true]:bg-[#444] group-data-[focus=true]:bg-[#444] border-white/5',
                            input: 'text-[#ccc] placeholder:text-[#666]',
                            clearButton: 'text-[#ccc] hover:text-white',
                          }}
                        />
                      </div>
                    }
                    bottomContent={
                      <div className="sticky bottom-0 border-t border-white/10 bg-[#222] p-3 rounded-b-lg">
                        <Button 
                          color="primary" 
                          variant="shadow"
                          className="w-full"
                          startContent={<Icon icon="lucide:plus" className="h-4 w-4" />}
                          onPress={handleCreateProject}
                        >
                          Create Project
                        </Button>
                      </div>
                    }
                    emptyContent={
                      <div className="p-6 text-center">
                        <Icon icon="lucide:search-x" className="mx-auto h-8 w-8 text-[#666] mb-2" />
                        <p className="text-sm text-[#999] mb-1">No projects found.</p>
                        <p className="text-xs text-[#666]">Try a different search term.</p>
                      </div>
                    }
                    onAction={() => {
                      handleDropdownOpenChange(dropdownKey, false);
                    }}
                  >
                    {(project) => (
                      <DropdownItem
                        key={project.id}
                        href={project.href}
                        description={project.description}
                        startContent={<Icon icon="lucide:file" className="h-4 w-4 mt-0.5 text-[#999]" />}
                        onPress={() => window.location.href = project.href}
                      >
                        {project.name}
                      </DropdownItem>
                    )}
                  </DropdownMenu>
                </Dropdown>
              </div>
            );
          }

          /* ----- regular menu item ----- */
          return isCollapsed ? (
            <Tooltip
              key={item.label}
              content={tooltipContent(item.label)}
              placement="right"
              delay={50}
              isDisabled={isAnimating}
              color="primary"
            >
              <Button
                href={item.href}
                as="a"
                isIconOnly
                variant="light"
                aria-label={item.label}
                aria-current={isPathActive(item.href, currentPath) ? 'page' : undefined}
                isDisabled={isAnimating}
                className={`rounded-lg text-[#ccc] transition-all duration-300 hover:bg-white/10 hover:text-white ${
                  isPathActive(item.href, currentPath) ? 'bg-white/15 text-white' : ''
                }`}
              >
                <Icon icon={iconMap[item.icon]} className="h-5 w-5 transition-transform duration-300" />
              </Button>
            </Tooltip>
          ) : (
            <Button
              key={item.label}
              href={item.href}
              as="a"
              variant="light"
              aria-label={item.label}
              aria-current={isPathActive(item.href, currentPath) ? 'page' : undefined}
              isDisabled={isAnimating}
              className={`flex w-full items-center justify-start rounded-lg px-4 py-3 text-[#ccc] transition-all duration-300 hover:bg-white/10 hover:text-white ${
                isPathActive(item.href, currentPath) ? 'bg-white/15 text-white' : ''
              }`}
            >
              <Icon icon={iconMap[item.icon]} className="mr-3 h-5 w-5 shrink-0 transition-transform" />
              <span className="whitespace-nowrap text-sm font-medium">{item.label}</span>
            </Button>
          );
        })}
      </nav>

      {/* ---------- footer ---------- */}
      <div
        className={`shrink-0 border-t border-white/10 py-4 ${
          isCollapsed ? 'flex w-full justify-center' : 'px-3'
        }`}
      >
        {isCollapsed ? (
          <Tooltip
            content={tooltipContent('Expand sidebar')}
            placement="right"
            delay={50}
            isDisabled={isAnimating}
            color="primary"
          >
            <Button
              isIconOnly
              variant="light"
              aria-label="Expand sidebar"
              onPress={toggleCollapse}
              isDisabled={isAnimating}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#ccc] transition-all duration-300 hover:bg-white/10 hover:text-white"
            >
              <Icon icon="lucide:chevron-right" className="h-5 w-5" />
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="light"
            fullWidth
            aria-label="Collapse sidebar"
            onPress={toggleCollapse}
            isDisabled={isAnimating}
            className="flex items-center justify-start rounded-lg px-4 py-3 text-[#ccc] transition-all duration-300 hover:bg-white/10 hover:text-white"
          >
            <Icon icon="lucide:chevron-left" className="h-5 w-5 shrink-0" />
            <span className="ml-3 whitespace-nowrap text-sm font-medium">Collapse</span>
          </Button>
        )}
      </div>
      
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateProject={handleProjectCreated}
      />
    </aside>
  );
};

export default Sidebar;