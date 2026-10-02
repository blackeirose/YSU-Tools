import { createRoot } from "react-dom/client";
import App from "./App";
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/travel-planner/sw.js", { scope: "/travel-planner/" })
      .catch(() => {
        /* app remains usable */
      });
  });
