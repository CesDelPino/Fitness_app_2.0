import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handlers to catch production errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Global error:", { message, source, lineno, colno, error });
  const errorDiv = document.createElement("div");
  errorDiv.style.cssText = "position:fixed;top:0;left:0;right:0;padding:16px;background:#fee;color:#c00;font-family:monospace;z-index:9999;";
  errorDiv.textContent = `Error: ${message} at ${source}:${lineno}`;
  document.body.prepend(errorDiv);
};

window.onunhandledrejection = (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  const errorDiv = document.createElement("div");
  errorDiv.style.cssText = "position:fixed;top:0;left:0;right:0;padding:16px;background:#fee;color:#c00;font-family:monospace;z-index:9999;";
  errorDiv.textContent = `Unhandled Promise: ${event.reason?.message || event.reason}`;
  document.body.prepend(errorDiv);
};

// Unregister any existing service workers to prevent caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
