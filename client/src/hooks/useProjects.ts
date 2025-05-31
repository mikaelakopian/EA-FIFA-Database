import { useState, useEffect, useRef } from 'react';
import { PROJECT_EVENTS, addProjectEventListener } from '../utils/projectEvents';

interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  created_at: string;
  updated_at: string;
}

// Shared state to prevent multiple fetches
let sharedProjectsState: Project[] | null = null;
let sharedLoadingState = true;
let fetchPromise: Promise<void> | null = null;
let listeners: Set<(projects: Project[], loading: boolean) => void> = new Set();

const notifyListeners = (projects: Project[], loading: boolean) => {
  listeners.forEach(listener => listener(projects, loading));
};

const fetchProjectsShared = async () => {
  // If already fetching, return the existing promise
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const response = await fetch('http://localhost:8000/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      sharedProjectsState = data.projects;
      sharedLoadingState = false;
      notifyListeners(data.projects, false);
    } catch (error) {
      console.error('Error fetching projects:', error);
      sharedLoadingState = false;
      notifyListeners(sharedProjectsState || [], false);
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>(sharedProjectsState || []);
  const [loading, setLoading] = useState(sharedLoadingState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Add listener for shared state updates
    const updateState = (newProjects: Project[], newLoading: boolean) => {
      if (isMountedRef.current) {
        setProjects(newProjects);
        setLoading(newLoading);
      }
    };
    listeners.add(updateState);

    // Initial fetch if not already loaded
    if (sharedProjectsState === null) {
      fetchProjectsShared();
    } else {
      // Use existing data
      setProjects(sharedProjectsState);
      setLoading(sharedLoadingState);
    }

    // Listen for project events
    const unsubscribeCreated = addProjectEventListener(PROJECT_EVENTS.PROJECT_CREATED, () => {
      console.log('Project created event received');
      fetchProjectsShared();
    });
    
    const unsubscribeDeleted = addProjectEventListener(PROJECT_EVENTS.PROJECT_DELETED, () => {
      console.log('Project deleted event received');
      fetchProjectsShared();
    });
    
    const unsubscribeUpdated = addProjectEventListener(PROJECT_EVENTS.PROJECT_UPDATED, () => {
      console.log('Project updated event received');
      fetchProjectsShared();
    });

    return () => {
      isMountedRef.current = false;
      listeners.delete(updateState);
      unsubscribeCreated();
      unsubscribeDeleted();
      unsubscribeUpdated();
    };
  }, []);

  const refetch = () => {
    fetchProjectsShared();
  };

  return { projects, loading, refetch };
};