import { registerMilosAppShell } from "./milos-app-shell.js";

registerMilosAppShell({
  "appKey": "reference-app",
  "environment": "dev",
  "productionApproved": false,
  "description": {
    "de": "Eine kompakte Referenz für den gemeinsamen App-Rahmen.",
    "en": "A compact reference for the shared app shell."
  },
  "theme": {
    "accent": "#3454d1",
    "accentContrast": "#ffffff",
    "surface": "#fbfcff",
    "text": "#172033",
    "muted": "#5f6b7a",
    "border": "#d8deea",
    "focus": "#c44200"
  }
});
