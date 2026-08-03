import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncEssentials } from "./sync.mjs";
import { schemaErrors, verifyEssentials } from "../dist/verify.mjs";
import { validateLifecycle } from "./lifecycle-regression.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(root, "fixtures", "reference-app");
const zeroCommit = "0".repeat(40);
const expectedConsumers = ["portal", "noodle-calculator", "sky", "cloud-post", "somewhere-now", "gravity-loop", "waste-guide", "daylight"].sort();
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`public-app-essentials/v1 validation failed: ${message}`);
}

async function json(name) {
  return JSON.parse(await readFile(path.join(root, name), "utf8"));
}

function digest(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function expectFailure(action, pattern, label) {
  let error;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof Error, `${label} must fail`);
  assert(pattern.test(error.message), `${label} must explain its failure`);
}

const contract = await json("contract.json");
const schema = await json("schema.json");
const manifestSchemaContent = await readFile(path.join(root, "essentials-manifest.schema.json"));
const manifestSchema = JSON.parse(manifestSchemaContent.toString("utf8"));
const example = await json("essentials-manifest.example.json");
const release = await json("release.json");
const css = await readFile(path.join(root, "dist", "milos-app-essentials.css"));
const runtime = await readFile(path.join(root, "dist", "milos-app-essentials.js"));
const verifier = await readFile(path.join(root, "dist", "verify.mjs"));
const syncText = await readFile(path.join(root, "tools", "sync.mjs"), "utf8");
const readme = await readFile(path.join(root, "README.md"), "utf8");

assert(contract.id === "public-app-essentials/v1" && contract.version === "1.1.1", "contract id/version");
assert(contract.status === "stable", "stable contract status");
assert(schema.properties.id.const === contract.id && schema.properties.version.const === contract.version, "contract schema pins id/version");
assert(JSON.stringify([...contract.eligibleConsumers].sort()) === JSON.stringify(expectedConsumers), "exact eligible consumers");
assert(contract.excludedConsumers.includes("calendar") && contract.excludedClasses.includes("login-required-app"), "calendar and login apps excluded");
assert(contract.modules.startup.iconMaxPx === 56 && contract.modules.startup.iconMaxMobilePx === 48, "bounded startup icon");
assert(contract.modules.privacyNotice.fakeConsentForbidden && contract.modules.privacyNotice.optionalTrackingAllowed === false, "truthful privacy notice");
assert(contract.modules.privacyNotice.optionalDeviceStorageAllowed === false && contract.modules.privacyNotice.storagePurposeDeclarationRequired && contract.modules.privacyNotice.storagePurposesMustBeStrictlyNecessary && contract.modules.privacyNotice.consentContractIncluded === false, "device storage is purpose-bound without implied consent");
assert(contract.modules.privacyNotice.noCookiesBehavior === "no-banner-no-dismiss-state-persistent-consumer-info", "no-cookies has no banner or dismiss state");
assert(contract.modules.privacyNotice.essentialOnlyBehavior === "informational-dismissible-not-consent" && contract.modules.privacyNotice.dismissPersistence === "document-only", "essential-only is informational without optional persistence");
assert(contract.modules.share.nativeApi === "navigator.share" && contract.modules.share.fallback === "clipboard", "share strategy");
assert(contract.modules.share.nativeSuccessFeedback === "silent" && contract.modules.share.nativeAbortFeedback === "silent" && contract.modules.share.stableOuterDimensionsRequired, "share feedback is stable and native-silent");
assert(contract.modules.datePicker.implementation === "native-date-input-plus-year-jump" && contract.modules.datePicker.normalChangeEventsPerCommit === 1, "native date foundation and single change event");
assert(contract.modules.datePicker.reflowBasis === "component-inline-size" && contract.modules.datePicker.selectInlineEndSafeAreaRequired, "date component reflow and select safe area");
assert(contract.modules.placeSearch.providerOwnedByConsumer && contract.modules.placeSearch.explicitSubmitRequired, "provider-neutral explicit place search");
assert(contract.modules.placeSearch.publicNominatimAutocompleteForbidden && contract.modules.placeSearch.publicNominatimSubmitSearchAllowed, "public Nominatim remains submit-only");
assert(contract.modules.placeSearch.defaultMode === "submit-only" && contract.modules.placeSearch.suggestions.providerEvidenceRequired && contract.modules.placeSearch.suggestions.providerRegistration === "setSuggestionsProvider", "place suggestions are explicit and evidenced");
assert(JSON.stringify(contract.modules.placeSearch.selectedDisplayFields) === JSON.stringify(["name", "region", "country"]) && contract.modules.placeSearch.localeChangeInvalidatesPendingOperations, "place selection and locale lifecycle stay unambiguous");
assert(contract.modules.placeSearch.suggestions.abortRequired && contract.modules.placeSearch.suggestions.staleResultSuppressionRequired && contract.modules.placeSearch.suggestions.keyboardNavigationRequired, "suggestions lifecycle and keyboard contract");
assert(contract.quality.controlsMinTargetPx === 44 && contract.quality.zoomViewport === "360x800@200%", "touch and reflow gates");
assert(contract.quality.productionApproved === false, "Production blocked");
assert(contract.delivery.manifestSchemaLocked && contract.delivery.sourceCommitProvenanceRequired && contract.quality.themeColorTokensOnly && contract.quality.commentMarkersDoNotCountAsIntegration, "schema, provenance, theme and real integration gates");
assert(contract.quality.adaptiveThemeCustomPropertyPattern === "var(--[a-z0-9]+(?:-[a-z0-9]+)*)", "safe adaptive theme custom properties are explicit");
assert(manifestSchema.properties.$schema.type === "string", "manifest permits schema declaration");
assert(schemaErrors(manifestSchema, example).length === 0, "example validates against the complete manifest schema");
assert(Object.keys(example).every((key) => Object.hasOwn(manifestSchema.properties, key)), "example uses schema properties only");
assert(example.public === true && example.loginRequired === false && example.productionApproved === false, "example public DEV boundary");
assert(example.privacy.optionalTracking === false && example.features.privacyNotice === false && example.features.share === true, "example no-cookies/share boundary");
assert(example.privacy.usesLocalStorage && example.privacy.storagePurposes.length === 1 && example.privacy.storagePurposes[0].strictlyNecessary === true, "example declares necessary app storage purpose");
assert(example.features.placeSuggestions.enabled === false && example.features.placeSuggestions.providerCapability === "submit-only", "example defaults to submit-only place search");
assert(release.id === contract.id && release.version === contract.version && release.tag === "public-app-essentials-v1.1.1", "release identity");
assert(release.artifacts["dist/milos-app-essentials.css"] === digest(css), "release CSS hash");
assert(release.artifacts["dist/milos-app-essentials.js"] === digest(runtime), "release runtime hash");
assert(release.artifacts["dist/verify.mjs"] === digest(verifier), "release verifier hash");
assert(release.artifacts["essentials-manifest.schema.json"] === digest(manifestSchemaContent), "release manifest schema hash");

const cssText = css.toString("utf8");
for (const marker of [
  "milos-app-shell:not(:defined) > [slot=\"app-icon\"]",
  "width: min(56px, 18vw)",
  "max-width: 48px",
  "data-milos-app-loading",
  "data-milos-privacy-notice",
  "min-height: var(--milos-essential-target)",
  "data-milos-date-row",
  "container-name: milos-date-picker",
  "@container milos-date-picker",
  "padding-inline-end: 2.25rem",
  "position: fixed",
  "env(safe-area-inset-bottom)",
  "data-milos-share-status][data-visible=\"false\"]",
  "data-milos-place-results",
  "prefers-reduced-motion: reduce"
]) assert(cssText.includes(marker), `runtime CSS marker: ${marker}`);
assert(!cssText.includes("min-width: 20rem"), "fixed viewport floor forbidden");
const shareStatusCss = cssText.match(/\[data-milos-share-status\]\s*\{([^}]*)\}/s)?.[1] || "";
assert(shareStatusCss.includes("position: fixed") && shareStatusCss.includes("safe-area-inset-left") && shareStatusCss.includes("safe-area-inset-bottom"), "share feedback is viewport-fixed and safe-area bounded");

const runtimeText = runtime.toString("utf8");
for (const marker of ["navigator.share", "navigator.clipboard", "milosapps:datechange", "milosapps:placechange", "milosapps:ready", "role\", \"combobox", "setSuggestionsProvider", "suggestionRequestId", "searchRequestId", "locateRequestId", "connectionEpoch", "consumer-autocomplete-proxy", "disconnectedCallback", "storageRemove"] ) {
  assert(runtimeText.includes(marker), `runtime JS marker: ${marker}`);
}
assert(!runtimeText.includes("style.setProperty"), "runtime inline theme mutation forbidden");
assert(!runtimeText.includes("queueSearch"), "place search must not autocomplete on input");
assert(!runtimeText.includes("localeCopy().shared"), "native share success remains visually silent");
assert(!runtimeText.includes("essentialCookieInfo") && !runtimeText.includes("storageSet("), "informational privacy dismissal never creates optional persistent state");
assert(/input\.addEventListener\("change", \(event\) => \{ event\.stopPropagation\(\)/.test(runtimeText) && /year\.addEventListener\("change", \(event\) => \{ event\.stopPropagation\(\)/.test(runtimeText), "native date changes are stopped before the single host change event");
assert(runtimeText.includes("direction > 0 ? 0 : this.results.length - 1"), "initial ArrowUp selects the final place option");
assert(runtimeText.includes("currentQuery === query") && runtimeText.includes("[place.name, place.region, place.country]"), "place rejection and selected display retain current query and country");
assert(/if \(this\.locale && this\.locale !== selected\)[\s\S]+?cancelSuggestions\(\);[\s\S]+?cancelSearch\(\);[\s\S]+?cancelLocate\(\);/.test(runtimeText), "locale changes invalidate all place operations");
assert((runtimeText.match(/dataset\.milosReady === "true"\) \{[\s\S]{0,100}?setLocale\(activeLocale\)/g) || []).length >= 3, "share, date and place resynchronize locale after reconnect");
assert(runtimeText.indexOf('if (event.key === "Escape")') < runtimeText.indexOf("if (!this.results.length)"), "Escape cancels before empty-result early return");
assert(/if \(event\.key === "Escape"\)[\s\S]+?cancelSuggestions\(\);[\s\S]+?cancelSearch\(\);/.test(runtimeText), "Escape cancels both place request types");
assert(/input\.addEventListener\("input"[\s\S]+?cancelSearch\(\);[\s\S]+?queueSuggestions\(\);/.test(runtimeText), "new input invalidates submit search before suggestions");
assert(/input\.addEventListener\("input"[\s\S]+?cancelLocate\(\);[\s\S]+?cancelSearch\(\);/.test(runtimeText), "new input invalidates device location");
assert(/async runSearch\(\)[\s\S]+?cancelLocate\(\);[\s\S]+?cancelSuggestions\(\);/.test(runtimeText), "explicit search invalidates device location");
assert(/queueSuggestions\(\)[\s\S]+?cancelLocate\(\);[\s\S]+?cancelSuggestions\(\);/.test(runtimeText), "suggestion queue invalidates device location");
assert(/select\(place\)[\s\S]+?cancelSuggestions\(\);[\s\S]+?cancelSearch\(\);[\s\S]+?cancelLocate\(\);/.test(runtimeText), "place selection invalidates all place providers");
assert(runtimeText.includes("isCurrentPlaceOperation") && runtimeText.includes("!signal?.aborted"), "place operations reject stale or aborted results");
assert((runtimeText.match(/disconnectedCallback\(\)/g) || []).length >= 2, "share and place components clean up on disconnect");
assert(runtimeText.includes('if (activeConfig.privacy.usesLocalStorage) storageRemove(`milosapps.${activeConfig.appKey}.privacyNotice.v1`)'), "legacy privacy cleanup is app-namespaced and never accesses storage when disabled");
assert(runtimeText.includes("normalizeStoragePurposes") && runtimeText.includes("Optional device storage is forbidden"), "runtime rejects undeclared or optional device storage");
assert(verifier.toString("utf8").includes('manifest.privacy?.mode !== "no-cookies"'), "verifier enumerates privacy modes");
assert(verifier.toString("utf8").includes("validateStoragePurposes") && verifier.toString("utf8").includes("optional device storage is forbidden"), "verifier rejects optional device storage");
assert(syncText.includes('execFileSync("git"') && syncText.includes("does not match --source-commit") && syncText.includes("release checksum mismatch"), "sync verifies Git-object and release provenance");
assert(readme.includes("kein Einwilligungsbanner") && readme.includes("Migration von 1.0.0 oder 1.1.0 auf 1.1.1") && readme.includes("consumer-autocomplete-proxy") && readme.includes("pauschales Hostwort-Verbot") && readme.includes("keine Rechtsberatung"), "README explains migration, privacy and provider boundaries");

const lifecycleAssertions = await validateLifecycle(new URL("../dist/milos-app-essentials.js", import.meta.url));
assert(lifecycleAssertions >= 12, "deterministic disconnect/reconnect lifecycle regressions");

await syncEssentials({ "app-root": fixtureRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
const fixture = await verifyEssentials(fixtureRoot, "essentials-manifest.json");
assert(fixture.appKey === "reference-app" && fixture.version === "1.1.1", "reference fixture verifies");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "milos-essentials-v1-"));
try {
  const tamperedRoot = path.join(tempRoot, "tampered");
  await cp(fixtureRoot, tamperedRoot, { recursive: true });
  await writeFile(path.join(tamperedRoot, "vendor", "milosapps-essentials", "v1", "milos-app-essentials.css"), "tampered", "utf8");
  await expectFailure(() => verifyEssentials(tamperedRoot, "essentials-manifest.json"), /checksum mismatch/, "tampered artifact");

  const missingOwnerRoot = path.join(tempRoot, "missing-owner");
  await cp(fixtureRoot, missingOwnerRoot, { recursive: true });
  const missingOwnerPath = path.join(missingOwnerRoot, "essentials-manifest.json");
  const missingOwnerManifest = JSON.parse(await readFile(missingOwnerPath, "utf8"));
  delete missingOwnerManifest.ownerTask;
  await writeFile(missingOwnerPath, `${JSON.stringify(missingOwnerManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": missingOwnerRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /ownerTask: required property missing/,
    "manifest required properties"
  );

  const extraPropertyRoot = path.join(tempRoot, "extra-property");
  await cp(fixtureRoot, extraPropertyRoot, { recursive: true });
  const extraPropertyPath = path.join(extraPropertyRoot, "essentials-manifest.json");
  const extraPropertyManifest = JSON.parse(await readFile(extraPropertyPath, "utf8"));
  extraPropertyManifest.uncontracted = true;
  await writeFile(extraPropertyPath, `${JSON.stringify(extraPropertyManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(extraPropertyRoot, "essentials-manifest.json"), /additional property/, "manifest additional properties");

  const startupDisabledRoot = path.join(tempRoot, "startup-disabled");
  await cp(fixtureRoot, startupDisabledRoot, { recursive: true });
  const startupDisabledPath = path.join(startupDisabledRoot, "essentials-manifest.json");
  const startupDisabledManifest = JSON.parse(await readFile(startupDisabledPath, "utf8"));
  startupDisabledManifest.features.startup = false;
  await writeFile(startupDisabledPath, `${JSON.stringify(startupDisabledManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": startupDisabledRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /startup|differs from const/i,
    "required startup"
  );

  const adaptiveThemeRoot = path.join(tempRoot, "adaptive-theme");
  await cp(fixtureRoot, adaptiveThemeRoot, { recursive: true });
  const adaptiveThemePath = path.join(adaptiveThemeRoot, "essentials-manifest.json");
  const adaptiveThemeManifest = JSON.parse(await readFile(adaptiveThemePath, "utf8"));
  adaptiveThemeManifest.theme = {
    accent: "var(--accent-text)",
    accentContrast: "var(--paper)",
    surface: "var(--card)",
    surfaceSoft: "var(--paper)",
    text: "var(--ink)",
    muted: "var(--ink-muted)",
    border: "var(--line)",
    focus: "var(--focus)"
  };
  await writeFile(adaptiveThemePath, `${JSON.stringify(adaptiveThemeManifest, null, 2)}\n`, "utf8");
  const adaptiveThemeSync = await syncEssentials({ "app-root": adaptiveThemeRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const adaptiveThemeCss = await readFile(path.join(adaptiveThemeSync.vendorRoot, "milos-app-essentials-theme.css"), "utf8");
  assert(adaptiveThemeCss.includes("--milos-essential-surface: var(--card);"), "safe app theme custom properties survive sync");

  const remoteThemeRoot = path.join(tempRoot, "remote-theme");
  await cp(fixtureRoot, remoteThemeRoot, { recursive: true });
  const remoteThemePath = path.join(remoteThemeRoot, "essentials-manifest.json");
  const remoteThemeManifest = JSON.parse(await readFile(remoteThemePath, "utf8"));
  remoteThemeManifest.theme.surface = "url(https://tracker.example/pixel)";
  await writeFile(remoteThemePath, `${JSON.stringify(remoteThemeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": remoteThemeRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /theme\.surface|pattern mismatch|color token/i,
    "remote theme asset"
  );

  const injectedThemeRoot = path.join(tempRoot, "injected-theme");
  await cp(fixtureRoot, injectedThemeRoot, { recursive: true });
  const injectedThemePath = path.join(injectedThemeRoot, "essentials-manifest.json");
  const injectedThemeManifest = JSON.parse(await readFile(injectedThemePath, "utf8"));
  injectedThemeManifest.theme.surface = "var(--paper, url(https://tracker.example/pixel))";
  await writeFile(injectedThemePath, `${JSON.stringify(injectedThemeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": injectedThemeRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /theme\.surface|pattern mismatch|color token/i,
    "injected theme fallback"
  );

  const commentedStylesRoot = path.join(tempRoot, "commented-styles");
  await cp(fixtureRoot, commentedStylesRoot, { recursive: true });
  const commentedStylesPath = path.join(commentedStylesRoot, "index.html");
  const commentedStylesEntry = await readFile(commentedStylesPath, "utf8");
  await writeFile(commentedStylesPath, commentedStylesEntry.replace(/(\s*<link rel="stylesheet" href="vendor\/milosapps-essentials\/v1\/milos-app-essentials\.css">)/, "\n    <!--$1 -->"), "utf8");
  await expectFailure(() => verifyEssentials(commentedStylesRoot, "essentials-manifest.json"), /link elements/, "comment-only stylesheet marker");

  const commentedReadyRoot = path.join(tempRoot, "commented-ready");
  await cp(fixtureRoot, commentedReadyRoot, { recursive: true });
  const commentedReadyPath = path.join(commentedReadyRoot, "app.js");
  const commentedReadySource = await readFile(commentedReadyPath, "utf8");
  await writeFile(commentedReadyPath, commentedReadySource.replace('document.dispatchEvent(new CustomEvent("milosapps:ready"));', '// document.dispatchEvent(new CustomEvent("milosapps:ready"));'), "utf8");
  await expectFailure(() => verifyEssentials(commentedReadyRoot, "essentials-manifest.json"), /signal readiness/, "comment-only ready marker");

  const wrongProvenanceRoot = path.join(tempRoot, "wrong-provenance");
  await cp(fixtureRoot, wrongProvenanceRoot, { recursive: true });
  const wrongProvenancePath = path.join(wrongProvenanceRoot, "essentials-manifest.json");
  const wrongProvenanceManifest = JSON.parse(await readFile(wrongProvenancePath, "utf8"));
  const wrongCommit = execFileSync("git", ["-C", path.resolve(root, "../../.."), "rev-parse", "HEAD^"], { encoding: "utf8" }).trim();
  wrongProvenanceManifest.appKey = "cloud-post";
  wrongProvenanceManifest.ownerTask = "MilosApps – Wolkenpost";
  wrongProvenanceManifest.privacy.storagePurposes[0].key = "milosapps.cloud-post.locale";
  wrongProvenanceManifest.essentialsContract.sharedCommit = wrongCommit;
  await writeFile(wrongProvenancePath, `${JSON.stringify(wrongProvenanceManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": wrongProvenanceRoot, manifest: "essentials-manifest.json", "source-commit": wrongCommit }),
    /does not match --source-commit/,
    "wrong Shared source provenance"
  );

  if (process.env.CI) {
    const exactProvenanceRoot = path.join(tempRoot, "exact-provenance");
    await cp(fixtureRoot, exactProvenanceRoot, { recursive: true });
    const exactProvenancePath = path.join(exactProvenanceRoot, "essentials-manifest.json");
    const exactProvenanceManifest = JSON.parse(await readFile(exactProvenancePath, "utf8"));
    const exactCommit = execFileSync("git", ["-C", path.resolve(root, "../../.."), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    exactProvenanceManifest.appKey = "cloud-post";
    exactProvenanceManifest.ownerTask = "MilosApps – Wolkenpost";
    exactProvenanceManifest.privacy.storagePurposes[0].key = "milosapps.cloud-post.locale";
    exactProvenanceManifest.essentialsContract.sharedCommit = exactCommit;
    await writeFile(exactProvenancePath, `${JSON.stringify(exactProvenanceManifest, null, 2)}\n`, "utf8");
    const exactSync = await syncEssentials({ "app-root": exactProvenanceRoot, manifest: "essentials-manifest.json", "source-commit": exactCommit });
    assert(exactSync.lock.sharedCommit === exactCommit, "exact committed Shared source provenance syncs");
  }

  const trackingRoot = path.join(tempRoot, "tracking");
  await cp(fixtureRoot, trackingRoot, { recursive: true });
  const trackingManifestPath = path.join(trackingRoot, "essentials-manifest.json");
  const trackingManifest = JSON.parse(await readFile(trackingManifestPath, "utf8"));
  trackingManifest.privacy.optionalTracking = true;
  await writeFile(trackingManifestPath, `${JSON.stringify(trackingManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": trackingRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /optionalTracking/,
    "optional tracking"
  );

  const missingStoragePurposeRoot = path.join(tempRoot, "missing-storage-purpose");
  await cp(fixtureRoot, missingStoragePurposeRoot, { recursive: true });
  const missingStoragePurposePath = path.join(missingStoragePurposeRoot, "essentials-manifest.json");
  const missingStoragePurposeManifest = JSON.parse(await readFile(missingStoragePurposePath, "utf8"));
  missingStoragePurposeManifest.privacy.storagePurposes = [];
  await writeFile(missingStoragePurposePath, `${JSON.stringify(missingStoragePurposeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": missingStoragePurposeRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /storagePurposes/,
    "missing necessary storage purpose"
  );

  const optionalStorageRoot = path.join(tempRoot, "optional-storage");
  await cp(fixtureRoot, optionalStorageRoot, { recursive: true });
  const optionalStoragePath = path.join(optionalStorageRoot, "essentials-manifest.json");
  const optionalStorageManifest = JSON.parse(await readFile(optionalStoragePath, "utf8"));
  optionalStorageManifest.privacy.storagePurposes[0].strictlyNecessary = false;
  await writeFile(optionalStoragePath, `${JSON.stringify(optionalStorageManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(optionalStorageRoot, "essentials-manifest.json"), /strictlyNecessary/, "optional device storage");

  const invalidPrivacyModeRoot = path.join(tempRoot, "invalid-privacy-mode");
  await cp(fixtureRoot, invalidPrivacyModeRoot, { recursive: true });
  const invalidPrivacyManifestPath = path.join(invalidPrivacyModeRoot, "essentials-manifest.json");
  const invalidPrivacyManifest = JSON.parse(await readFile(invalidPrivacyManifestPath, "utf8"));
  invalidPrivacyManifest.privacy.mode = "optional";
  await writeFile(invalidPrivacyManifestPath, `${JSON.stringify(invalidPrivacyManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(invalidPrivacyModeRoot, "essentials-manifest.json"), /privacy\.mode/, "unknown privacy mode");

  const fakeNoCookieBannerRoot = path.join(tempRoot, "fake-no-cookie-banner");
  await cp(fixtureRoot, fakeNoCookieBannerRoot, { recursive: true });
  const fakeNoCookieManifestPath = path.join(fakeNoCookieBannerRoot, "essentials-manifest.json");
  const fakeNoCookieManifest = JSON.parse(await readFile(fakeNoCookieManifestPath, "utf8"));
  fakeNoCookieManifest.features.privacyNotice = true;
  await writeFile(fakeNoCookieManifestPath, `${JSON.stringify(fakeNoCookieManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": fakeNoCookieBannerRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /privacyNotice/,
    "no-cookies fake banner"
  );

  const missingPrivacyInfoRoot = path.join(tempRoot, "missing-privacy-info");
  await cp(fixtureRoot, missingPrivacyInfoRoot, { recursive: true });
  const missingPrivacyEntryPath = path.join(missingPrivacyInfoRoot, "index.html");
  const missingPrivacyEntry = await readFile(missingPrivacyEntryPath, "utf8");
  await writeFile(missingPrivacyEntryPath, missingPrivacyEntry.replace("data-milos-privacy-info", "data-app-privacy-info"), "utf8");
  await expectFailure(() => verifyEssentials(missingPrivacyInfoRoot, "essentials-manifest.json"), /persistent consumer-owned privacy information/, "missing persistent privacy info");

  const suggestionsRoot = path.join(tempRoot, "suggestions");
  await cp(fixtureRoot, suggestionsRoot, { recursive: true });
  const suggestionsManifestPath = path.join(suggestionsRoot, "essentials-manifest.json");
  const suggestionsManifest = JSON.parse(await readFile(suggestionsManifestPath, "utf8"));
  suggestionsManifest.features.placeSuggestions = {
    enabled: true,
    minChars: 3,
    debounceMs: 350,
    providerCapability: "consumer-autocomplete-proxy",
    evidenceFile: "suggestions-provider.md"
  };
  await writeFile(suggestionsManifestPath, `${JSON.stringify(suggestionsManifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(suggestionsRoot, "suggestions-provider.md"), "# App-owned autocomplete proxy\n\nProvider capability reviewed by the consumer.\n", "utf8");
  const suggestionsAppPath = path.join(suggestionsRoot, "app.js");
  const suggestionsApp = await readFile(suggestionsAppPath, "utf8");
  await writeFile(suggestionsAppPath, `${suggestionsApp}\nplaceSearch.setSuggestionsProvider(async () => []);\n`, "utf8");
  await syncEssentials({ "app-root": suggestionsRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const suggestionsFixture = await verifyEssentials(suggestionsRoot, "essentials-manifest.json");
  assert(suggestionsFixture.features.placeSuggestions.enabled === true, "evidenced consumer suggestions verify");
  await writeFile(suggestionsAppPath, `${await readFile(suggestionsAppPath, "utf8")}\nconst explicitSubmitProviderUrl = "https://nominatim.openstreetmap.org/search";\n`, "utf8");
  const nominatimSubmitFixture = await verifyEssentials(suggestionsRoot, "essentials-manifest.json");
  assert(nominatimSubmitFixture.features.placeSuggestions.enabled === true, "public Nominatim host may coexist with separate evidenced suggestions proxy");

  const missingSuggestionsEvidenceRoot = path.join(tempRoot, "missing-suggestions-evidence");
  await cp(suggestionsRoot, missingSuggestionsEvidenceRoot, { recursive: true });
  const missingEvidenceManifestPath = path.join(missingSuggestionsEvidenceRoot, "essentials-manifest.json");
  const missingEvidenceManifest = JSON.parse(await readFile(missingEvidenceManifestPath, "utf8"));
  missingEvidenceManifest.features.placeSuggestions.evidenceFile = "missing-suggestions-provider.md";
  await writeFile(missingEvidenceManifestPath, `${JSON.stringify(missingEvidenceManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(missingSuggestionsEvidenceRoot, "essentials-manifest.json"), /suggestions evidence is missing/, "missing suggestions evidence");

  const noLoaderRoot = path.join(tempRoot, "no-loader");
  await cp(fixtureRoot, noLoaderRoot, { recursive: true });
  const entryPath = path.join(noLoaderRoot, "index.html");
  const entry = await readFile(entryPath, "utf8");
  await writeFile(entryPath, entry.replace("data-milos-loading-card", "data-app-loading-card"), "utf8");
  await expectFailure(() => verifyEssentials(noLoaderRoot, "essentials-manifest.json"), /startup marker/, "missing loader marker");

  const noShareRoot = path.join(tempRoot, "no-share");
  await cp(fixtureRoot, noShareRoot, { recursive: true });
  const noShareEntryPath = path.join(noShareRoot, "index.html");
  const noShareEntry = await readFile(noShareEntryPath, "utf8");
  await writeFile(noShareEntryPath, noShareEntry.replace("milos-share-button", "app-share-button"), "utf8");
  await expectFailure(() => verifyEssentials(noShareRoot, "essentials-manifest.json"), /share control/, "missing share control");

  const escapeRoot = path.join(tempRoot, "escape");
  await cp(fixtureRoot, escapeRoot, { recursive: true });
  const escapeManifestPath = path.join(escapeRoot, "essentials-manifest.json");
  const escapeManifest = JSON.parse(await readFile(escapeManifestPath, "utf8"));
  escapeManifest.essentialsContract.vendorDirectory = "../outside";
  await writeFile(escapeManifestPath, `${JSON.stringify(escapeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": escapeRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /vendorDirectory|inside app root/,
    "path escape"
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write(`public-app-essentials/v1 validation: PASS (${assertions} assertions)\n`);
process.stdout.write("Startup, truthful privacy, share, native date and provider-neutral place search: verified; Production: blocked\n");
