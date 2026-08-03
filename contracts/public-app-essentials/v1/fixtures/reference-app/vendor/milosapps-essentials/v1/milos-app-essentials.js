const CONTRACT_ID = "public-app-essentials/v1";
const CONTRACT_VERSION = "1.1.3";
const LOCALE_EVENT = "milosapps:localechange";
const READY_EVENT = "milosapps:ready";

const COPY = Object.freeze({
  de: Object.freeze({
    privacyTitle: "Technisch notwendige Cookies",
    noCookies: "Keine Werbe- oder Tracking-Cookies. Sprache und Einstellungen können lokal auf diesem Gerät gespeichert werden.",
    noCookiesNoStorage: "Keine Werbe- oder Tracking-Cookies und keine lokale Profilerstellung.",
    essentialOnly: "Es werden nur technisch notwendige Cookies verwendet. Werbung und Tracking bleiben ausgeschaltet.",
    closeNotice: "Hinweis schließen",
    privacy: "Datenschutz",
    share: "Teilen",
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
    privacyTitle: "Technically necessary cookies",
    noCookies: "No advertising or tracking cookies. Language and settings may be stored locally on this device.",
    noCookiesNoStorage: "No advertising or tracking cookies and no local profiling.",
    essentialOnly: "Only technically necessary cookies are used. Advertising and tracking stay disabled.",
    closeNotice: "Close notice",
    privacy: "Privacy",
    share: "Share",
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
let privacyDismissedForDocument = false;

function normalizeLocale(value) {
  return value === "en" ? "en" : "de";
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
}

function validHttpsUrl(value) {
  if (typeof value !== "string" || /\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.replace(/\.$/, "");
    const labels = hostname.split(".");
    return parsed.protocol === "https:"
      && labels.length >= 2
      && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function normalizeStoragePurposes(input, appKey, usesLocalStorage) {
  if (!Array.isArray(input)) throw new TypeError("privacy.storagePurposes is required");
  if (usesLocalStorage && input.length === 0) throw new TypeError("usesLocalStorage=true requires at least one storage purpose");
  if (!usesLocalStorage && input.length > 0) throw new TypeError("storage purposes require usesLocalStorage=true");
  const keys = new Set();
  return Object.freeze(input.map((item) => {
    if (typeof item?.key !== "string" || !item.key.startsWith(`milosapps.${appKey}.`)) throw new TypeError("Storage purpose key must use the app namespace");
    if (keys.has(item.key)) throw new TypeError("Storage purpose keys must be unique");
    keys.add(item.key);
    assertString(item.purpose, "storage purpose");
    if (!["session", "bounded", "until-user-clears"].includes(item.lifetime)) throw new TypeError("Unsupported storage purpose lifetime");
    if (item.strictlyNecessary !== true) throw new TypeError("Optional device storage is forbidden without a separate consent contract");
    return Object.freeze({ key: item.key, purpose: item.purpose.trim(), lifetime: item.lifetime, strictlyNecessary: true });
  }));
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
  if (!validHttpsUrl(input.privacy?.privacyUrl)) throw new TypeError("privacyUrl must be an absolute HTTPS URL with a valid host and no credentials");
  const usesLocalStorage = input.privacy.usesLocalStorage === true;
  const storagePurposes = normalizeStoragePurposes(input.privacy.storagePurposes, input.appKey, usesLocalStorage);
  if (input.features?.startup !== true) throw new TypeError("Startup is required for public apps");
  if (input.features?.share !== true) throw new TypeError("Share is required for public apps");
  if (input.privacy.mode === "no-cookies" && input.features?.privacyNotice !== false) throw new TypeError("no-cookies requires privacyNotice=false");
  if (input.privacy.mode === "essential-only" && input.features?.privacyNotice !== true) throw new TypeError("essential-only requires privacyNotice=true");
  const placeSuggestions = input.features?.placeSuggestions;
  if (!placeSuggestions || typeof placeSuggestions !== "object") throw new TypeError("features.placeSuggestions is required");
  if (!Number.isInteger(placeSuggestions.minChars) || placeSuggestions.minChars < 2 || placeSuggestions.minChars > 6) throw new TypeError("placeSuggestions.minChars must be between 2 and 6");
  if (!Number.isInteger(placeSuggestions.debounceMs) || placeSuggestions.debounceMs < 200 || placeSuggestions.debounceMs > 1000) throw new TypeError("placeSuggestions.debounceMs must be between 200 and 1000");
  if (placeSuggestions.enabled && placeSuggestions.providerCapability !== "consumer-autocomplete-proxy") throw new TypeError("enabled place suggestions require a consumer autocomplete proxy");
  if (!placeSuggestions.enabled && placeSuggestions.providerCapability !== "submit-only") throw new TypeError("disabled place suggestions require submit-only mode");
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
      usesLocalStorage,
      storagePurposes,
      optionalTracking: false,
      privacyUrl: input.privacy.privacyUrl
    }),
    features: Object.freeze({
      ...input.features,
      placeSuggestions: Object.freeze({
        enabled: placeSuggestions.enabled === true,
        minChars: placeSuggestions.minChars,
        debounceMs: placeSuggestions.debounceMs,
        providerCapability: placeSuggestions.providerCapability,
        evidenceFile: placeSuggestions.evidenceFile ?? null
      })
    })
  });
}

function localeCopy() {
  return COPY[activeLocale];
}

function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
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
  notice.querySelector("[data-milos-privacy-dismiss]").setAttribute("aria-label", copy.closeNotice);
  notice.querySelector("[data-milos-privacy-dismiss]").setAttribute("title", copy.closeNotice);
  notice.querySelector("[data-milos-privacy-link]").textContent = copy.privacy;
}

function showPrivacyNotice() {
  if (activeConfig?.privacy?.mode === "no-cookies") return;
  if (!activeConfig?.features?.privacyNotice || privacyVisible || privacyDismissedForDocument) return;
  privacyVisible = true;
  const notice = document.createElement("aside");
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
  dismiss.type = "button";
  dismiss.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke-linecap="round"/></svg>';
  dismiss.addEventListener("click", () => {
    privacyVisible = false;
    privacyDismissedForDocument = true;
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

export class MilosShareButton extends HTMLElement {
  connectedCallback() {
    this.connectionEpoch = (this.connectionEpoch || 0) + 1;
    if (this.dataset.milosReady === "true") {
      this.setLocale(activeLocale);
      return;
    }
    this.dataset.milosReady = "true";
    this.payloadProvider ??= () => ({ title: document.title, url: window.location.href });
    this.replaceChildren();
    const button = document.createElement("button");
    button.type = "button";
    if (this.hasAttribute("primary")) button.dataset.primary = "";
    button.innerHTML = `${iconShare()}<span data-milos-share-label></span>`;
    const status = document.createElement("span");
    status.dataset.milosShareStatus = "";
    status.dataset.visible = "false";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("role", "status");
    button.addEventListener("click", () => this.share(button, status));
    this.append(button, status);
    this.setLocale(activeLocale);
  }

  setPayloadProvider(provider) {
    if (typeof provider !== "function") throw new TypeError("Share payload provider must be a function");
    this.payloadProvider = provider;
  }

  disconnectedCallback() {
    this.connectionEpoch = (this.connectionEpoch || 0) + 1;
    this.shareOperationId = (this.shareOperationId || 0) + 1;
    clearTimeout(this.statusDisplayTimer);
    clearTimeout(this.statusClearTimer);
    const status = this.querySelector("[data-milos-share-status]");
    const button = this.querySelector("button");
    if (status) this.resetStatus(status);
    if (button) button.disabled = false;
  }

  async share(button, status) {
    const operationId = (this.shareOperationId || 0) + 1;
    this.shareOperationId = operationId;
    const connectionEpoch = this.connectionEpoch;
    button.disabled = true;
    this.resetStatus(status);
    try {
      const payload = await this.payloadProvider();
      if (!this.isCurrentShare(operationId, connectionEpoch, button, status)) return;
      const result = await shareMilosContent(payload);
      if (!this.isCurrentShare(operationId, connectionEpoch, button, status)) return;
      if (result.method === "clipboard") this.showStatus(status, localeCopy().copied, "success", operationId, connectionEpoch, button);
      this.dispatchEvent(new CustomEvent("milosapps:sharecomplete", { detail: result, bubbles: true, composed: true }));
    } catch (error) {
      if (this.isCurrentShare(operationId, connectionEpoch, button, status) && error?.name !== "AbortError") {
        this.showStatus(status, localeCopy().shareFailed, "error", operationId, connectionEpoch, button);
        this.dispatchEvent(new CustomEvent("milosapps:shareerror", { detail: { error }, bubbles: true, composed: true }));
      }
    } finally {
      if (this.isCurrentShare(operationId, connectionEpoch, button, status)) button.disabled = false;
    }
  }

  isCurrentShare(operationId, connectionEpoch, button, status) {
    return this.isConnected && this.connectionEpoch === connectionEpoch && this.shareOperationId === operationId && button.isConnected && status.isConnected;
  }

  showStatus(status, message, tone, operationId, connectionEpoch, button) {
    clearTimeout(this.statusDisplayTimer);
    clearTimeout(this.statusClearTimer);
    status.textContent = message;
    status.dataset.tone = tone;
    status.dataset.visible = "true";
    this.statusDisplayTimer = setTimeout(() => {
      if (this.isCurrentShare(operationId, connectionEpoch, button, status)) this.hideStatus(status);
    }, 2200);
  }

  hideStatus(status, immediate = false) {
    clearTimeout(this.statusDisplayTimer);
    clearTimeout(this.statusClearTimer);
    status.dataset.visible = "false";
    status.removeAttribute("data-tone");
    if (immediate) status.textContent = "";
    else this.statusClearTimer = setTimeout(() => { status.textContent = ""; }, 180);
  }

  resetStatus(status) {
    clearTimeout(this.statusDisplayTimer);
    clearTimeout(this.statusClearTimer);
    status.textContent = "";
    status.dataset.visible = "false";
    status.removeAttribute("data-tone");
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

function validIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendar = new Date(0);
  calendar.setUTCHours(0, 0, 0, 0);
  calendar.setUTCFullYear(year, month - 1, day);
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
}

function clampIsoDate(value, min, max) {
  if (!validIsoDate(value)) return "";
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

function replaceYear(value, year) {
  const [oldYear, month, day] = value.split("-").map(Number);
  if (![oldYear, month, day, year].every(Number.isFinite)) return value;
  const calendar = new Date(0);
  calendar.setUTCHours(0, 0, 0, 0);
  calendar.setUTCFullYear(year, month, 0);
  const lastDay = calendar.getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export class MilosDatePicker extends HTMLElement {
  connectedCallback() {
    if (this.dataset.milosReady === "true") {
      this.setLocale(activeLocale);
      return;
    }
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
    input.dataset.milosDateInput = "";
    input.id = id;
    input.type = "date";
    input.min = this.min;
    input.max = this.max;
    input.required = this.hasAttribute("required");
    input.value = this.currentValue;
    const year = document.createElement("select");
    year.dataset.milosDateYear = "";
    const emptyYear = document.createElement("option");
    emptyYear.value = "";
    emptyYear.textContent = "—";
    year.append(emptyYear);
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
    input.addEventListener("change", (event) => { event.stopPropagation(); this.commit(input.value, input, year); });
    year.addEventListener("change", (event) => {
      event.stopPropagation();
      if (!year.value) {
        this.commit("", input, year);
        return;
      }
      const base = input.value || this.currentValue || clampIsoDate(isoToday(), this.min, this.max);
      this.commit(replaceYear(base, Number(year.value)), input, year);
    });
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
    const requested = String(value || "");
    const normalized = clampIsoDate(requested, this.min, this.max);
    if (requested && !normalized) {
      input.value = this.currentValue || "";
      year.value = this.currentValue?.slice(0, 4) || "";
      return;
    }
    if (normalized === (this.currentValue || "")) {
      input.value = normalized;
      year.value = normalized.slice(0, 4);
      return;
    }
    this.currentValue = normalized;
    input.value = normalized;
    year.value = normalized.slice(0, 4);
    if (normalized) this.setAttribute("value", normalized);
    else this.removeAttribute("value");
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

export class MilosPlaceSearch extends HTMLElement {
  connectedCallback() {
    this.connectionEpoch = (this.connectionEpoch || 0) + 1;
    if (this.dataset.milosReady === "true") {
      this.setLocale(activeLocale);
      return;
    }
    this.dataset.milosReady = "true";
    this.results = [];
    this.activeIndex = -1;
    this.suggestionsConfig = activeConfig?.features?.placeSuggestions || Object.freeze({ enabled: false, minChars: 3, debounceMs: 350 });
    this.suggestionRequestId = 0;
    this.searchRequestId = 0;
    this.locateRequestId = 0;
    this.busyOwners = new Set();
    this.render();
    this.setLocale(activeLocale);
  }

  setSearchProvider(provider) {
    if (typeof provider !== "function") throw new TypeError("Place search provider must be a function");
    this.searchProvider = provider;
  }

  setSuggestionsProvider(provider) {
    if (typeof provider !== "function") throw new TypeError("Place suggestions provider must be a function");
    this.suggestionsProvider = provider;
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
    locate.hidden = !this.locateProvider;
    const results = document.createElement("div");
    results.id = listId;
    results.dataset.milosPlaceResults = "";
    results.setAttribute("role", "listbox");
    results.hidden = true;
    const status = document.createElement("p");
    status.dataset.milosPlaceStatus = "";
    status.setAttribute("aria-live", "polite");
    input.addEventListener("input", () => {
      this.cancelLocate();
      this.cancelSearch();
      this.renderResults([]);
      this.clearOperationStatus();
      this.queueSuggestions();
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
    this.cancelLocate();
    this.cancelSuggestions();
    this.cancelSearch();
    if (query.length < 2) {
      this.renderResults([]);
      this.clearOperationStatus();
      return;
    }
    if (!this.searchProvider) {
      this.setOperationStatus("search", localeCopy().providerMissing);
      return;
    }
    const requestId = this.searchRequestId;
    const connectionEpoch = this.connectionEpoch;
    this.searchController = new AbortController();
    const signal = this.searchController.signal;
    this.beginBusy("search", localeCopy().searching);
    try {
      const values = await this.searchProvider({ query, locale: activeLocale, signal });
      const currentQuery = this.input.value.trim().replace(/\s+/g, " ");
      if (!this.isCurrentPlaceOperation("search", requestId, connectionEpoch, signal) || currentQuery !== query) return;
      this.results = normalizeMilosPlaceResults(values);
      this.renderResults(this.results);
      if (this.results.length) this.clearOperationStatus("search");
      else this.setOperationStatus("search", localeCopy().noResults);
    } catch (error) {
      const currentQuery = this.input.value.trim().replace(/\s+/g, " ");
      if (error?.name !== "AbortError" && this.isCurrentPlaceOperation("search", requestId, connectionEpoch, signal) && currentQuery === query) this.setOperationStatus("search", localeCopy().searchFailed);
    } finally {
      if (this.isCurrentPlaceOperation("search", requestId, connectionEpoch, signal)) this.endBusy("search");
    }
  }

  cancelSearch() {
    this.searchRequestId += 1;
    this.searchController?.abort();
    this.searchController = null;
    this.endBusy("search");
    this.clearOperationStatus("search");
  }

  queueSuggestions() {
    if (!this.suggestionsConfig.enabled) return;
    this.cancelLocate();
    const query = this.input.value.trim().replace(/\s+/g, " ");
    this.cancelSuggestions();
    if (query.length < this.suggestionsConfig.minChars) return;
    const requestId = this.suggestionRequestId;
    const connectionEpoch = this.connectionEpoch;
    this.suggestionTimer = setTimeout(() => this.runSuggestions(query, requestId, connectionEpoch), this.suggestionsConfig.debounceMs);
  }

  cancelSuggestions() {
    clearTimeout(this.suggestionTimer);
    this.suggestionRequestId += 1;
    this.suggestionsController?.abort();
    this.suggestionsController = null;
    this.endBusy("suggestions");
    this.clearOperationStatus("suggestions");
  }

  async runSuggestions(query, requestId, connectionEpoch = this.connectionEpoch) {
    if (!this.suggestionsProvider || !this.isCurrentPlaceOperation("suggestions", requestId, connectionEpoch)) return;
    this.suggestionsController = new AbortController();
    const signal = this.suggestionsController.signal;
    this.beginBusy("suggestions");
    try {
      const values = await this.suggestionsProvider({ query, locale: activeLocale, signal });
      const currentQuery = this.input.value.trim().replace(/\s+/g, " ");
      if (!this.isCurrentPlaceOperation("suggestions", requestId, connectionEpoch, signal) || currentQuery !== query) return;
      this.results = normalizeMilosPlaceResults(values);
      this.renderResults(this.results);
    } catch (error) {
      const currentQuery = this.input.value.trim().replace(/\s+/g, " ");
      if (error?.name !== "AbortError" && currentQuery === query && this.isCurrentPlaceOperation("suggestions", requestId, connectionEpoch, signal)) this.setOperationStatus("suggestions", localeCopy().searchFailed);
    } finally {
      if (this.isCurrentPlaceOperation("suggestions", requestId, connectionEpoch, signal)) this.endBusy("suggestions");
    }
  }

  async runLocate() {
    if (!this.locateProvider) return;
    this.cancelSuggestions();
    this.cancelSearch();
    this.cancelLocate();
    const requestId = this.locateRequestId;
    const connectionEpoch = this.connectionEpoch;
    this.locateController = new AbortController();
    const signal = this.locateController.signal;
    this.beginBusy("locate", localeCopy().locating);
    try {
      const place = normalizePlace(await this.locateProvider({ locale: activeLocale, signal }));
      if (!this.isCurrentPlaceOperation("locate", requestId, connectionEpoch, signal)) return;
      if (!place) throw new Error("Invalid located place");
      this.select(place);
    } catch (error) {
      if (error?.name !== "AbortError" && this.isCurrentPlaceOperation("locate", requestId, connectionEpoch, signal)) this.setOperationStatus("locate", localeCopy().searchFailed);
    } finally {
      if (this.isCurrentPlaceOperation("locate", requestId, connectionEpoch, signal)) this.endBusy("locate");
    }
  }

  cancelLocate() {
    this.locateRequestId += 1;
    this.locateController?.abort();
    this.locateController = null;
    this.endBusy("locate");
    this.clearOperationStatus("locate");
  }

  isCurrentPlaceOperation(owner, requestId, connectionEpoch, signal) {
    const currentId = owner === "search" ? this.searchRequestId : owner === "suggestions" ? this.suggestionRequestId : this.locateRequestId;
    return this.isConnected && this.connectionEpoch === connectionEpoch && currentId === requestId && !signal?.aborted;
  }

  beginBusy(owner, message = "") {
    this.busyOwners ??= new Set();
    this.busyOwners.add(owner);
    if (message) this.setOperationStatus(owner, message);
    this.syncBusyState();
  }

  endBusy(owner) {
    this.busyOwners?.delete(owner);
    this.syncBusyState();
  }

  syncBusyState() {
    if (!this.input) return;
    const busy = (this.busyOwners?.size || 0) > 0;
    const blocking = this.busyOwners?.has("search") || this.busyOwners?.has("locate");
    this.input.setAttribute("aria-busy", String(busy));
    this.searchButton.disabled = Boolean(blocking);
    this.locateButton.disabled = Boolean(blocking);
  }

  setOperationStatus(owner, message) {
    if (!this.status) return;
    this.statusOwner = owner;
    this.status.textContent = message;
  }

  clearOperationStatus(owner) {
    if (!this.status || (owner && this.statusOwner !== owner)) return;
    this.statusOwner = null;
    this.status.textContent = "";
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
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancelSuggestions();
      this.cancelSearch();
      this.cancelLocate();
      this.renderResults([]);
      this.clearOperationStatus();
      return;
    }
    if (!this.results.length) {
      if (event.key === "Enter") { event.preventDefault(); this.runSearch(); }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      this.activeIndex = this.activeIndex < 0
        ? (direction > 0 ? 0 : this.results.length - 1)
        : (this.activeIndex + direction + this.results.length) % this.results.length;
      this.highlight();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (this.activeIndex >= 0) this.select(this.results[this.activeIndex]);
      else this.runSearch();
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
    this.cancelSuggestions();
    this.cancelSearch();
    this.cancelLocate();
    this.input.value = [place.name, place.region, place.country].filter(Boolean).join(", ");
    this.renderResults([]);
    this.clearOperationStatus();
    this.dispatchEvent(new CustomEvent("milosapps:placechange", { detail: place, bubbles: true, composed: true }));
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  setLocale(locale) {
    const selected = normalizeLocale(locale);
    if (this.locale && this.locale !== selected) {
      this.cancelSuggestions();
      this.cancelSearch();
      this.cancelLocate();
      this.renderResults([]);
      this.clearOperationStatus();
    }
    this.locale = selected;
    const copy = COPY[selected];
    if (this.label) this.label.textContent = this.getAttribute(`label-${selected}`) || copy.placeLabel;
    if (this.input) this.input.placeholder = this.getAttribute(`placeholder-${selected}`) || copy.placePlaceholder;
    if (this.searchButton) this.searchButton.textContent = copy.search;
    if (this.locateButton) this.locateButton.textContent = copy.useLocation;
  }

  disconnectedCallback() {
    this.connectionEpoch = (this.connectionEpoch || 0) + 1;
    this.cancelSuggestions();
    this.cancelSearch();
    this.cancelLocate();
    this.busyOwners?.clear();
    this.syncBusyState();
    this.clearOperationStatus();
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
  if (activeConfig.privacy.usesLocalStorage) {
    storageRemove(`milosapps.${activeConfig.appKey}.privacyNotice.v1`);
    storageRemove(`milosapps.${activeConfig.appKey}.essentialCookieInfo.v1`);
  }
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
