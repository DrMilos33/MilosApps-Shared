import { registerMilosAppShell } from "./milos-app-shell.js";

const appKey = "reference-app";
document.body?.setAttribute("data-milos-app-shell-page", "");
const themeUrl = new URL("./milos-app-shell-theme.css", import.meta.url).href;
let themeLink = document.querySelector(`link[data-milos-app-shell-theme="${appKey}"]`);
if (!themeLink) {
  themeLink = document.createElement("link");
  themeLink.rel = "stylesheet";
  themeLink.href = themeUrl;
  themeLink.dataset.milosAppShellTheme = appKey;
  await new Promise((resolve, reject) => {
    themeLink.addEventListener("load", resolve, { once: true });
    themeLink.addEventListener("error", () => reject(new Error("MilosApps shell theme stylesheet failed to load")), { once: true });
    document.head.append(themeLink);
  });
}
registerMilosAppShell({
  "appKey": "reference-app",
  "environment": "dev",
  "productionApproved": false,
  "description": {
    "de": "Eine kompakte Referenz für den gemeinsamen App-Rahmen.",
    "en": "A compact reference for the shared app shell."
  }
});
