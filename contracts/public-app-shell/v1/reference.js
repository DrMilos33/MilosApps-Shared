(() => {
  "use strict";

  const shell = document.querySelector("[data-milos-shell]");
  if (!shell) return;

  const appKey = shell.dataset.appKey || "example-app";
  const environment = shell.dataset.environment === "production" ? "production" : "dev";
  const storageKey = `milosapps.${appKey}.language`;

  const environments = {
    dev: {
      home: "https://dev.milos-apps.de/",
      apps: "https://dev.milos-apps.de/apps",
      legal: "https://dev.milos-apps.de/impressum",
      privacy: "https://dev.milos-apps.de/datenschutz"
    },
    production: {
      home: "https://milos-apps.de/",
      apps: "https://milos-apps.de/apps",
      legal: "https://milos-apps.de/impressum",
      privacy: "https://milos-apps.de/datenschutz"
    }
  };

  const messages = {
    de: {
      documentTitle: "Beispiel-App – MilosApps",
      skip: "Zum Inhalt",
      appNav: "App-Navigation",
      languageNav: "Sprache",
      allApps: "Alle Apps",
      appTitle: "Beispiel-App",
      intro:
        "Der App-Name und die eigentliche Aufgabe bleiben in der Hauptfläche. Der Rahmen bleibt kompakt und nimmt der App nicht ihre Identität.",
      cardTitle: "App-eigener Inhalt",
      cardText:
        "Auch Status, Hinweise und Fehlermeldungen werden vollständig übersetzt.",
      footerText: "Ein kurzer, app-spezifischer Abschlusstext.",
      footerNav: "Rechtliches",
      legal: "Impressum",
      privacy: "Datenschutz"
    },
    en: {
      documentTitle: "Example app – MilosApps",
      skip: "Skip to content",
      appNav: "App navigation",
      languageNav: "Language",
      allApps: "All apps",
      appTitle: "Example app",
      intro:
        "The app name and primary task stay in the main area. The shell remains compact and preserves the app’s own identity.",
      cardTitle: "App-owned content",
      cardText:
        "Statuses, guidance and error messages are translated in full as well.",
      footerText: "A short, app-specific closing note.",
      footerNav: "Legal",
      legal: "Legal notice",
      privacy: "Privacy"
    }
  };

  function readStoredLanguage() {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored === "en" ? "en" : "de";
    } catch {
      return "de";
    }
  }

  function persistLanguage(language) {
    try {
      window.localStorage.setItem(storageKey, language);
    } catch {
      // Persistenz ist Komfort. Die Sprachwahl funktioniert auch ohne Storage.
    }
  }

  function applyEnvironment() {
    const links = environments[environment];

    document.querySelectorAll("[data-shell-link]").forEach((link) => {
      const key = link.dataset.shellLink;
      if (links[key]) link.href = links[key];
    });

    document.querySelectorAll("[data-dev-only]").forEach((element) => {
      element.hidden = environment !== "dev";
    });
  }

  function applyLanguage(language, persist = true) {
    const selected = messages[language] ? language : "de";
    const dictionary = messages[selected];

    document.documentElement.lang = selected;
    document.title = dictionary.documentTitle;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (dictionary[key]) element.textContent = dictionary[key];
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      const key = element.dataset.i18nAriaLabel;
      if (dictionary[key]) element.setAttribute("aria-label", dictionary[key]);
    });

    document.querySelectorAll("[data-language]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.language === selected)
      );
    });

    if (persist) persistLanguage(selected);
  }

  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      applyLanguage(button.dataset.language || "de");
    });
  });

  applyEnvironment();
  applyLanguage(readStoredLanguage(), false);
})();
