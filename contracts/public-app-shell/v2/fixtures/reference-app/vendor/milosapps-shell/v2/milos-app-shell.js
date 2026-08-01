const CONTRACT_ID = "public-app-shell/v2";
const CONTRACT_VERSION = "2.0.3";
const ELEMENT_NAME = "milos-app-shell";
const LOCALE_EVENT = "milosapps:localechange";
const COMPONENT_STYLESHEET_URL = new URL("./milos-app-shell.css", import.meta.url).href;

const LINKS = Object.freeze({
  dev: Object.freeze({
    home: "https://dev.milos-apps.de/",
    apps: "https://dev.milos-apps.de/apps",
    legal: "https://dev.milos-apps.de/impressum",
    privacy: "https://dev.milos-apps.de/datenschutz"
  }),
  production: Object.freeze({
    home: "https://milos-apps.de/",
    apps: "https://milos-apps.de/apps",
    legal: "https://milos-apps.de/impressum",
    privacy: "https://milos-apps.de/datenschutz"
  })
});

const SHELL_MESSAGES = Object.freeze({
  de: Object.freeze({
    skip: "Zum Inhalt",
    appNav: "App-Navigation",
    languageNav: "Sprache",
    allApps: "Alle Apps",
    legal: "Impressum",
    privacy: "Datenschutz",
    footerNav: "Rechtliches"
  }),
  en: Object.freeze({
    skip: "Skip to content",
    appNav: "App navigation",
    languageNav: "Language",
    allApps: "All apps",
    legal: "Legal notice",
    privacy: "Privacy",
    footerNav: "Legal"
  })
});

let configured = null;

function assertString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function normalizeConfig(input) {
  if (!input || typeof input !== "object") throw new TypeError("Shell config is required");
  assertString(input.appKey, "appKey");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.appKey)) {
    throw new TypeError("appKey must use lowercase kebab-case");
  }
  if (input.environment !== "dev" && input.environment !== "production") {
    throw new TypeError("environment must be dev or production");
  }
  if (input.environment === "production" && input.productionApproved !== true) {
    throw new TypeError("production requires productionApproved=true");
  }
  assertString(input.description?.de, "description.de");
  assertString(input.description?.en, "description.en");
  return Object.freeze({
    appKey: input.appKey,
    environment: input.environment,
    productionApproved: input.productionApproved === true,
    description: Object.freeze({ de: input.description.de, en: input.description.en })
  });
}

function ensurePageMarker() {
  document.body?.setAttribute("data-milos-app-shell-page", "");
}

function germanFlag() {
  return `<svg class="flag" viewBox="0 0 30 18" aria-hidden="true" focusable="false"><path fill="#000" d="M0 0h30v6H0z"/><path fill="#d00" d="M0 6h30v6H0z"/><path fill="#ffce00" d="M0 12h30v6H0z"/></svg>`;
}

function ukFlag() {
  return `<svg class="flag" viewBox="0 0 60 36" aria-hidden="true" focusable="false"><path fill="#012169" d="M0 0h60v36H0z"/><path stroke="#fff" stroke-width="7" d="m0 0 60 36M60 0 0 36"/><path stroke="#c8102e" stroke-width="3.5" d="m0 0 60 36M60 0 0 36"/><path stroke="#fff" stroke-width="12" d="M30 0v36M0 18h60"/><path stroke="#c8102e" stroke-width="7" d="M30 0v36M0 18h60"/></svg>`;
}

function arrowIcon() {
  return `<svg class="arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function getShellLinks(environment) {
  if (!(environment in LINKS)) throw new TypeError("Unknown shell environment");
  return LINKS[environment];
}

class MilosAppShell extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    if (!configured) throw new Error("Call registerMilosAppShell(config) before connecting the shell");
    this.config = configured;
    this.dataset.milosAppKey = this.config.appKey;
    ensurePageMarker();
    this.render();
    this.bind();
    this.applyLocale(this.readLocale(), false);
  }

  render() {
    const links = getShellLinks(this.config.environment);
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${COMPONENT_STYLESHEET_URL}" data-milos-app-shell-component="${CONTRACT_VERSION}">
      <a class="skip" href="#main" data-text="skip">Zum Inhalt</a>
      <header>
        <div class="container header-inner">
          <a class="brand" href="${links.home}">
            <span class="app-icon" aria-hidden="true"><slot name="app-icon"></slot></span>
            <span class="wordmark">MilosApps</span>
            <span class="dev" ${this.config.environment === "dev" ? "" : "hidden"}>DEV</span>
          </a>
          <nav data-label="appNav" aria-label="App-Navigation">
            <div class="languages" role="group" data-label="languageNav" aria-label="Sprache">
              <button class="control" type="button" data-locale="de" aria-pressed="true">
                ${germanFlag()}<span>DE</span>
              </button>
              <button class="control" type="button" data-locale="en" aria-pressed="false">
                ${ukFlag()}<span>EN</span>
              </button>
            </div>
            <a class="control" href="${links.apps}"><span data-text="allApps">Alle Apps</span>${arrowIcon()}</a>
          </nav>
        </div>
      </header>
      <div class="main-row"><slot name="main"></slot></div>
      <footer>
        <div class="container footer-inner">
          <p class="description"></p>
          <nav class="footer-nav" data-label="footerNav" aria-label="Rechtliches">
            <a href="${links.legal}" data-text="legal">Impressum</a>
            <a href="${links.privacy}" data-text="privacy">Datenschutz</a>
            <a href="${links.home}">MilosApps</a>
          </nav>
        </div>
      </footer>
    `;
  }

  bind() {
    this.shadowRoot.querySelectorAll("[data-locale]").forEach((button) => {
      button.addEventListener("click", () => this.applyLocale(button.dataset.locale));
    });
    this.shadowRoot.querySelector(".skip").addEventListener("click", (event) => {
      const main = this.querySelector('main[slot="main"]');
      if (!main) return;
      event.preventDefault();
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
      main.scrollIntoView({ block: "start" });
    });
  }

  readLocale() {
    try {
      return localStorage.getItem(`milosapps.${this.config.appKey}.language`) === "en" ? "en" : "de";
    } catch {
      return "de";
    }
  }

  applyLocale(locale, persist = true) {
    const selected = locale === "en" ? "en" : "de";
    const messages = SHELL_MESSAGES[selected];
    document.documentElement.lang = selected;
    this.shadowRoot.querySelectorAll("[data-text]").forEach((element) => {
      element.textContent = messages[element.dataset.text];
    });
    this.shadowRoot.querySelectorAll("[data-label]").forEach((element) => {
      element.setAttribute("aria-label", messages[element.dataset.label]);
    });
    this.shadowRoot.querySelector(".description").textContent = this.config.description[selected];
    this.shadowRoot.querySelectorAll("[data-locale]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.locale === selected));
    });
    if (persist) {
      try {
        localStorage.setItem(`milosapps.${this.config.appKey}.language`, selected);
      } catch {
        // Persistenz ist Komfort; die aktive Sprachwahl bleibt funktionsfähig.
      }
    }
    const dispatchLocale = () => {
      this.dispatchEvent(new CustomEvent(LOCALE_EVENT, {
        detail: Object.freeze({ locale: selected, appKey: this.config.appKey }),
        bubbles: true,
        composed: true
      }));
    };
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", dispatchLocale, { once: true });
    } else {
      window.setTimeout(dispatchLocale, 0);
    }
  }
}

export function registerMilosAppShell(config) {
  configured = normalizeConfig(config);
  ensurePageMarker();
  if (!customElements.get(ELEMENT_NAME)) customElements.define(ELEMENT_NAME, MilosAppShell);
  return Object.freeze({
    id: CONTRACT_ID,
    version: CONTRACT_VERSION,
    appKey: configured.appKey,
    environment: configured.environment
  });
}

export const publicAppShell = Object.freeze({
  id: CONTRACT_ID,
  version: CONTRACT_VERSION,
  elementName: ELEMENT_NAME,
  localeEvent: LOCALE_EVENT,
  componentStylesheet: COMPONENT_STYLESHEET_URL
});
