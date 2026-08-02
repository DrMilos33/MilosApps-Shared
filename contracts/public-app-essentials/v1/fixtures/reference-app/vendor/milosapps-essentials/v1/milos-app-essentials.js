const CONTRACT_ID = "public-app-essentials/v1";
const CONTRACT_VERSION = "1.0.0";
const LOCALE_EVENT = "milosapps:localechange";
const READY_EVENT = "milosapps:ready";

const COPY = Object.freeze({
  de: Object.freeze({
    privacyTitle: "Datenschutz & Cookies",
    noCookies: "Keine Werbe- oder Tracking-Cookies. Sprache und Einstellungen können lokal auf diesem Gerät gespeichert werden.",
    noCookiesNoStorage: "Keine Werbe- oder Tracking-Cookies und keine lokale Profilerstellung.",
    essentialOnly: "Es werden nur technisch notwendige Cookies verwendet. Werbung und Tracking bleiben ausgeschaltet.",
    understood: "Verstanden",
    privacy: "Datenschutz",
    share: "Teilen",
    shared: "Geteilt",
    copied: "Link kopiert",
    shareFailed: "Teilen war nicht möglich",
    year: "Jahr wählen",
    today: "Heute",
    dateHint: "Datum direkt eingeben oder im Kalender wählen.",
    placeLabel: "Ort oder Region",
    placePlaceholder: "z. B. Köln, Bayern oder London",
    search: "Suchen",
    useLocation: "Meinen Ort verwenden",
    searching: "Orte werden gesucht …",
    locating: "Standort wird bestimmt …",
    noResults: "Kein passender Ort gefunden.",
    searchFailed: "Die Ortssuche ist gerade nicht erreichbar.",
    providerMissing: "Die App hat keine Ortssuche verbunden."
  }),
  en: Object.freeze({
    privacyTitle: "Privacy & cookies",
    noCookies: "No advertising or tracking cookies. Language and settings may be stored locally on this device.",
    noCookiesNoStorage: "No advertising or tracking cookies and no local profiling.",
    essentialOnly: "Only technically necessary cookies are used. Advertising and tracking stay disabled.",
    understood: "Got it",
    privacy: "Privacy",
    share: "Share",
    shared: "Shared",
    copied: "Link copied",
    shareFailed: "Sharing was not possible",
    year: "Choose year",
    today: "Today",
    dateHint: "Enter a date directly or choose it in the calendar.",
    placeLabel: "Place or region",
    placePlaceholder: "e.g. Cologne, Bavaria or London",
    search: "Search",
    useLocation: "Use my location",
    searching: "Searching for places …",
    locating: "Getting your location …",
    noResults: "No matching place found.",
    searchFailed: "Place search is currently unavailable.",
    providerMissing: "The app has not connected a place search."
  })
});

let activeConfig = null;
let activeLocale = "de";
let privacyVisible = false;

function normalizeLocale(value) {
  return value === "en" ? "en" : "de";
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
}

function normalizeConfig(input) {
  if (!input || typeof input !== "object") throw new TypeError("Essentials config is required");
  assertString(input.appKey, "appKey");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.appKey)) throw new TypeError("Invalid appKey");
  if (input.environment !== "dev" && input.environment !== "production") throw new TypeError("Invalid environment");
  if (input.environment === "dev" && input.productionApproved !== false) throw new TypeError("DEV requires productionApproved=false");
  if (input.environment === "production" && input.productionApproved !== true) throw new TypeError("Production requires explicit approval");
  if (input.privacy?.mode !== "no-cookies" && input.privacy?.mode !== "essential-only") throw new TypeError("Unsupported privacy mode");
  if (input.privacy?.optionalTracking !== false) throw new TypeError("Optional tracking is forbidden by public-app-essentials/v1");
  if (!/^https:\/\//.test(input.privacy?.privacyUrl || "")) throw new TypeError("privacyUrl must use HTTPS");
  assertString(input.loading?.appName, "loading.appName");
  assertString(input.loading?.message?.de, "loading.message.de");
  assertString(input.loading?.message?.en, "loading.message.en");
  return Object.freeze({
    appKey: input.appKey,
    environment: input.environment,
    productionApproved: input.productionApproved === true,
    loading: Object.freeze({ appName: input.loading.appName, message: Object.freeze({ ...input.loading.message }) }),
    privacy: Object.freeze({
      mode: input.privacy.mode,
      usesLocalStorage: input.privacy.usesLocalStorage === true,
      optionalTracking: false,
      privacyUrl: input.privacy.privacyUrl
    }),
    features: Object.freeze({ ...input.features })
  });
}

function localeCopy() {
  return COPY[activeLocale];
}

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Local persistence is optional comfort. */ }
}

function iconShare() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" stroke-linecap="round"/></svg>';
}

function dispatchLocale() {
  document.querySelectorAll("milos-share-button, milos-date-picker, milos-place-search").forEach((element) => {
    element.setLocale?.(activeLocale);
  });
  updateLoadingCopy();
  updatePrivacyCopy();
}

function updateLoadingCopy() {
  if (!activeConfig) return;
  document.querySelectorAll("[data-milos-app-loading]").forEach((loader) => {
    const title = loader.querySelector("[data-milos-loading-title]");
    const message = loader.querySelector("[data-milos-loading-message]");
    if (title) title.textContent = activeConfig.loading.appName;
    if (message) message.textContent = activeConfig.loading.message[activeLocale];
    loader.setAttribute("aria-label", activeConfig.loading.message[activeLocale]);
  });
}

function privacyMessage() {
  const copy = localeCopy();
  if (activeConfig.privacy.mode === "essential-only") return copy.essentialOnly;
  return activeConfig.privacy.usesLocalStorage ? copy.noCookies : copy.noCookiesNoStorage;
}

function updatePrivacyCopy() {
  const notice = document.querySelector("[data-milos-privacy-notice]");
  if (!notice || !activeConfig) return;
  const copy = localeCopy();
  notice.setAttribute("aria-label", copy.privacyTitle);
  notice.querySelector("[data-milos-privacy-title]").textContent = copy.privacyTitle;
  notice.querySelector("[data-milos-privacy-message]").textContent = privacyMessage();
  notice.querySelector("[data-milos-privacy-dismiss]").textContent = copy.understood;
  notice.querySelector("[data-milos-privacy-link]").textContent = copy.privacy;
}

function privacyStorageKey() {
  return `milosapps.${activeConfig.appKey}.privacyNotice.v1`;
}

function showPrivacyNotice() {
  const dismissed = activeConfig?.privacy?.usesLocalStorage && storageGet(privacyStorageKey()) === "dismissed";
  if (!activeConfig?.features?.privacyNotice || privacyVisible || dismissed) return;
  privacyVisible = true;
  const notice = document.createElement("section");
  notice.dataset.milosPrivacyNotice = "";
  notice.setAttribute("role", "region");

  const copyWrap = document.createElement("div");
  copyWrap.dataset.milosPrivacyCopy = "";
  const title = document.createElement("strong");
  title.dataset.milosPrivacyTitle = "";
  const message = document.createElement("p");
  message.dataset.milosPrivacyMessage = "";
  copyWrap.append(title, message);

  const actions = document.createElement("div");
  actions.dataset.milosPrivacyActions = "";
  const privacyLink = document.createElement("a");
  privacyLink.className = "milos-essential-button";
  privacyLink.dataset.milosPrivacyLink = "";
  privacyLink.href = activeConfig.privacy.privacyUrl;
  const dismiss = document.createElement("button");
  dismiss.className = "milos-essential-button";
  dismiss.dataset.milosPrivacyDismiss = "";
  dismiss.dataset.primary = "";
  dismiss.type = "button";
  dismiss.addEventListener("click", () => {
    if (activeConfig.privacy.usesLocalStorage) storageSet(privacyStorageKey(), "dismissed");
    privacyVisible = false;
    notice.remove();
  });
  actions.append(privacyLink, dismiss);
  notice.append(copyWrap, actions);
  document.body.append(notice);
  updatePrivacyCopy();
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.className = "milos-copy-fallback";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

export async function shareMilosContent(payload = {}) {
  const title = String(payload.title || document.title || "MilosApps");
  const text = String(payload.text || "");
  const url = String(payload.url || window.location.href);
  const files = Array.isArray(payload.files) ? payload.files : [];
  const shareData = { title, text, url, ...(files.length ? { files } : {}) };
  const canShareFiles = !files.length || !navigator.canShare || navigator.canShare({ files });
  if (window.isSecureContext && navigator.share && canShareFiles) {
    await navigator.share(shareData);
    return Object.freeze({ method: "native" });
  }
  await copyText([text, url].filter(Boolean).join("\n"));
  return Object.freeze({ method: "clipboard" });
}

class MilosShareButton extends HTMLElement {
  connectedCallback() {
    if (this.dataset.milosReady === "true") return;
    this.dataset.milosReady = "true";
    this.payloadProvider ??= () => ({ title: document.title, url: window.location.href });
    this.replaceChildren();
    const button = document.createElement("button");
    button.type = "button";
    if (this.hasAttribute("primary")) button.dataset.primary = "";
    button.innerHTML = `${iconShare()}<span data-milos-share-label></span>`;
    const status = document.createElement("span");
    status.dataset.milosShareStatus = "";
    status.setAttribute("aria-live", "polite");
    button.addEventListener("click", () => this.share(button, status));
    this.append(button, status);
    this.setLocale(activeLocale);
  }

  setPayloadProvider(provider) {
    if (typeof provider !== "function") throw new TypeError("Share payload provider must be a function");
    this.payloadProvider = provider;
  }

  async share(button, status) {
    button.disabled = true;
    status.textContent = "";
    try {
      const result = await shareMilosContent(await this.payloadProvider());
      status.textContent = result.method === "native" ? localeCopy().shared : localeCopy().copied;
      this.dispatchEvent(new CustomEvent("milosapps:sharecomplete", { detail: result, bubbles: true, composed: true }));
    } catch (error) {
      if (error?.name !== "AbortError") {
        status.textContent = localeCopy().shareFailed;
        this.dispatchEvent(new CustomEvent("milosapps:shareerror", { detail: { error }, bubbles: true, composed: true }));
      }
    } finally {
      button.disabled = false;
    }
  }

  setLocale(locale) {
    const label = this.querySelector("[data-milos-share-label]");
    if (label) label.textContent = COPY[normalizeLocale(locale)].share;
  }
}

function isoToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function clampIsoDate(value, min, max) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

function replaceYear(value, year) {
  const [oldYear, month, day] = value.split("-").map(Number);
  if (![oldYear, month, day, year].every(Number.isFinite)) return value;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

class MilosDatePicker extends HTMLElement {
  connectedCallback() {
    if (this.dataset.milosReady === "true") return;
    this.dataset.milosReady = "true";
    this.min = this.getAttribute("min") || "1900-01-01";
    this.max = this.getAttribute("max") || "2100-12-31";
    this.currentValue = clampIsoDate(this.getAttribute("value") || isoToday(), this.min, this.max);
    this.render();
    this.setLocale(activeLocale);
  }

  render() {
    this.replaceChildren();
    const id = `milos-date-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    const label = document.createElement("label");
    label.dataset.milosFieldLabel = "";
    label.htmlFor = id;
    label.textContent = this.getAttribute(`label-${activeLocale}`) || this.getAttribute("label") || "Datum";
    const row = document.createElement("div");
    row.dataset.milosDateRow = "";
    const input = document.createElement("input");
    input.id = id;
    input.type = "date";
    input.min = this.min;
    input.max = this.max;
    input.required = this.hasAttribute("required");
    input.value = this.currentValue;
    const year = document.createElement("select");
    year.dataset.milosDateYear = "";
    const firstYear = Number(this.min.slice(0, 4));
    const lastYear = Number(this.max.slice(0, 4));
    for (let value = lastYear; value >= firstYear; value -= 1) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      year.append(option);
    }
    year.value = this.currentValue.slice(0, 4);
    const today = document.createElement("button");
    today.type = "button";
    today.dataset.milosDateToday = "";
    input.addEventListener("change", () => this.commit(input.value, input, year));
    year.addEventListener("change", () => this.commit(replaceYear(input.value || this.currentValue, Number(year.value)), input, year));
    today.addEventListener("click", () => this.commit(clampIsoDate(isoToday(), this.min, this.max), input, year));
    row.append(input, year, today);
    const note = document.createElement("p");
    note.dataset.milosFieldNote = "";
    this.append(label, row, note);
    this.input = input;
    this.yearSelect = year;
    this.todayButton = today;
    this.note = note;
  }

  commit(value, input = this.input, year = this.yearSelect) {
    const normalized = clampIsoDate(value, this.min, this.max);
    if (!normalized) return;
    this.currentValue = normalized;
    input.value = normalized;
    year.value = normalized.slice(0, 4);
    this.setAttribute("value", normalized);
    this.dispatchEvent(new CustomEvent("milosapps:datechange", { detail: Object.freeze({ value: normalized }), bubbles: true, composed: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  get value() { return this.currentValue || ""; }
  set value(value) { if (this.input) this.commit(String(value)); else this.setAttribute("value", String(value)); }

  setLocale(locale) {
    const copy = COPY[normalizeLocale(locale)];
    const label = this.querySelector("[data-milos-field-label]");
    if (label) label.textContent = this.getAttribute(`label-${normalizeLocale(locale)}`) || this.getAttribute("label") || (locale === "en" ? "Date" : "Datum");
    if (this.yearSelect) this.yearSelect.setAttribute("aria-label", copy.year);
    if (this.todayButton) this.todayButton.textContent = copy.today;
    if (this.note) this.note.textContent = copy.dateHint;
  }
}

function normalizePlace(value) {
  if (!value || typeof value !== "object") return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const name = String(value.name || "").trim();
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return Object.freeze({
    id: String(value.id || `${latitude.toFixed(5)},${longitude.toFixed(5)}`),
    name,
    region: String(value.region || "").trim(),
    country: String(value.country || "").trim(),
    countryCode: String(value.countryCode || "").trim().toUpperCase(),
    type: String(value.type || "place").trim(),
    latitude,
    longitude,
    ...(value.timeZone ? { timeZone: String(value.timeZone) } : {})
  });
}

export function normalizeMilosPlaceResults(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(normalizePlace)
    .filter(Boolean)
    .filter((place) => {
      const key = `${place.name.toLocaleLowerCase()}|${place.region.toLocaleLowerCase()}|${place.countryCode}|${place.latitude.toFixed(3)}|${place.longitude.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

class MilosPlaceSearch extends HTMLElement {
  connectedCallback() {
    if (this.dataset.milosReady === "true") return;
    this.dataset.milosReady = "true";
    this.results = [];
    this.activeIndex = -1;
    this.render();
    this.setLocale(activeLocale);
  }

  setSearchProvider(provider) {
    if (typeof provider !== "function") throw new TypeError("Place search provider must be a function");
    this.searchProvider = provider;
  }

  setLocateProvider(provider) {
    if (typeof provider !== "function") throw new TypeError("Location provider must be a function");
    this.locateProvider = provider;
    if (this.locateButton) this.locateButton.hidden = false;
  }

  render() {
    this.replaceChildren();
    const id = `milos-place-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    const listId = `${id}-list`;
    const label = document.createElement("label");
    label.dataset.milosFieldLabel = "";
    label.htmlFor = id;
    const row = document.createElement("div");
    row.dataset.milosPlaceRow = "";
    const input = document.createElement("input");
    input.id = id;
    input.type = "search";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    const search = document.createElement("button");
    search.type = "button";
    search.dataset.milosPlaceSearchButton = "";
    row.append(input, search);
    const locate = document.createElement("button");
    locate.type = "button";
    locate.dataset.milosPlaceLocate = "";
    locate.hidden = true;
    const results = document.createElement("div");
    results.id = listId;
    results.dataset.milosPlaceResults = "";
    results.setAttribute("role", "listbox");
    results.hidden = true;
    const status = document.createElement("p");
    status.dataset.milosPlaceStatus = "";
    status.setAttribute("aria-live", "polite");
    input.addEventListener("input", () => {
      this.renderResults([]);
      this.status.textContent = "";
    });
    input.addEventListener("keydown", (event) => this.onKeyDown(event));
    search.addEventListener("click", () => this.runSearch());
    locate.addEventListener("click", () => this.runLocate());
    this.append(label, row, locate, results, status);
    this.label = label;
    this.input = input;
    this.searchButton = search;
    this.locateButton = locate;
    this.resultsElement = results;
    this.status = status;
  }

  async runSearch() {
    const query = this.input.value.trim().replace(/\s+/g, " ");
    if (query.length < 2) {
      this.renderResults([]);
      this.status.textContent = "";
      return;
    }
    if (!this.searchProvider) {
      this.status.textContent = localeCopy().providerMissing;
      return;
    }
    this.controller?.abort();
    this.controller = new AbortController();
    this.setBusy(true, localeCopy().searching);
    try {
      const values = await this.searchProvider({ query, locale: activeLocale, signal: this.controller.signal });
      this.results = normalizeMilosPlaceResults(values);
      this.renderResults(this.results);
      this.status.textContent = this.results.length ? "" : localeCopy().noResults;
    } catch (error) {
      if (error?.name !== "AbortError") this.status.textContent = localeCopy().searchFailed;
    } finally {
      this.setBusy(false);
    }
  }

  async runLocate() {
    if (!this.locateProvider) return;
    this.setBusy(true, localeCopy().locating);
    try {
      const place = normalizePlace(await this.locateProvider({ locale: activeLocale }));
      if (!place) throw new Error("Invalid located place");
      this.select(place);
    } catch (error) {
      if (error?.name !== "AbortError") this.status.textContent = localeCopy().searchFailed;
    } finally {
      this.setBusy(false);
    }
  }

  setBusy(value, message = "") {
    this.input.setAttribute("aria-busy", String(value));
    this.searchButton.disabled = value;
    this.locateButton.disabled = value;
    if (value) this.status.textContent = message;
  }

  renderResults(results) {
    this.results = results;
    this.resultsElement.replaceChildren();
    this.activeIndex = -1;
    results.forEach((place, index) => {
      const option = document.createElement("div");
      option.id = `${this.resultsElement.id}-${index}`;
      option.dataset.milosPlaceOption = "";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.tabIndex = -1;
      const name = document.createElement("strong");
      name.textContent = place.name;
      const context = document.createElement("small");
      context.textContent = [place.region, place.country].filter(Boolean).join(" · ");
      option.append(name, context);
      option.addEventListener("mousedown", (event) => event.preventDefault());
      option.addEventListener("click", () => this.select(place));
      this.resultsElement.append(option);
    });
    const visible = results.length > 0;
    this.resultsElement.hidden = !visible;
    this.input.setAttribute("aria-expanded", String(visible));
    this.input.removeAttribute("aria-activedescendant");
  }

  onKeyDown(event) {
    if (!this.results.length) {
      if (event.key === "Enter") { event.preventDefault(); this.runSearch(); }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      this.activeIndex = (this.activeIndex + direction + this.results.length) % this.results.length;
      this.highlight();
    } else if (event.key === "Enter" && this.activeIndex >= 0) {
      event.preventDefault();
      this.select(this.results[this.activeIndex]);
    } else if (event.key === "Escape") {
      this.renderResults([]);
    }
  }

  highlight() {
    [...this.resultsElement.children].forEach((option, index) => option.setAttribute("aria-selected", String(index === this.activeIndex)));
    const selected = this.resultsElement.children[this.activeIndex];
    if (selected) {
      this.input.setAttribute("aria-activedescendant", selected.id);
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  select(place) {
    this.input.value = [place.name, place.region].filter(Boolean).join(", ");
    this.renderResults([]);
    this.status.textContent = "";
    this.dispatchEvent(new CustomEvent("milosapps:placechange", { detail: place, bubbles: true, composed: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  setLocale(locale) {
    const selected = normalizeLocale(locale);
    const copy = COPY[selected];
    if (this.label) this.label.textContent = this.getAttribute(`label-${selected}`) || copy.placeLabel;
    if (this.input) this.input.placeholder = this.getAttribute(`placeholder-${selected}`) || copy.placePlaceholder;
    if (this.searchButton) this.searchButton.textContent = copy.search;
    if (this.locateButton) this.locateButton.textContent = copy.useLocation;
  }
}

export function markMilosAppReady() {
  document.querySelectorAll("[data-milos-app-loading]").forEach((loader) => {
    loader.hidden = true;
    loader.setAttribute("aria-hidden", "true");
  });
  document.body?.removeAttribute("data-milos-essentials-loading");
  showPrivacyNotice();
}

export function initMilosAppEssentials(config) {
  activeConfig = normalizeConfig(config);
  activeLocale = normalizeLocale(document.documentElement.lang);
  document.body?.setAttribute("data-milos-essentials-page", "");
  if (activeConfig.features.startup) document.body?.setAttribute("data-milos-essentials-loading", "");
  if (!customElements.get("milos-share-button")) customElements.define("milos-share-button", MilosShareButton);
  if (!customElements.get("milos-date-picker")) customElements.define("milos-date-picker", MilosDatePicker);
  if (!customElements.get("milos-place-search")) customElements.define("milos-place-search", MilosPlaceSearch);
  document.addEventListener(READY_EVENT, markMilosAppReady);
  document.addEventListener(LOCALE_EVENT, (event) => {
    activeLocale = normalizeLocale(event.detail?.locale);
    dispatchLocale();
  });
  updateLoadingCopy();
  dispatchLocale();
  return Object.freeze({
    id: CONTRACT_ID,
    version: CONTRACT_VERSION,
    appKey: activeConfig.appKey,
    ready: markMilosAppReady,
    share: shareMilosContent,
    normalizePlaceResults: normalizeMilosPlaceResults
  });
}

export const publicAppEssentials = Object.freeze({
  id: CONTRACT_ID,
  version: CONTRACT_VERSION,
  localeEvent: LOCALE_EVENT,
  readyEvent: READY_EVENT
});
