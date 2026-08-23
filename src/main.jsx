import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./motion.css";

// Once a new service worker takes control (a fresh deploy has landed),
// reload immediately so the tab always shows the latest build instead of
// silently continuing to serve whatever was cached before.
if ("serviceWorker" in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  // On mobile, opening an already-installed app from the home screen often
  // just resumes the existing page instance rather than doing a fresh
  // navigation — so the browser's normal "check for a new service worker"
  // step never runs, and the app can look stuck on an old version until
  // it's reinstalled. Force an explicit update check every time the app
  // becomes visible again (opened, switched back to, or reconnects).
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const checkForUpdate = () => reg.update().catch(() => {});
      checkForUpdate();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("focus", checkForUpdate);
      window.addEventListener("online", checkForUpdate);
    } catch (e) {
      // registration handled by the build-generated script either way
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
