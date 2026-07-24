
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

const splash = document.getElementById("agentland-splash");
const connectionLabel = document.getElementById("agentland-connection-label");
if (splash) {
  const apiBase = (import.meta.env.VITE_WORLD_API_URL || "http://127.0.0.1:8787/api").replace(/\/$/, "");
  const minimumDisplay = new Promise(resolve => window.setTimeout(resolve, 5000));
  const networkReady = Promise.race([
    fetch(`${apiBase}/health`, { cache: "no-store" }).then(response => response.ok),
    new Promise<boolean>(resolve => window.setTimeout(() => resolve(false), 1800)),
  ]).catch(() => false);

  Promise.all([minimumDisplay, networkReady]).then(([, connected]) => {
    if (connectionLabel) {
      connectionLabel.textContent = connected
        ? "世界已连接"
        : navigator.onLine
          ? "以本地模式进入"
          : "离线世界已就绪";
    }
    window.setTimeout(() => {
      splash.classList.add("is-leaving");
      window.setTimeout(() => splash.remove(), 420);
    }, 280);
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(registration => {
      registration.update().catch(() => undefined);
    }).catch(() => undefined);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      const reloadKey = "forkworld.pwaReloaded.v3";
      if (window.sessionStorage.getItem(reloadKey)) return;
      window.sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    });
  });
}
