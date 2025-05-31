/**
 * Browser Extension Message Port Error Fix
 * 
 * This utility helps prevent "Unchecked runtime.lastError: The message port closed 
 * before a response was received" errors that can occur in browser extension contexts.
 */

// Check if we're in a browser extension context
const isExtensionContext = () => {
  return !!(
    (window as any).chrome?.runtime?.id ||
    (window as any).browser?.runtime?.id
  );
};

// Patch chrome.runtime.sendMessage to handle errors gracefully
export const patchBrowserExtensionAPIs = () => {
  if (!isExtensionContext()) {
    return;
  }

  // Patch Chrome runtime API
  if ((window as any).chrome?.runtime?.sendMessage) {
    const originalSendMessage = (window as any).chrome.runtime.sendMessage;
    (window as any).chrome.runtime.sendMessage = function(...args: any[]) {
      try {
        // Add a no-op callback if none provided to prevent unchecked error
        if (args.length === 1 || (args.length === 2 && typeof args[1] !== 'function')) {
          args.push(() => {
            // Check for errors but don't throw
            if ((window as any).chrome.runtime.lastError) {
              console.debug('Chrome runtime error (handled):', (window as any).chrome.runtime.lastError);
            }
          });
        }
        return originalSendMessage.apply(this, args);
      } catch (error) {
        console.debug('Chrome runtime sendMessage error (caught):', error);
      }
    };
  }

  // Patch browser runtime API (Firefox)
  if ((window as any).browser?.runtime?.sendMessage) {
    const originalSendMessage = (window as any).browser.runtime.sendMessage;
    (window as any).browser.runtime.sendMessage = function(...args: any[]) {
      try {
        return originalSendMessage.apply(this, args).catch((error: any) => {
          console.debug('Browser runtime error (handled):', error);
        });
      } catch (error) {
        console.debug('Browser runtime sendMessage error (caught):', error);
      }
    };
  }

  // Add global error handler for uncaught runtime errors
  window.addEventListener('error', (event) => {
    if (event.message?.includes('message port closed') || 
        event.message?.includes('runtime.lastError')) {
      event.preventDefault();
      console.debug('Runtime error prevented:', event.message);
    }
  });

  // Add unhandled rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('message port closed') ||
        event.reason?.message?.includes('runtime.lastError')) {
      event.preventDefault();
      console.debug('Unhandled rejection prevented:', event.reason);
    }
  });
};

// Initialize the patch
export const initBrowserExtensionFix = () => {
  // Run as soon as possible
  patchBrowserExtensionAPIs();
  
  // Also run after DOM is ready in case extensions inject later
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchBrowserExtensionAPIs);
  }
};