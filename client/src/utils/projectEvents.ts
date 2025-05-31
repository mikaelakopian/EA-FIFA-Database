// Custom event system for project updates
export const PROJECT_EVENTS = {
  PROJECT_CREATED: 'projectCreated',
  PROJECT_UPDATED: 'projectUpdated',
  PROJECT_DELETED: 'projectDeleted',
} as const;

export type ProjectEventType = typeof PROJECT_EVENTS[keyof typeof PROJECT_EVENTS];

export interface ProjectEventDetail {
  project?: any;
  projectId?: string;
}

// Helper function to dispatch project events
export const dispatchProjectEvent = (type: ProjectEventType, detail?: ProjectEventDetail) => {
  window.dispatchEvent(new CustomEvent(type, { detail }));
};

// Helper function to listen to project events
export const addProjectEventListener = (
  type: ProjectEventType,
  handler: (event: CustomEvent<ProjectEventDetail>) => void
) => {
  window.addEventListener(type, handler as EventListener);
  
  // Return cleanup function
  return () => {
    window.removeEventListener(type, handler as EventListener);
  };
};