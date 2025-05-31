# Fix for Multiple API Calls in React with StrictMode

## Problem
When React StrictMode is enabled (which is the default in React 18+), components are intentionally rendered twice in development mode to help detect side effects. This causes `useEffect` hooks to run twice, resulting in duplicate API calls.

## Solution Implemented

### 1. Custom Hook with Shared State (`useProjects`)
We created a custom hook that shares the projects state across all components that need it. This ensures that:
- Only one API call is made when the app loads
- All components share the same data
- Updates are synchronized across components

**File: `client/src/hooks/useProjects.ts`**
- Uses a module-level shared state
- Prevents duplicate fetches by tracking ongoing requests
- Notifies all listeners when data changes

### 2. Updated Components
Both `Sidebar.tsx` and `index.tsx` now use the `useProjects` hook instead of fetching data independently.

## Alternative Solutions

### Option 1: Disable StrictMode (Not Recommended)
You can disable StrictMode in `client/src/main.tsx`:

```tsx
// Change this:
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider>
        <App />
      </Provider>
    </BrowserRouter>
  </React.StrictMode>,
);

// To this:
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Provider>
      <App />
    </Provider>
  </BrowserRouter>
);
```

**Note:** This is not recommended as StrictMode helps catch bugs early.

### Option 2: Use React Query or SWR
For production applications, consider using a data fetching library like:
- [TanStack Query (React Query)](https://tanstack.com/query/latest)
- [SWR](https://swr.vercel.app/)

These libraries handle:
- Request deduplication
- Caching
- Background refetching
- Error handling
- Loading states

Example with React Query:
```tsx
import { useQuery } from '@tanstack/react-query';

function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('http://localhost:8000/projects');
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Option 3: Use AbortController (Partial Solution)
The AbortController approach we initially tried helps prevent memory leaks but doesn't fully prevent duplicate requests in StrictMode. It's still a good practice to include it.

## Benefits of Current Solution

1. **Single Source of Truth**: All components share the same projects data
2. **Efficient**: Only one API call is made regardless of how many components use the hook
3. **Reactive**: All components update when projects change
4. **Simple**: No additional dependencies required

## Testing

To verify the fix:
1. Open the browser's Network tab
2. Refresh the page
3. You should see only ONE request to `/projects` instead of 2 or 4

## Notes

- The duplicate requests only happen in development mode with StrictMode
- In production builds, StrictMode doesn't cause double rendering
- The shared state approach works well for data that's used across multiple components