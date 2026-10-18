import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyCursorStyles } from "./game/cursors";
import "./styles.css";

applyCursorStyles();

// Dev builds only: lets a browser console or test script drive the city (e.g. go to a building).
if (import.meta.env.DEV) {
  void import("./game/EventBus").then(({ EventBus }) => Object.assign(window, { atlantis: { EventBus } }));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
