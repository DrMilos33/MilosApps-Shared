const CONTRACT_ID = "public-app-shell/v2";
const CONTRACT_VERSION = "2.0.2";
const ELEMENT_NAME = "milos-app-shell";
const LOCALE_EVENT = "milosapps:localechange";

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

const THEME_PROPERTIES = Object.freeze({
  accent: "--milos-shell-accent",
  accentContrast: "--milos-shell-accent-contrast",
  surface: "--milos-shell-surface",
  text: "--milos-shell-text",
  muted: "--milos-shell-muted",
  border: "--milos-shell-border",
  focus: "--milos-shell-focus"
});

const GLOBAL_STYLE = `
  body[data-milos-app-shell-page] {
    min-width: 0;
    min-height: 100%;
    margin: 0;
  }
`;

const COMPONENT_STYLE = `
  :host {
    --milos-shell-accent: #315bdb;
    --milos-shell-accent-contrast: #ffffff;
    --milos-shell-surface: #ffffff;
    --milos-shell-text: #172033;
    --milos-shell-muted: #5f6b7a;
    --milos-shell-border: #d7dce5;
    --milos-shell-focus: #cf4f00;
    --milos-shell-content-max: 72rem;
    --milos-shell-gutter: clamp(1rem, 3vw, 2rem);
    --milos-shell-radius: 0.8rem;
    --milos-shell-target: 44px;
    --milos-shell-icon-size: 38px;
    --milos-shell-transition: 160ms ease;
    min-width: 0;
    min-height: 100dvh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    color: var(--milos-shell-text);
    background: var(--milos-shell-surface);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; }
  a { color: inherit; }

  .container {
    width: min(100%, var(--milos-shell-content-max));
    margin-inline: auto;
    padding-inline: var(--milos-shell-gutter);
  }

  .skip {
    position: fixed;
    z-index: 1000;
    inset-block-start: 0.5rem;
    inset-inline-start: 0.5rem;
    min-height: var(--milos-shell-target);
    display: inline-flex;
    align-items: center;
    padding: 0.65rem 1rem;
    border-radius: var(--milos-shell-radius);
    color: var(--milos-shell-accent-contrast);
    background: var(--milos-shell-accent);
    transform: translateY(-160%);
    transition: transform var(--milos-shell-transition);
  }

  .skip:focus { transform: translateY(0); }

  header {
    position: static;
    border-block-end: 1px solid var(--milos-shell-border);
    background: var(--milos-shell-surface);
  }

  .header-inner {
    min-height: 4.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding-block: 0.45rem;
  }

  .brand {
    min-width: 0;
    max-width: 100%;
    min-height: var(--milos-shell-target);
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: inherit;
    font-weight: 780;
    letter-spacing: -0.025em;
    text-decoration: none;
  }

  .app-icon {
    width: var(--milos-shell-icon-size);
    height: var(--milos-shell-icon-size);
    flex: 0 0 var(--milos-shell-icon-size);
    display: inline-grid;
    place-items: center;
    overflow: hidden;
    color: var(--milos-shell-accent);
  }

  ::slotted([slot="app-icon"]) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .wordmark { white-space: nowrap; }

  .dev {
    padding: 0.18rem 0.42rem;
    border: 1px solid color-mix(in srgb, var(--milos-shell-accent) 35%, transparent);
    border-radius: 999px;
    color: var(--milos-shell-accent);
    background: color-mix(in srgb, var(--milos-shell-accent) 9%, transparent);
    font-size: 0.7rem;
    font-weight: 850;
    letter-spacing: 0.09em;
  }

  nav, .languages {
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  nav { justify-content: flex-end; gap: 0.45rem; }
  .languages { gap: 0.3rem; }

  .control {
    min-width: var(--milos-shell-target);
    max-width: 100%;
    min-height: var(--milos-shell-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    padding: 0.55rem 0.72rem;
    border: 1px solid var(--milos-shell-border);
    border-radius: var(--milos-shell-radius);
    color: var(--milos-shell-text);
    background: var(--milos-shell-surface);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 720;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition: border-color var(--milos-shell-transition), background var(--milos-shell-transition);
  }

  .control:hover { border-color: var(--milos-shell-accent); }
  .control[aria-pressed="true"] {
    border-color: var(--milos-shell-accent);
    background: color-mix(in srgb, var(--milos-shell-accent) 12%, var(--milos-shell-surface));
  }

  .flag { width: 1.25rem; height: 0.9rem; flex: 0 0 auto; border-radius: 0.08rem; }
  .arrow { width: 1rem; height: 1rem; flex: 0 0 auto; }

  :where(a, button):focus-visible {
    outline: 3px solid var(--milos-shell-focus);
    outline-offset: 3px;
  }

  .main-row { min-width: 0; display: block; }
  ::slotted(main[slot="main"]) {
    width: min(100%, var(--milos-shell-content-max));
    min-width: 0;
    margin-inline: auto;
    padding-inline: var(--milos-shell-gutter);
    box-sizing: border-box;
  }

  footer {
    border-block-start: 1px solid var(--milos-shell-border);
    background: var(--milos-shell-surface);
  }

  .footer-inner {
    min-height: 3.65rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem 1.25rem;
    padding-block: 0.3rem;
  }

  .description {
    min-width: 0;
    margin: 0;
    color: var(--milos-shell-muted);
    font-size: 0.84rem;
    line-height: 1.35;
  }

  .footer-nav { gap: 0 0.9rem; }
  .footer-nav a {
    min-height: var(--milos-shell-target);
    display: inline-flex;
    align-items: center;
    color: var(--milos-shell-muted);
    font-size: 0.84rem;
    font-weight: 650;
    text-underline-offset: 0.2em;
  }

  [hidden] { display: none !important; }

  @media (max-width: 35rem) {
    .header-inner { align-items: flex-start; flex-direction: column; }
    .brand { width: 100%; max-width: 100%; flex-wrap: wrap; }
    nav { width: 100%; min-width: 0; justify-content: space-between; }
    .footer-inner { align-items: flex-start; flex-direction: column; gap: 0; }
    .footer-nav { justify-content: flex-start; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

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
    description: Object.freeze({ de: input.description.de, en: input.description.en }),
    theme: Object.freeze({ ...(input.theme || {}) })
  });
}

function ensureGlobalStyle() {
  if (!document.querySelector("style[data-milos-app-shell-global]")) {
    const style = document.createElement("style");
    style.dataset.milosAppShellGlobal = CONTRACT_VERSION;
    style.textContent = GLOBAL_STYLE;
    document.head.append(style);
  }
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
    ensureGlobalStyle();
    this.applyTheme();
    this.render();
    this.bind();
    this.applyLocale(this.readLocale(), false);
  }

  applyTheme() {
    for (const [key, property] of Object.entries(THEME_PROPERTIES)) {
      const value = this.config.theme[key];
      if (typeof value === "string" && value.trim()) this.style.setProperty(property, value);
    }
  }

  render() {
    const links = getShellLinks(this.config.environment);
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${COMPONENT_STYLE}</style>
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
  localeEvent: LOCALE_EVENT
});
