function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeNode() {
  return {
    dataset: {},
    disabled: false,
    isConnected: true,
    textContent: "",
    value: "",
    hidden: false,
    children: [],
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name.startsWith("data-")) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        delete this.dataset[key];
      }
    },
    replaceChildren(...nodes) { this.children = nodes; },
    scrollIntoView() {}
  };
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
    }
    hasAttribute() { return false; }
    getAttribute() { return null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    querySelector(selector) { return this.nodes.get(selector) || null; }
    dispatchEvent(event) { this.events.push(event); return true; }
  }

  try {
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.CustomEvent = class {
      constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
    };
    globalThis.window = { isSecureContext: true, location: { href: "https://example.test/app" } };

    const nativeShare = deferred();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { share: () => nativeShare.promise }
    });

    const { MilosDatePicker, MilosPlaceSearch, MilosShareButton } = await import(`${runtimeUrl.href}?lifecycle-regression=1`);

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

    const keyboardPlace = new MilosPlaceSearch();
    keyboardPlace.input = fakeNode();
    keyboardPlace.resultsElement = fakeNode();
    keyboardPlace.resultsElement.children = [fakeNode(), fakeNode(), fakeNode()];
    keyboardPlace.results = [{}, {}, {}];
    keyboardPlace.activeIndex = -1;
    keyboardPlace.onKeyDown({ key: "ArrowUp", preventDefault() {} });
    assert(keyboardPlace.activeIndex === 2, "initial ArrowUp selects the final place result");

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
  } finally {
    if (original.HTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = original.HTMLElement;
    if (original.CustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = original.CustomEvent;
    if (original.navigator) Object.defineProperty(globalThis, "navigator", original.navigator);
    else delete globalThis.navigator;
    if (original.window === undefined) delete globalThis.window;
    else globalThis.window = original.window;
  }

  return assertions;
}
