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
    showPickerCalls: 0,
    selectionStart: 0,
    selectionEnd: 0,
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
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    showPicker() {
      this.showPickerCalls += 1;
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

function trackValueAssignments(node) {
  let value = String(node.value || "");
  let assignments = 0;
  Object.defineProperty(node, "value", {
    configurable: true,
    get() { return value; },
    set(nextValue) {
      assignments += 1;
      value = String(nextValue);
    }
  });
  return {
    assignments: () => assignments,
    reset() { assignments = 0; },
    setFromNativeInput(nextValue) { value = String(nextValue); }
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

    const legacyDatePicker = new MilosDatePicker();
    legacyDatePicker.setAttribute("value", "2026-08-03");
    legacyDatePicker.connectedCallback();
    const legacyAssignments = trackValueAssignments(legacyDatePicker.input);
    legacyAssignments.setFromNativeInput("2026-08-24");
    legacyDatePicker.input.dispatchEvent({ type: "change", stopPropagation() {} });
    assert(legacyDatePicker.input.type === "date" && legacyDatePicker.yearSelect && !legacyDatePicker.calendarInput, "default date mode preserves the v1.1.6 native input and year jump");
    assert(legacyDatePicker.note.textContent === "Datum direkt eingeben oder im Kalender wählen.", "default native mode preserves its existing user hint");
    assert(legacyAssignments.assignments() === 0 && legacyDatePicker.value === "2026-08-24", "default native mode still avoids redundant assignments on valid browser change");
    assert(legacyDatePicker.events.filter(({ type }) => type === "change").length === 1 && legacyDatePicker.events.filter(({ type }) => type === "milosapps:datechange").length === 1, "default native mode still dispatches one host and semantic event");
    legacyAssignments.setFromNativeInput("2026-02-31");
    legacyAssignments.reset();
    legacyDatePicker.input.dispatchEvent({ type: "change", stopPropagation() {} });
    assert(legacyAssignments.assignments() === 1 && legacyDatePicker.input.value === "2026-08-24", "default native mode keeps invalid rollback behavior");
    const legacyEventsBeforeInvalidSetter = legacyDatePicker.events.length;
    legacyDatePicker.value = "not-a-date";
    assert(legacyDatePicker.value === "2026-08-24" && legacyDatePicker.input.value === "2026-08-24" && legacyDatePicker.events.length === legacyEventsBeforeInvalidSetter, "default native mode keeps invalid external setter rollback event-silent");

    const datePicker = new MilosDatePicker();
    datePicker.setAttribute("mode", "known-date-text");
    datePicker.setAttribute("value", "2026-08-03");
    datePicker.connectedCallback();
    const hostChangeCount = () => datePicker.events.filter(({ type }) => type === "change").length;
    const semanticChangeCount = () => datePicker.events.filter(({ type }) => type === "milosapps:datechange").length;

    assert(datePicker.input.type === "text" && datePicker.input.inputMode === "numeric", "memorable date uses a numeric text input instead of segmented native date editing");
    assert(datePicker.input.value === "03.08.2026" && datePicker.input.placeholder === "TT.MM.JJJJ", "German date text renders and communicates an unambiguous format");
    assert(!datePicker.yearSelect && datePicker.calendarButton?.tagName === "BUTTON" && datePicker.todayButton, "redundant year jump is removed while separate calendar and Today button actions remain");
    assert(datePicker.calendarInput.parentNode === datePicker.calendarButton.parentNode && datePicker.calendarInput.parentNode !== datePicker.calendarButton, "native calendar input is an offscreen sibling instead of a transparent control over the visible button");
    datePicker.calendarButton.dispatchEvent({ type: "click" });
    assert(datePicker.calendarInput.showPickerCalls === 1, "visible calendar button opens the separate native picker exactly once");

    datePicker.input.value = "13111995";
    datePicker.input.dispatchEvent({ type: "input" });
    assert(datePicker.input.value === "13111995" && datePicker.value === "2026-08-03", "partial compact input remains raw and uncommitted while editing");
    datePicker.input.dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    assert(datePicker.input.value === "13.11.1995" && datePicker.value === "1995-11-13", "compact German date commits to ISO on Enter");
    assert(hostChangeCount() === 1 && semanticChangeCount() === 1, "valid Enter commit dispatches exactly one host and semantic event");
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(hostChangeCount() === 1 && semanticChangeCount() === 1, "blur after Enter does not dispatch a duplicate date event");

    datePicker.input.value = "13.11.";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.input.value === "13.11." && datePicker.input.attributes.get("aria-invalid") === "true", "incomplete date remains visible and is marked invalid on blur");
    assert(datePicker.error.hidden === false && /TT\.MM\.JJJJ/.test(datePicker.error.textContent), "incomplete German date gets an exact localized format error");
    assert(datePicker.value === "1995-11-13" && hostChangeCount() === 1, "invalid raw input neither rolls back nor dispatches a change");
    datePicker.input.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
    assert(datePicker.input.value === "13.11.1995" && datePicker.input.attributes.get("aria-invalid") === "false" && datePicker.error.hidden, "Escape restores the last valid formatted value and clears the error");

    datePicker.input.value = "29/02/2024";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.value === "2024-02-29" && datePicker.input.value === "29.02.2024", "slash-separated leap day commits and normalizes for German display");
    datePicker.input.value = "01-03-2024";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.value === "2024-03-01" && datePicker.input.value === "01.03.2024", "hyphen-separated German date is accepted and normalized");
    datePicker.input.value = "29-02-2023";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.input.value === "29-02-2023" && datePicker.input.attributes.get("aria-invalid") === "true" && /nicht/.test(datePicker.error.textContent), "impossible date remains raw with a specific German calendar error");

    datePicker.input.value = "31.12.1899";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.input.value === "31.12.1899" && /01\.01\.1900/.test(datePicker.error.textContent), "out-of-range date remains raw and names the German minimum date");
    datePicker.input.value = "01.01.2101";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.input.value === "01.01.2101" && /31\.12\.2100/.test(datePicker.error.textContent), "out-of-range date remains raw and names the German maximum date");

    datePicker.input.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
    datePicker.input.selectionStart = 7;
    datePicker.input.selectionEnd = 7;
    datePicker.input.dispatchEvent({ type: "pointerup" });
    assert(datePicker.input.selectionStart === 6 && datePicker.input.selectionEnd === 10, "pointer selection isolates the German year segment so it can be replaced first");
    datePicker.input.selectionStart = datePicker.input.value.length;
    datePicker.input.selectionEnd = datePicker.input.value.length;
    datePicker.input.dispatchEvent({ type: "pointerup" });
    assert(datePicker.input.selectionStart === 6 && datePicker.input.selectionEnd === 10, "pointer at the end of the value still selects the final year segment");
    datePicker.input.selectionStart = 1;
    datePicker.input.selectionEnd = 1;
    datePicker.input.dispatchEvent({ type: "pointerup" });
    assert(datePicker.input.selectionStart === 0 && datePicker.input.selectionEnd === 2, "pointer selection isolates only the clicked day segment without moving focus");
    datePicker.input.selectionStart = 2;
    datePicker.input.selectionEnd = 2;
    datePicker.input.dispatchEvent({ type: "pointerup" });
    assert(datePicker.input.selectionStart === 2 && datePicker.input.selectionEnd === 2, "pointer on a date separator does not unexpectedly select a neighboring segment");
    datePicker.input.selectionStart = 0;
    datePicker.input.selectionEnd = 2;
    datePicker.input.dispatchEvent({ type: "pointerup" });
    assert(datePicker.input.selectionStart === 0 && datePicker.input.selectionEnd === 2, "pointer handler preserves an existing drag selection");

    datePicker.input.value = "31.12.";
    datePicker.input.selectionStart = 4;
    datePicker.input.selectionEnd = 4;
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.setLocale("en");
    assert(datePicker.input.value === "31.12." && datePicker.input.selectionStart === 4 && datePicker.input.selectionEnd === 4, "locale switch preserves dirty raw text and caret instead of rewriting an active edit");
    assert(datePicker.input.placeholder === "DD/MM/YYYY", "locale switch still updates the communicated input format during a dirty edit");
    datePicker.input.dispatchEvent({ type: "keydown", key: "Escape", preventDefault() {} });
    assert(datePicker.input.value === "01/03/2024", "Escape after locale switch restores the last valid value in the current locale");
    datePicker.setLocale("de");

    const changesBeforeClear = hostChangeCount();
    const semanticChangesBeforeClear = semanticChangeCount();
    datePicker.input.value = "";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.value === "" && datePicker.input.value === "" && datePicker.input.attributes.get("aria-invalid") === "false", "clear remains a valid commit");
    assert(hostChangeCount() === changesBeforeClear + 1 && semanticChangeCount() === semanticChangesBeforeClear + 1, "clear dispatches exactly one host and semantic event");

    datePicker.value = "2000-12-31";
    assert(datePicker.value === "2000-12-31" && datePicker.input.value === "31.12.2000", "external ISO setter synchronizes the localized text input");
    const eventsBeforeInvalidSetter = datePicker.events.length;
    datePicker.value = "not-a-date";
    assert(datePicker.value === "2000-12-31" && datePicker.input.value === "31.12.2000" && datePicker.events.length === eventsBeforeInvalidSetter, "known-date mode rejects an invalid external ISO setter without clearing or dispatching");
    datePicker.setLocale("en");
    assert(datePicker.input.value === "31/12/2000" && datePicker.input.placeholder === "DD/MM/YYYY", "English mode uses an explicitly communicated day-month-year text format");
    datePicker.input.value = "13/11/1995";
    datePicker.input.dispatchEvent({ type: "input" });
    datePicker.input.dispatchEvent({ type: "blur" });
    assert(datePicker.value === "1995-11-13" && datePicker.input.value === "13/11/1995", "English day-month-year text commits to the same ISO contract");

    datePicker.calendarInput.value = "2024-02-29";
    datePicker.calendarInput.dispatchEvent({ type: "change", stopPropagation() {} });
    assert(datePicker.value === "2024-02-29" && datePicker.input.value === "29/02/2024", "native calendar selection synchronizes text and ISO value");

    datePicker.value = "2001-01-01";
    datePicker.todayButton.dispatchEvent({ type: "click" });
    assert(datePicker.value === datePicker.calendarInput.value && datePicker.value !== "2001-01-01", "Today keeps text, native calendar and ISO value synchronized");

    const requiredDatePicker = new MilosDatePicker();
    requiredDatePicker.setAttribute("mode", "known-date-text");
    requiredDatePicker.setAttribute("required", "");
    requiredDatePicker.setAttribute("value", "1995-11-13");
    requiredDatePicker.connectedCallback();
    requiredDatePicker.input.value = "";
    requiredDatePicker.input.dispatchEvent({ type: "input" });
    requiredDatePicker.input.dispatchEvent({ type: "keydown", key: "Enter", preventDefault() {} });
    assert(requiredDatePicker.input.value === "" && requiredDatePicker.value === "1995-11-13" && requiredDatePicker.input.attributes.get("aria-invalid") === "true", "required empty Enter preserves the raw empty field and last valid ISO value while marking it invalid");
    assert(/Datum eingeben/.test(requiredDatePicker.error.textContent) && requiredDatePicker.events.length === 0, "required empty Enter shows the localized required error without dispatching an event");
    requiredDatePicker.input.dispatchEvent({ type: "blur" });
    assert(requiredDatePicker.input.required && requiredDatePicker.input.value === "" && requiredDatePicker.value === "1995-11-13" && requiredDatePicker.input.attributes.get("aria-invalid") === "true", "required empty blur also preserves raw text and the last valid value");
    assert(requiredDatePicker.events.length === 0, "required empty blur remains event-silent");
    requiredDatePicker.setLocale("en");
    assert(requiredDatePicker.input.value === "" && requiredDatePicker.error.textContent === "Enter a date.", "required empty error remains raw and is localized when the locale changes");
    requiredDatePicker.setLocale("de");

    const boundedLegacyDatePicker = new MilosDatePicker();
    boundedLegacyDatePicker.setAttribute("min", "2099-01-01");
    boundedLegacyDatePicker.setAttribute("max", "2099-12-31");
    boundedLegacyDatePicker.setAttribute("value", "2099-06-15");
    boundedLegacyDatePicker.connectedCallback();
    boundedLegacyDatePicker.todayButton.dispatchEvent({ type: "click" });
    assert(boundedLegacyDatePicker.todayButton.disabled && boundedLegacyDatePicker.value === "2099-06-15" && boundedLegacyDatePicker.events.length === 0, "legacy Today disables outside min/max and never substitutes a boundary date");

    const boundedTextDatePicker = new MilosDatePicker();
    boundedTextDatePicker.setAttribute("mode", "known-date-text");
    boundedTextDatePicker.setAttribute("min", "2099-01-01");
    boundedTextDatePicker.setAttribute("max", "2099-12-31");
    boundedTextDatePicker.setAttribute("value", "2099-06-15");
    boundedTextDatePicker.connectedCallback();
    boundedTextDatePicker.todayButton.dispatchEvent({ type: "click" });
    assert(boundedTextDatePicker.todayButton.disabled && boundedTextDatePicker.value === "2099-06-15" && boundedTextDatePicker.events.length === 0, "known-date Today disables outside min/max and never substitutes a boundary date");

    const supportedCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = (tagName) => {
      const node = fakeNode(tagName);
      node.showPicker = undefined;
      return node;
    };
    const unsupportedCalendarDatePicker = new MilosDatePicker();
    unsupportedCalendarDatePicker.setAttribute("mode", "known-date-text");
    unsupportedCalendarDatePicker.setAttribute("value", "1995-11-13");
    unsupportedCalendarDatePicker.connectedCallback();
    globalThis.document.createElement = supportedCreateElement;
    assert(unsupportedCalendarDatePicker.calendarButton.hidden && unsupportedCalendarDatePicker.calendarButton.disabled && unsupportedCalendarDatePicker.calendarInput.disabled, "calendar action fails closed when native showPicker is unavailable");

    const throwingCalendarDatePicker = new MilosDatePicker();
    throwingCalendarDatePicker.setAttribute("mode", "known-date-text");
    throwingCalendarDatePicker.setAttribute("value", "1995-11-13");
    throwingCalendarDatePicker.connectedCallback();
    throwingCalendarDatePicker.calendarInput.showPicker = () => { throw new Error("picker unavailable"); };
    throwingCalendarDatePicker.calendarButton.dispatchEvent({ type: "click" });
    assert(throwingCalendarDatePicker.calendarButton.hidden && throwingCalendarDatePicker.calendarButton.disabled && throwingCalendarDatePicker.calendarInput.disabled, "calendar action fails closed when showPicker rejects activation at runtime");

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
    assert(directEssentials.version === "1.2.0", "runtime accepts the evidenced direct autocomplete capability");
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
