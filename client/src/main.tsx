import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import { initBrowserExtensionFix } from "./utils/browserExtensionFix";
import "@/styles/globals.css";

// Initialize browser extension fix before anything else
initBrowserExtensionFix();

// Set dark mode
document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider>
        <App />
      </Provider>
    </BrowserRouter>
  </React.StrictMode>,
);
