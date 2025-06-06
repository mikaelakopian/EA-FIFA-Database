// Global API cache for formations and teamsheets
interface CacheItem {
  data: any;
  timestamp: number;
}

interface ApiCache {
  formations: { [projectId: string]: CacheItem };
  teamsheets: { [projectId: string]: CacheItem };
  players: { [projectId: string]: CacheItem };
  playernames: { [projectId: string]: CacheItem };
  jerseyNumbers: { [key: string]: CacheItem }; // key format: "projectId_teamId"
}

const CACHE_DURATION = 300000; // 5 minutes - увеличиваем для стабильности
const apiCache: ApiCache = {
  formations: {},
  teamsheets: {},
  players: {},
  playernames: {},
  jerseyNumbers: {}
};

// In-flight request tracking to prevent duplicate requests
const inFlightRequests: { [key: string]: Promise<any> } = {};

// Cached fetch function for formations
export async function fetchFormationsWithCache(projectId: string): Promise<any[]> {
  const cacheKey = projectId;
  const requestKey = `formations_${projectId}`;
  
  // Check if request is already in flight
  if (requestKey in inFlightRequests) {
    console.log(`[API Cache] Request already in flight for formations ${projectId}, waiting...`);
    return inFlightRequests[requestKey];
  }
  
  const cached = apiCache.formations[cacheKey];
  
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log(`[API Cache] Using cached formations for project ${projectId}`);
    return cached.data;
  }
  
  console.log(`[API Cache] Fetching formations for project ${projectId}`);
  
  // Create the request promise and store it
  const requestPromise = fetch(`http://localhost:8000/formations?project_id=${projectId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch formations: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache the data
      apiCache.formations[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      return data;
    })
    .finally(() => {
      // Clear the in-flight request
      delete inFlightRequests[requestKey];
    });
  
  // Store the in-flight request
  inFlightRequests[requestKey] = requestPromise;
  
  return requestPromise;
}

// Cached fetch function for teamsheets
export async function fetchTeamsheetsWithCache(projectId: string): Promise<any[]> {
  const cacheKey = projectId;
  const requestKey = `teamsheets_${projectId}`;
  
  // Check if request is already in flight
  if (requestKey in inFlightRequests) {
    console.log(`[API Cache] Request already in flight for teamsheets ${projectId}, waiting...`);
    return inFlightRequests[requestKey];
  }
  
  const cached = apiCache.teamsheets[cacheKey];
  
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log(`[API Cache] Using cached teamsheets for project ${projectId}`);
    return cached.data;
  }
  
  console.log(`[API Cache] Fetching teamsheets for project ${projectId}`);
  
  // Create the request promise and store it
  const requestPromise = fetch(`http://localhost:8000/default_teamsheets?project_id=${projectId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch teamsheets: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache the data
      apiCache.teamsheets[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      return data;
    })
    .finally(() => {
      // Clear the in-flight request
      delete inFlightRequests[requestKey];
    });
  
  // Store the in-flight request
  inFlightRequests[requestKey] = requestPromise;
  
  return requestPromise;
}

// Cached fetch function for players
export async function fetchPlayersWithCache(projectId: string): Promise<any[]> {
  const cacheKey = projectId;
  const requestKey = `players_${projectId}`;
  
  // Check if request is already in flight
  if (requestKey in inFlightRequests) {
    console.log(`[API Cache] Request already in flight for players ${projectId}, waiting...`);
    return inFlightRequests[requestKey];
  }
  
  const cached = apiCache.players[cacheKey];
  
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log(`[API Cache] Using cached players for project ${projectId}`);
    return cached.data;
  }
  
  console.log(`[API Cache] Fetching players for project ${projectId}`);
  
  // Create the request promise and store it
  const requestPromise = fetch(`http://localhost:8000/players?project_id=${projectId}&limit=500`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache the data
      apiCache.players[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      return data;
    })
    .finally(() => {
      // Clear the in-flight request
      delete inFlightRequests[requestKey];
    });
  
  // Store the in-flight request
  inFlightRequests[requestKey] = requestPromise;
  
  return requestPromise;
}

// Cached fetch function for playernames
export async function fetchPlayernamesWithCache(projectId: string): Promise<any[]> {
  const cacheKey = projectId;
  const requestKey = `playernames_${projectId}`;
  
  // Check if request is already in flight
  if (requestKey in inFlightRequests) {
    console.log(`[API Cache] Request already in flight for playernames ${projectId}, waiting...`);
    return inFlightRequests[requestKey];
  }
  
  const cached = apiCache.playernames[cacheKey];
  
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log(`[API Cache] Using cached playernames for project ${projectId}`);
    return cached.data;
  }
  
  console.log(`[API Cache] Fetching playernames for project ${projectId}`);
  
  // Create the request promise and store it
  const requestPromise = fetch(`http://localhost:8000/playernames?project_id=${projectId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch playernames: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache the data
      apiCache.playernames[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      return data;
    })
    .finally(() => {
      // Clear the in-flight request
      delete inFlightRequests[requestKey];
    });
  
  // Store the in-flight request
  inFlightRequests[requestKey] = requestPromise;
  
  return requestPromise;
}

// Cached fetch function for jersey numbers
export async function fetchJerseyNumbersWithCache(projectId: string, teamId: string): Promise<{ [playerId: string]: string }> {
  const cacheKey = `${projectId}_${teamId}`;
  const requestKey = `jerseyNumbers_${cacheKey}`;
  
  // Check if request is already in flight
  if (requestKey in inFlightRequests) {
    console.log(`[API Cache] Request already in flight for jersey numbers ${cacheKey}, waiting...`);
    return inFlightRequests[requestKey];
  }
  
  const cached = apiCache.jerseyNumbers[cacheKey];
  
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log(`[API Cache] Using cached jersey numbers for ${cacheKey}`);
    return cached.data;
  }
  
  console.log(`[API Cache] Fetching jersey numbers for team ${teamId} in project ${projectId}`);
  
  // Create the request promise and store it
  const requestPromise = fetch(`http://localhost:8000/players/jersey-numbers/${teamId}?project_id=${projectId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch jersey numbers: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Cache the data
      apiCache.jerseyNumbers[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      return data;
    })
    .finally(() => {
      // Clear the in-flight request
      delete inFlightRequests[requestKey];
    });
  
  // Store the in-flight request
  inFlightRequests[requestKey] = requestPromise;
  
  return requestPromise;
}

// Clear cache for a specific project
export function clearProjectCache(projectId: string) {
  delete apiCache.formations[projectId];
  delete apiCache.teamsheets[projectId];
  delete apiCache.players[projectId];
  delete apiCache.playernames[projectId];
  
  // Clear jersey numbers for this project
  Object.keys(apiCache.jerseyNumbers).forEach(key => {
    if (key.startsWith(`${projectId}_`)) {
      delete apiCache.jerseyNumbers[key];
    }
  });
}

// Clear all cache
export function clearAllCache() {
  Object.keys(apiCache.formations).forEach(key => delete apiCache.formations[key]);
  Object.keys(apiCache.teamsheets).forEach(key => delete apiCache.teamsheets[key]);
  Object.keys(apiCache.players).forEach(key => delete apiCache.players[key]);
  Object.keys(apiCache.playernames).forEach(key => delete apiCache.playernames[key]);
  Object.keys(apiCache.jerseyNumbers).forEach(key => delete apiCache.jerseyNumbers[key]);
}