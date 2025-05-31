import { useState, useEffect } from 'react';
import { HeroUIProvider } from '@heroui/react'; // Added import
import { Navbar } from "@/components/navbar"; // Added Navbar import
import Sidebar from "@/components/Sidebar"; // Import Sidebar component

const EXPANDED_SIDEBAR_WIDTH = 260;
const COLLAPSED_SIDEBAR_WIDTH = 72;
const RIGHT_CONTENT_GAP = '1.5rem'; // Equivalent to Tailwind's spacing unit 6 (e.g., mr-6 or right-6)


export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // CSS Variables mapping (applied via Tailwind):
  // --header-height: 60px -> h-[60px]
  // --sidebar-width: 200px -> w-[200px]
  // --bg-sidebar-header (also body bg): #1e1e1e -> bg-[#1e1e1e]
  // --bg-main: #2c2c2c -> bg-[#2c2c2c]
  // --text-color: #ccc -> text-[#ccc]
  // --border-radius: 12px -> rounded-xl (Tailwind's rounded-xl is 0.75rem = 12px at 16px/rem)
  // --padding: 16px -> p-4 (Tailwind's p-4 is 1rem = 16px at 16px/rem)

  // Initialize from localStorage synchronously to prevent layout shift/animation on page load
  const getSavedCollapsedState = (): boolean => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      console.error('Error reading sidebar collapsed state:', e);
      return false;
    }
  };

  const [isSidebarCurrentlyCollapsed, setIsSidebarCurrentlyCollapsed] = useState(getSavedCollapsedState());
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);
  
  // Enable transitions after initial render to prevent animation on page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setTransitionsEnabled(true);
    }, 100); // Short delay to ensure initial render is complete
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    
    // Listen for direct custom events from Sidebar component
    const handleSidebarStateChange = (event: CustomEvent<{isCollapsed: boolean}>) => {
      setIsSidebarCurrentlyCollapsed(event.detail.isCollapsed);
    };

    // TypeScript needs this type assertion for CustomEvent
    window.addEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);

    return () => {
      window.removeEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    };
  }, []);

  const currentSidebarWidth = isSidebarCurrentlyCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH;
  const mainContentWidthCalc = `calc(100vw - ${currentSidebarWidth}px - ${RIGHT_CONTENT_GAP})`;

  return (
    <HeroUIProvider> {/* Wrapped in HeroUIProvider */}
      {/* Added 'dark' class and moved pr-4 here */}
      <div className="dark min-h-screen bg-[#1e1e1e] text-[#ccc] font-sans">
        <Sidebar />

        {/* Content Area (.content) - pr-4 was moved to parent div */}
        {/* Vertical Flex-container (flex-direction: column; flex: 1) */}
        <div 
          className={`h-screen flex flex-col ${transitionsEnabled ? 'transition-all duration-300 ease-in-out' : ''}`}
          style={{ marginLeft: `${currentSidebarWidth}px` }}
        >
          <header 
            className={`fixed top-0 z-40 bg-[#1e1e1e] ${transitionsEnabled ? 'transition-all duration-300 ease-in-out' : ''}`}
            style={{ 
              left: `${currentSidebarWidth}px`, 
              width: mainContentWidthCalc 
            }}
          >
            <Navbar />
          </header>

          {/* Main */}
          {/* flex: 1. Background var(--bg-main). Rounded corners var(--border-radius). Padding var(--padding). */}
          <main 
            className="bg-[#2c2c2c] rounded-t-xl p-0 mt-[64px] flex-1 overflow-hidden transition-all duration-300 ease-in-out" 
            id="main-content-area"
            style={{ width: mainContentWidthCalc }}
          >
            <div className="h-full w-full overflow-y-auto pr-6 pl-6 pt-0 pb-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </HeroUIProvider>
  );
}
