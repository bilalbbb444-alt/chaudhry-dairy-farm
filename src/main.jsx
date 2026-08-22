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
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
