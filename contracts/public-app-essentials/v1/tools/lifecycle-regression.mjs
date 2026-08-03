function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

let lifecycleInvocation = 0;

function dataKey(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function matchesSelector(node, selector) {
  const dataAttribute = /^\[data-([a-z0-9-]+)\]$/.exec(selector);
  if (dataAttribute) return Object.hasOwn(node.dataset, dataKey(`data-${dataAttribute[1]}`));
  return node.tagName === selector.toUpperCase();
}

function fakeNode(tagName = "div") {
  const node = {
    tagName: tagName.toUpperCase(),
    dataset: {},
    disabled: false,
    isConnected: true,
    textContent: "",
    value: "",
    hidden: false,
    children: [],
    attributes: new Map(),
    listeners: new Map(),
    parentNode: null,
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith("data-")) this.dataset[dataKey(name)] = String(value);
    },
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name.startsWith("data-")) delete this.dataset[dataKey(name)];
    },
    append(...nodes) {
      nodes.forEach((child) => {
        child.parentNode = this;
        child.isConnected = this.isConnected;
        this.children.push(child);
      });
    },
    replaceChildren(...nodes) {
      this.children.forEach((child) => { child.parentNode = null; });
      this.children = [];
      this.append(...nodes);
    },
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
      this.isConnected = false;
    },
    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    },
    dispatchEvent(event) {
      for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
      return true;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const selectors = selector.split(",").map((value) => value.trim());
      const matches = [];
      const visit = (parent) => {
        parent.children.forEach((child) => {
          if (selectors.some((candidate) => matchesSelector(child, candidate))) matches.push(child);
          visit(child);
        });
      };
      visit(this);
      return matches;
    },
    scrollIntoView() {}
  };
  return node;
}

export async function validateLifecycle(runtimeUrl) {
  let assertions = 0;
  const assert = (condition, message) => {
    assertions += 1;
    if (!condition) throw new Error(`lifecycle regression failed: ${message}`);
  };

  const original = {
    HTMLElement: globalThis.HTMLElement,
    CustomEvent: globalThis.CustomEvent,
    customElements: globalThis.customElements,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    window: globalThis.window
  };

  class FakeHTMLElement {
    constructor() {
      this.dataset = {};
      this.isConnected = true;
      this.nodes = new Map();
      this.events = [];
      this.attributes = new Map();
      this.children = [];
    }
    hasAttribute(name) { return this.attributes.has(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    append(...nodes) {
      nodes.forEach((node) => {
        node.parentNode = this;
        this.children.push(node);
      });
    }
    replaceChildren(...nodes) {
      this.children.forEach((node) => { node.parentNode = null; });
      this.children = [];
      this.append(...nodes);
    }
    querySelector(selector) { return this.nodes.get(selector) || this.children.find((node) => matchesSelector(node, selector)) || null; }
    dispatchEvent(event) { this.events.push(event); return true; }
  }

  try {
    const body = fakeNode("body");
    const documentListeners = new Map();
    const removedStorageKeys = [];
    const storageWrites = [];
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.CustomEvent = class {
      constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
    };
    globalThis.customElements = {
      definitions: new Map(),
      define(name, definition) { this.definitions.set(name, definition); },
      get(name) { return this.definitions.get(name); }
    };
    globalThis.document = {
      title: "Lifecycle regression",
      documentElement: { lang: "de" },
      body,
      createElement: (tagName) => fakeNode(tagName),
      querySelector: (selector) => body.querySelector(selector),
      querySelectorAll: (selector) => body.querySelectorAll(selector),
      addEventListener(type, listener, capture = false) {
        const listeners = documentListeners.get(type) || [];
        if (!listeners.some((entry) => entry.listener === listener && entry.capture === Boolean(capture))) {
          listeners.push({ listener, capture: Boolean(capture) });
        }
        documentListeners.set(type, listeners);
      },
      removeEventListener(type, listener, capture = false) {
        const listeners = documentListeners.get(type) || [];
        documentListeners.set(type, listeners.filter((entry) => entry.listener !== listener || entry.capture !== Boolean(capture)));
      }
    };
    const dispatchDocumentEvent = (type, event) => {
      for (const { listener } of [...(documentListeners.get(type) || [])]) listener.call(globalThis.document, event);
    };
    const documentListenerCount = (type, capture = false) => (documentListeners.get(type) || []).filter((entry) => entry.capture === Boolean(capture)).length;
    globalThis.localStorage = {
      removeItem(key) { removedStorageKeys.push(key); },
      setItem(key, value) { storageWrites.push([key, value]); }
    };
    globalThis.window = { isSecureContext: true, location: { href: "https://example.test/app" } };

    const nativeShare = deferred();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { share: () => nativeShare.promise }
    });

    const isolatedRuntimeUrl = new URL(runtimeUrl);
    isolatedRuntimeUrl.searchParams.set("lifecycle-regression", String(++lifecycleInvocation));
    const { initMilosAppEssentials, MilosDatePicker, MilosPlaceSearch, MilosShareButton } = await import(isolatedRuntimeUrl.href);

    const preconnectedPlace = new MilosPlaceSearch();
    preconnectedPlace.setLocateProvider(async () => null);
    preconnectedPlace.connectedCallback();
    assert(preconnectedPlace.locateButton.hidden === false, "locate provider registered before first connection makes its button visible");

    const share = new MilosShareButton();
    share.dataset.milosReady = "true";
    share.payloadProvider = () => ({ title: "Test", text: "Test", url: "https://example.test/app" });
    const shareButton = fakeNode();
    const shareStatus = fakeNode();
    share.nodes.set("button", shareButton);
    share.nodes.set("[data-milos-share-status]", shareStatus);
    share.connectedCallback();
    const oldShare = share.share(shareButton, shareStatus);
    let displayTimerRan = false;
    let clearTimerRan = false;
    share.statusDisplayTimer = setTimeout(() => { displayTimerRan = true; }, 10);
    share.statusClearTimer = setTimeout(() => { clearTimerRan = true; }, 10);

    share.isConnected = false;
    shareButton.isConnected = false;
    shareStatus.isConnected = false;
    share.disconnectedCallback();
    assert(shareButton.disabled === false, "disconnect immediately enables share button");
    assert(shareStatus.textContent === "" && shareStatus.dataset.visible === "false" && !Object.hasOwn(shareStatus.dataset, "tone"), "disconnect immediately clears share feedback");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert(!displayTimerRan && !clearTimerRan, "disconnect clears both share status timers");

    share.isConnected = true;
    shareButton.isConnected = true;
    shareStatus.isConnected = true;
    share.connectedCallback();
    shareButton.disabled = true;
    shareStatus.textContent = "new operation";
    shareStatus.dataset.visible = "true";
    nativeShare.resolve();
    await oldShare;
    assert(shareButton.disabled === true && shareStatus.textContent === "new operation" && shareStatus.dataset.visible === "true", "stale share completion cannot mutate reattached component");
    assert(share.events.length === 0, "stale share completion cannot dispatch events");

    const locate = deferred();
    let locateSignal;
    const place = new MilosPlaceSearch();
    place.dataset.milosReady = "true";
    place.input = fakeNode();
    place.searchButton = fakeNode();
    place.locateButton = fakeNode();
    place.status = fakeNode();
    place.results = [];
    place.busyOwners = new Set();
    place.suggestionRequestId = 0;
    place.searchRequestId = 0;
    place.locateRequestId = 0;
    place.locateProvider = ({ signal }) => { locateSignal = signal; return locate.promise; };
    place.connectedCallback();
    const oldLocate = place.runLocate();
    place.cancelSearch();
    assert(place.locateButton.disabled && place.searchButton.disabled && place.input.attributes.get("aria-busy") === "true", "cancelSearch does not release locate busy ownership");

    place.isConnected = false;
    place.disconnectedCallback();
    assert(locateSignal.aborted, "disconnect aborts locate provider signal");
    assert(!place.locateButton.disabled && !place.searchButton.disabled && place.input.attributes.get("aria-busy") === "false", "disconnect clears locate busy state");
    assert(place.status.textContent === "", "disconnect clears locate status");

    place.isConnected = true;
    place.connectedCallback();
    place.input.value = "new input";
    place.status.textContent = "new status";
    place.searchButton.disabled = true;
    place.locateButton.disabled = true;
    locate.resolve({ name: "Berlin", region: "Berlin", country: "Deutschland", countryCode: "DE", latitude: 52.52, longitude: 13.405 });
    await oldLocate;
    assert(place.input.value === "new input" && place.status.textContent === "new status", "abort-ignoring locate result cannot mutate reattached UI");
    assert(place.searchButton.disabled && place.locateButton.disabled, "stale locate finally cannot release new busy UI");
    assert(place.events.length === 0, "stale locate result cannot dispatch events");

    const datePicker = new MilosDatePicker();
    datePicker.input = fakeNode();
    datePicker.yearSelect = fakeNode();
    datePicker.commit("2026-08-03");
    assert(datePicker.events.filter(({ type }) => type === "change").length === 1, "date commit dispatches exactly one host change event");
    assert(datePicker.events.filter(({ type }) => type === "milosapps:datechange").length === 1, "date commit dispatches exactly one semantic event");
    datePicker.commit("");
    assert(datePicker.value === "" && datePicker.input.value === "" && datePicker.yearSelect.value === "", "optional date can be cleared without stale state");
    assert(datePicker.events.filter(({ type }) => type === "change").length === 2, "date clear dispatches exactly one replacement host event");
    assert(datePicker.events.filter(({ type }) => type === "milosapps:datechange").at(-1)?.detail?.value === "", "date clear dispatches an empty semantic value");
    datePicker.commit("2026-02-31");
    assert(datePicker.value === "" && datePicker.input.value === "" && datePicker.events.filter(({ type }) => type === "change").length === 2, "impossible calendar dates are rejected without events");

    const keyboardPlace = new MilosPlaceSearch();
    keyboardPlace.input = fakeNode();
    keyboardPlace.resultsElement = fakeNode();
    keyboardPlace.resultsElement.children = [fakeNode(), fakeNode(), fakeNode()];
    keyboardPlace.results = [{}, {}, {}];
    keyboardPlace.activeIndex = -1;
    keyboardPlace.onKeyDown({ key: "ArrowUp", preventDefault() {} });
    assert(keyboardPlace.activeIndex === 2, "initial ArrowUp selects the final place result");

    const outsidePlace = new MilosPlaceSearch();
    outsidePlace.connectedCallback();
    outsidePlace.renderResults([
      { name: "Berlin", region: "Berlin", country: "Deutschland" },
      { name: "Bern", region: "Bern", country: "Schweiz" }
    ]);
    outsidePlace.activeIndex = 0;
    outsidePlace.highlight();
    assert(outsidePlace.input.attributes.get("aria-expanded") === "true" && outsidePlace.input.attributes.has("aria-activedescendant"), "open place popup exposes its active option");
    dispatchDocumentEvent("pointerdown", { target: fakeNode(), composedPath: () => [fakeNode()] });
    assert(outsidePlace.results.length === 0 && outsidePlace.activeIndex === -1 && outsidePlace.resultsElement.hidden, "outside pointer clears and hides place results");
    assert(outsidePlace.input.attributes.get("aria-expanded") === "false" && !outsidePlace.input.attributes.has("aria-activedescendant"), "outside pointer collapses the exact combobox ARIA state");

    outsidePlace.renderResults([{ name: "Berlin", region: "Berlin", country: "Deutschland" }]);
    const insideOption = outsidePlace.resultsElement.children[0];
    dispatchDocumentEvent("pointerdown", { target: fakeNode(), composedPath: () => [insideOption, outsidePlace.resultsElement, outsidePlace] });
    assert(outsidePlace.results.length === 1 && !outsidePlace.resultsElement.hidden, "composed path keeps an internal option interaction open even with a misleading target");
    insideOption.dispatchEvent({ type: "click" });
    assert(outsidePlace.events.filter(({ type }) => type === "milosapps:placechange").length === 1, "internal option click selects exactly once after capture pointerdown");
    assert(outsidePlace.resultsElement.hidden && outsidePlace.input.attributes.get("aria-expanded") === "false", "selection closes the shared popup");

    const staleOutsideSuggestion = deferred();
    outsidePlace.input.value = "Frei";
    outsidePlace.suggestionsProvider = () => staleOutsideSuggestion.promise;
    const staleOutsideSuggestionRun = outsidePlace.runSuggestions("Frei", outsidePlace.suggestionRequestId, outsidePlace.connectionEpoch, outsidePlace.resultsGeneration);
    dispatchDocumentEvent("pointerdown", { target: fakeNode(), composedPath: () => [fakeNode()] });
    staleOutsideSuggestion.resolve([{ name: "Freiburg", region: "Baden-Württemberg", country: "Deutschland", countryCode: "DE", latitude: 47.999, longitude: 7.842 }]);
    await staleOutsideSuggestionRun;
    assert(outsidePlace.results.length === 0 && outsidePlace.resultsElement.hidden && outsidePlace.status.textContent === "", "abort-ignoring suggestion cannot reopen after outside dismissal");

    const staleOutsideSearch = deferred();
    outsidePlace.input.value = "Hamburg";
    outsidePlace.setSearchProvider(() => staleOutsideSearch.promise);
    const staleOutsideSearchRun = outsidePlace.runSearch();
    dispatchDocumentEvent("pointerdown", { target: fakeNode(), composedPath: () => [fakeNode()] });
    staleOutsideSearch.resolve([{ name: "Hamburg", region: "Hamburg", country: "Deutschland", countryCode: "DE", latitude: 53.551, longitude: 9.994 }]);
    await staleOutsideSearchRun;
    assert(outsidePlace.results.length === 0 && outsidePlace.resultsElement.hidden && outsidePlace.status.textContent === "", "abort-ignoring submit search cannot reopen after outside dismissal");

    const staleOutsideLocate = deferred();
    outsidePlace.setLocateProvider(() => staleOutsideLocate.promise);
    const placeEventsBeforeLocate = outsidePlace.events.length;
    const staleOutsideLocateRun = outsidePlace.runLocate();
    dispatchDocumentEvent("pointerdown", { target: fakeNode(), composedPath: () => [fakeNode()] });
    staleOutsideLocate.resolve({ name: "Berlin", region: "Berlin", country: "Deutschland", countryCode: "DE", latitude: 52.52, longitude: 13.405 });
    await staleOutsideLocateRun;
    assert(outsidePlace.events.length === placeEventsBeforeLocate && outsidePlace.resultsElement.hidden, "abort-ignoring location cannot select after outside dismissal");

    const freshSuggestion = deferred();
    outsidePlace.input.value = "Berl";
    outsidePlace.suggestionsProvider = () => freshSuggestion.promise;
    const freshSuggestionRun = outsidePlace.runSuggestions("Berl", outsidePlace.suggestionRequestId, outsidePlace.connectionEpoch, outsidePlace.resultsGeneration);
    freshSuggestion.resolve([{ name: "Berlin", region: "Berlin", country: "Deutschland", countryCode: "DE", latitude: 52.52, longitude: 13.405 }]);
    await freshSuggestionRun;
    assert(outsidePlace.results.length === 1 && !outsidePlace.resultsElement.hidden, "new generation can open fresh suggestions after dismissal");

    const pointerListenersBeforeDisconnect = documentListenerCount("pointerdown", true);
    outsidePlace.isConnected = false;
    outsidePlace.disconnectedCallback();
    assert(documentListenerCount("pointerdown", true) === pointerListenersBeforeDisconnect - 1, "disconnect removes the exact capture pointer listener");
    assert(outsidePlace.resultsElement.hidden && outsidePlace.input.attributes.get("aria-expanded") === "false", "disconnect closes the popup and ARIA state");
    outsidePlace.isConnected = true;
    outsidePlace.connectedCallback();
    const pointerListenersAfterReconnect = documentListenerCount("pointerdown", true);
    outsidePlace.connectedCallback();
    assert(documentListenerCount("pointerdown", true) === pointerListenersAfterReconnect, "reconnect keeps exactly one capture pointer listener per component");

    const staleSuggestion = deferred();
    const suggestionsPlace = new MilosPlaceSearch();
    suggestionsPlace.isConnected = true;
    suggestionsPlace.connectionEpoch = 1;
    suggestionsPlace.input = fakeNode();
    suggestionsPlace.input.value = "Berlin";
    suggestionsPlace.searchButton = fakeNode();
    suggestionsPlace.locateButton = fakeNode();
    suggestionsPlace.status = fakeNode();
    suggestionsPlace.resultsElement = fakeNode();
    suggestionsPlace.busyOwners = new Set();
    suggestionsPlace.suggestionRequestId = 0;
    suggestionsPlace.searchRequestId = 0;
    suggestionsPlace.locateRequestId = 0;
    suggestionsPlace.suggestionsProvider = () => staleSuggestion.promise;
    const oldSuggestion = suggestionsPlace.runSuggestions("Berlin", 0, 1);
    suggestionsPlace.input.value = "Paris";
    suggestionsPlace.status.textContent = "new status";
    staleSuggestion.reject(new Error("old request failed"));
    await oldSuggestion;
    assert(suggestionsPlace.status.textContent === "new status", "stale suggestion rejection cannot overwrite a new programmatic query");

    const selectedPlace = new MilosPlaceSearch();
    selectedPlace.input = fakeNode();
    selectedPlace.renderResults = () => {};
    selectedPlace.clearOperationStatus = () => {};
    selectedPlace.cancelSuggestions = () => {};
    selectedPlace.cancelSearch = () => {};
    selectedPlace.cancelLocate = () => {};
    selectedPlace.select({ name: "London", region: "England", country: "United Kingdom" });
    assert(selectedPlace.input.value === "London, England, United Kingdom", "selected place keeps name, region and country visible");

    const essentials = initMilosAppEssentials({
      appKey: "reference-app",
      environment: "dev",
      productionApproved: false,
      loading: { appName: "Reference App", message: { de: "App wird geladen", en: "App is loading" } },
      privacy: {
        mode: "essential-only",
        usesLocalStorage: true,
        storagePurposes: [{
          key: "milosapps.reference-app.locale",
          purpose: "Sprachauswahl",
          lifetime: "until-user-clears",
          strictlyNecessary: true
        }],
        optionalTracking: false,
        privacyUrl: "https://example.test/privacy"
      },
      features: {
        startup: true,
        privacyNotice: true,
        share: true,
        datePicker: false,
        placeSearch: false,
        placeSuggestions: {
          enabled: false,
          minChars: 3,
          debounceMs: 350,
          providerCapability: "submit-only",
          evidenceFile: null
        }
      }
    });
    assert(
      removedStorageKeys.length === 2
        && removedStorageKeys[0] === "milosapps.reference-app.privacyNotice.v1"
        && removedStorageKeys[1] === "milosapps.reference-app.essentialCookieInfo.v1",
      "initialization removes both obsolete privacy persistence keys"
    );
    essentials.ready();
    const privacyNotice = document.querySelector("[data-milos-privacy-notice]");
    assert(privacyNotice, "ready displays the essential-only privacy notice");
    privacyNotice.querySelector("[data-milos-privacy-dismiss]").dispatchEvent({ type: "click" });
    assert(!document.querySelector("[data-milos-privacy-notice]"), "dismiss removes the privacy notice");
    essentials.ready();
    assert(!document.querySelector("[data-milos-privacy-notice]"), "repeated ready cannot reopen a notice dismissed in this document");
    assert(storageWrites.length === 0, "document-scoped privacy dismissal does not persist consent state");

    const directProviderConfig = {
      appKey: "reference-app",
      environment: "dev",
      productionApproved: false,
      loading: { appName: "Reference App", message: { de: "App wird geladen", en: "App is loading" } },
      privacy: {
        mode: "no-cookies",
        usesLocalStorage: false,
        storagePurposes: [],
        optionalTracking: false,
        privacyUrl: "https://example.test/privacy"
      },
      features: {
        startup: true,
        privacyNotice: false,
        share: true,
        datePicker: false,
        placeSearch: true,
        placeSuggestions: {
          enabled: true,
          minChars: 3,
          debounceMs: 350,
          providerCapability: "provider-autocomplete-direct",
          evidenceFile: "direct-provider.md"
        }
      }
    };
    const directEssentials = initMilosAppEssentials(directProviderConfig);
    assert(directEssentials.version === "1.1.4", "runtime accepts the evidenced direct autocomplete capability");
    let unknownCapabilityError;
    try {
      initMilosAppEssentials({
        ...directProviderConfig,
        features: {
          ...directProviderConfig.features,
          placeSuggestions: { ...directProviderConfig.features.placeSuggestions, providerCapability: "provider-autocomplete-unknown" }
        }
      });
    } catch (error) {
      unknownCapabilityError = error;
    }
    assert(unknownCapabilityError instanceof TypeError, "runtime rejects an unknown autocomplete capability");
  } finally {
    if (original.HTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = original.HTMLElement;
    if (original.CustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = original.CustomEvent;
    if (original.customElements === undefined) delete globalThis.customElements;
    else globalThis.customElements = original.customElements;
    if (original.document === undefined) delete globalThis.document;
    else globalThis.document = original.document;
    if (original.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original.localStorage;
    if (original.navigator) Object.defineProperty(globalThis, "navigator", original.navigator);
    else delete globalThis.navigator;
    if (original.window === undefined) delete globalThis.window;
    else globalThis.window = original.window;
  }

  return assertions;
}
