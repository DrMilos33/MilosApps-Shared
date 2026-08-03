import { initMilosAppEssentials } from "./milos-app-essentials.js";

document.body?.setAttribute("data-milos-essentials-app", "reference-app");
export const milosAppEssentials = initMilosAppEssentials({
  "appKey": "reference-app",
  "environment": "dev",
  "productionApproved": false,
  "loading": {
    "appName": "Reiseplaner",
    "iconPath": "icon.svg",
    "iconRuntimePath": "icon.svg",
    "message": {
      "de": "Reiseplaner wird geöffnet …",
      "en": "Opening trip planner …"
    }
  },
  "privacy": {
    "mode": "no-cookies",
    "usesLocalStorage": true,
    "storagePurposes": [
      {
        "key": "milosapps.reference-app.locale",
        "purpose": "Vom Nutzer gewählte Sprache lokal beibehalten",
        "lifetime": "until-user-clears",
        "strictlyNecessary": true
      }
    ],
    "optionalTracking": false,
    "privacyUrl": "https://dev.milos-apps.de/datenschutz"
  },
  "features": {
    "startup": true,
    "privacyNotice": false,
    "share": true,
    "datePicker": true,
    "placeSearch": true,
    "placeSuggestions": {
      "enabled": false,
      "minChars": 3,
      "debounceMs": 350,
      "providerCapability": "submit-only",
      "evidenceFile": null
    }
  }
});
globalThis.milosAppEssentials = milosAppEssentials;
