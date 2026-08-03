import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertImmutableReleaseCommit, syncEssentials } from "./sync.mjs";
import { schemaErrors, verifyEssentials } from "../dist/verify.mjs";
import { verifyApp as verifyShellApp } from "../../../public-app-shell/v2/dist/verify.mjs";
import { validateLifecycle } from "./lifecycle-regression.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(root, "fixtures", "reference-app");
const shellFixtureRoot = path.resolve(root, "../../public-app-shell/v2/fixtures/reference-app");
const zeroCommit = "0".repeat(40);
const expectedConsumers = ["portal", "noodle-calculator", "sky", "cloud-post", "somewhere-now", "gravity-loop", "waste-guide", "daylight"].sort();
const expectedReleaseArtifacts = ["dist/milos-app-essentials.css", "dist/milos-app-essentials.js", "dist/verify.mjs", "essentials-manifest.schema.json", "tools/sync.mjs"].sort();
const expectedConsumerArtifacts = ["milos-app-essentials.css", "milos-app-essentials-theme.css", "milos-app-essentials.js", "bootstrap.js", "verify.mjs", "essentials-manifest.schema.json"].sort();
const expectedRuntimeArtifacts = ["milos-app-essentials.css", "milos-app-essentials-theme.css", "milos-app-essentials.js", "bootstrap.js"];
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
const fixtureManifest = await json("fixtures/reference-app/essentials-manifest.json");
const release = await json("release.json");
const css = await readFile(path.join(root, "dist", "milos-app-essentials.css"));
const runtime = await readFile(path.join(root, "dist", "milos-app-essentials.js"));
const verifier = await readFile(path.join(root, "dist", "verify.mjs"));
const syncContent = await readFile(path.join(root, "tools", "sync.mjs"));
const syncText = syncContent.toString("utf8");
const readme = await readFile(path.join(root, "README.md"), "utf8");
const referenceEntry = await readFile(path.join(fixtureRoot, "index.html"), "utf8");
const referenceFallback = await readFile(path.join(fixtureRoot, "loading.html"), "utf8");

assert(contract.id === "public-app-essentials/v1" && contract.version === "1.1.3", "contract id/version");
assert(contract.status === "stable", "stable contract status");
assert(schemaErrors(schema, contract).length === 0, "contract validates against its schema");
assert(schema.properties.id.const === contract.id && schema.properties.version.const === contract.version, "contract schema pins id/version");
assert(JSON.stringify([...contract.eligibleConsumers].sort()) === JSON.stringify(expectedConsumers), "exact eligible consumers");
assert(contract.excludedConsumers.includes("calendar") && contract.excludedClasses.includes("login-required-app"), "calendar and login apps excluded");
assert(contract.modules.startup.iconMaxPx === 32 && contract.modules.startup.iconMaxMobilePx === 32 && contract.quality.startupIconMaxPx === 32, "uniform 32px startup icon");
assert(contract.delivery.loadingIconSourceRuntimeSeparationSupported && contract.modules.startup.iconSourcePathField === "loading.iconPath" && contract.modules.startup.iconRuntimePathField === "loading.iconRuntimePath" && contract.modules.startup.iconRuntimePathFallback === "loading.iconPath", "loading icon source and runtime paths are distinct with a compatible fallback");
assert(contract.delivery.consumerEntryRuntimePathScope === "declared-source-entry-html" && contract.delivery.consumerBuildRuntimeVerificationRequired && contract.quality.builtConsumerEntryHttpQaRequired, "source entry path and generated build runtime are verified at their proper boundaries");
assert(contract.modules.startup.runtimeIconResponseQaRequired && contract.modules.startup.runtimeIconContentType === "image/svg+xml" && contract.modules.startup.runtimeIconSourceSha256MatchRequired, "consumer QA proves the routed icon response and source identity");
assert(contract.modules.startup.readyApi === "globalThis.milosAppEssentials.ready()" && contract.modules.startup.directConsumerEventDispatchAllowed === false, "race-safe generated readiness API");
assert(contract.modules.privacyNotice.privacyInformationRequired === true && contract.modules.privacyNotice.runtimeNoticeRequiredByMode["no-cookies"] === false && contract.modules.privacyNotice.runtimeNoticeRequiredByMode["essential-only"] === true, "persistent privacy information is distinct from the mode-dependent runtime notice");
assert(contract.modules.privacyNotice.fakeConsentForbidden && contract.modules.privacyNotice.optionalTrackingAllowed === false, "truthful privacy notice");
assert(contract.modules.privacyNotice.optionalDeviceStorageAllowed === false && contract.modules.privacyNotice.storagePurposeDeclarationRequired && contract.modules.privacyNotice.storagePurposesMustBeStrictlyNecessary && contract.modules.privacyNotice.consentContractIncluded === false, "device storage is purpose-bound without implied consent");
assert(JSON.stringify(contract.modules.privacyNotice.permanentLinkEvidence) === JSON.stringify(["consumer-owned-link", "public-app-shell/v2"]) && contract.modules.privacyNotice.shellFooterManifestReferenceField === "privacy.permanentLink.manifest" && contract.modules.privacyNotice.shellFooterRequiresMatchingAppEnvironmentEntryAndCanonicalUrl && contract.modules.privacyNotice.shellFooterRequiresSeparateShellVerification, "permanent privacy information can reuse the verified Shell v2 footer without duplication");
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
assert(contract.delivery.manifestSchemaLocked && contract.delivery.manifestConfigurationLocked && contract.delivery.runtimeBasePathRequired && contract.delivery.consumerEntryModuleRequired && contract.delivery.sourceCommitProvenanceRequired && contract.delivery.bootstrapBeforeConsumerModulesRequired && contract.delivery.asyncModuleScriptsAllowed === false && contract.delivery.consumerArtifactCount === 6 && contract.delivery.releaseSourceArtifactCount === 5 && contract.delivery.symlinkedDestinationsForbidden && contract.delivery.hardLinkedDestinationsForbidden && contract.quality.themeColorTokensOnly && contract.quality.commentMarkersDoNotCountAsIntegration && contract.quality.consumerBrowserQaRequired, "schema, manifest, provenance, path, consumer entry, bootstrap, theme and real integration gates");
assert(JSON.stringify(contract.delivery.runtimeAssets.map(({ file }) => file)) === JSON.stringify(expectedRuntimeArtifacts), "exact four browser runtime artifacts");
assert(contract.quality.adaptiveThemeCustomPropertyPattern === "var(--[a-z0-9]+(?:-[a-z0-9]+)*)", "safe adaptive theme custom properties are explicit");
assert(manifestSchema.required.includes("$schema") && manifestSchema.properties.$schema.type === "string", "manifest requires its vendored schema declaration");
assert(manifestSchema.properties.privacy.properties.permanentLink.properties.provider.const === "public-app-shell/v2", "manifest schema offers only the verified Shell v2 permanent-link provider");
assert(schemaErrors(manifestSchema, example).length === 0, "example validates against the complete manifest schema");
assert(Object.keys(example).every((key) => Object.hasOwn(manifestSchema.properties, key)), "example uses schema properties only");
assert(example.public === true && example.loginRequired === false && example.productionApproved === false, "example public DEV boundary");
assert(example.privacy.optionalTracking === false && example.features.privacyNotice === false && example.features.share === true, "example no-cookies/share boundary");
assert(example.privacy.usesLocalStorage && example.privacy.storagePurposes.length === 1 && example.privacy.storagePurposes[0].strictlyNecessary === true, "example declares necessary app storage purpose");
assert(example.features.placeSuggestions.enabled === false && example.features.placeSuggestions.providerCapability === "submit-only", "example defaults to submit-only place search");
assert(example.$schema === "./vendor/milosapps-essentials/v1/essentials-manifest.schema.json" && example.essentialsContract.runtimeBasePath === "vendor/milosapps-essentials/v1" && example.consumerEntryModule.sourceFile === "app.js" && example.consumerEntryModule.runtimePath === "app.js" && example.loading.iconPath === "icon.svg" && example.loading.iconRuntimePath === "icon.svg", "example uses its locked schema and explicit runtime/consumer/icon paths");
assert(release.id === contract.id && release.version === contract.version && release.tag === "public-app-essentials-v1.1.3", "release identity");
assert(JSON.stringify(Object.keys(release.artifacts || {}).sort()) === JSON.stringify(expectedReleaseArtifacts), "exact release source artifact set");
assert(release.artifacts["dist/milos-app-essentials.css"] === digest(css), "release CSS hash");
assert(release.artifacts["dist/milos-app-essentials.js"] === digest(runtime), "release runtime hash");
assert(release.artifacts["dist/verify.mjs"] === digest(verifier), "release verifier hash");
assert(release.artifacts["essentials-manifest.schema.json"] === digest(manifestSchemaContent), "release manifest schema hash");
assert(release.artifacts["tools/sync.mjs"] === digest(syncContent), "release sync generator hash");
assertImmutableReleaseCommit("a".repeat(40), "a".repeat(40));
await expectFailure(() => assertImmutableReleaseCommit("b".repeat(40), "a".repeat(40)), /immutable release tag commit/, "content-identical non-tag commit");

const cssText = css.toString("utf8");
for (const marker of [
  "milos-app-shell:not(:defined) > [slot=\"app-icon\"]",
  "width: min(32px, 18vw)",
  "max-width: 32px",
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
assert(!/min\((?:48|56)px,\s*18vw\)|max-(?:width|height):\s*(?:48|56)px/.test(cssText), "legacy loader icon sizes are absent");
for (const [label, source] of [["reference entry", referenceEntry], ["HTML-before-CSS fallback", referenceFallback]]) {
  assert(source.includes('<img data-milos-loading-icon src="icon.svg" width="32" height="32" alt="">'), `${label} starts with an exact 32px loading icon`);
}
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
assert(!runtimeText.includes("storageSet("), "informational privacy dismissal never creates optional persistent state");
assert(/input\.addEventListener\("change", \(event\) => \{ event\.stopPropagation\(\)/.test(runtimeText) && /year\.addEventListener\("change", \(event\) => \{[\s\S]{0,80}?event\.stopPropagation\(\)/.test(runtimeText), "native date changes are stopped before the single host change event");
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
assert(runtimeText.includes('storageRemove(`milosapps.${activeConfig.appKey}.privacyNotice.v1`)') && runtimeText.includes('storageRemove(`milosapps.${activeConfig.appKey}.essentialCookieInfo.v1`)'), "both legacy privacy cleanup keys are app-namespaced and never accessed when storage is disabled");
assert(runtimeText.includes("normalizeStoragePurposes") && runtimeText.includes("Optional device storage is forbidden"), "runtime rejects undeclared or optional device storage");
assert(verifier.toString("utf8").includes('manifest.privacy?.mode !== "no-cookies"'), "verifier enumerates privacy modes");
assert(verifier.toString("utf8").includes("validateStoragePurposes") && verifier.toString("utf8").includes("optional device storage is forbidden"), "verifier rejects optional device storage");
assert(verifier.toString("utf8").includes('width !== "32" || height !== "32"') && verifier.toString("utf8").includes("exactly 32") && !verifier.toString("utf8").includes('Number(attributeValue(loadingIcon'), "verifier requires exact raw 32px fallback dimensions");
assert(syncText.includes('execFileSync("git"') && syncText.includes("does not match --source-commit") && syncText.includes("release checksum mismatch"), "sync verifies Git-object and release provenance");
assert(readme.includes("kein Einwilligungsbanner") && readme.includes("Migration von 1.0.0 bis 1.1.2 auf 1.1.3") && readme.includes('width="32" height="32"') && readme.includes("privacy.permanentLink") && readme.includes("public-app-shell/v2") && readme.includes("runtimeBasePath") && readme.includes("Modul-URL im deklarierten Quell-`entryHtml`") && readme.includes("loading.iconRuntimePath") && readme.includes("image/svg+xml") && readme.includes("SHA-256") && readme.includes("Post-Build-/HTTP-Gate") && readme.includes("globalThis.milosAppEssentials.ready()") && !readme.includes('new CustomEvent("milosapps:ready")') && readme.includes("consumer-autocomplete-proxy") && readme.includes("pauschales Hostwort-Verbot") && readme.includes("keine Rechtsberatung") && readme.includes("core.autocrlf=true"), "README explains 32px fallback, verified Shell privacy evidence, source/build entry boundaries, icon response QA, readiness, LF and provider boundaries without the legacy event recipe");

const lifecycleAssertions = await validateLifecycle(new URL("../dist/milos-app-essentials.js", import.meta.url));
assert(lifecycleAssertions >= 27, "deterministic lifecycle, privacy, date and provider regressions");

const fixture = await verifyEssentials(fixtureRoot, "essentials-manifest.json");
assert(fixture.appKey === "reference-app" && fixture.version === "1.1.3", "reference fixture verifies");
const fixtureLock = await json("fixtures/reference-app/vendor/milosapps-essentials/v1/essentials-lock.json");
assert(JSON.stringify(Object.keys(fixtureLock.artifacts || {}).sort()) === JSON.stringify(expectedConsumerArtifacts), "exact consumer lock artifact set");
assert(fixtureLock.loadingIconRuntimePath === fixtureManifest.loading.iconRuntimePath, "loading icon runtime path is locked");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "milos-essentials-v1-"));
try {
  const freshFixtureRoot = path.join(tempRoot, "fresh-fixture");
  await cp(fixtureRoot, freshFixtureRoot, { recursive: true });
  await syncEssentials({ "app-root": freshFixtureRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  for (const artifact of [...expectedConsumerArtifacts, "essentials-lock.json"]) {
    const checked = await readFile(path.join(fixtureRoot, "vendor", "milosapps-essentials", "v1", artifact));
    const fresh = await readFile(path.join(freshFixtureRoot, "vendor", "milosapps-essentials", "v1", artifact));
    assert(checked.equals(fresh), `checked reference fixture is deterministic: ${artifact}`);
  }

  const canonicalManifestRoot = path.join(tempRoot, "canonical-manifest");
  await cp(fixtureRoot, canonicalManifestRoot, { recursive: true });
  const canonicalManifestPath = path.join(canonicalManifestRoot, "essentials-manifest.json");
  const canonicalManifest = JSON.parse(await readFile(canonicalManifestPath, "utf8"));
  const reorderedManifest = Object.fromEntries(Object.entries(canonicalManifest).reverse());
  await writeFile(canonicalManifestPath, `\n  ${JSON.stringify(reorderedManifest, null, 4)}\n`, "utf8");
  const canonicalFixture = await verifyEssentials(canonicalManifestRoot, "essentials-manifest.json");
  assert(canonicalFixture.appKey === "reference-app", "canonical manifest lock ignores formatting and object-key order");

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

  const missingSchemaRoot = path.join(tempRoot, "missing-schema-reference");
  await cp(fixtureRoot, missingSchemaRoot, { recursive: true });
  const missingSchemaPath = path.join(missingSchemaRoot, "essentials-manifest.json");
  const missingSchemaManifest = JSON.parse(await readFile(missingSchemaPath, "utf8"));
  delete missingSchemaManifest.$schema;
  await writeFile(missingSchemaPath, `${JSON.stringify(missingSchemaManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(missingSchemaRoot, "essentials-manifest.json"), /\$schema|required property/, "missing vendored schema reference");

  const wrongSchemaRoot = path.join(tempRoot, "wrong-schema-reference");
  await cp(fixtureRoot, wrongSchemaRoot, { recursive: true });
  const wrongSchemaPath = path.join(wrongSchemaRoot, "essentials-manifest.json");
  const wrongSchemaManifest = JSON.parse(await readFile(wrongSchemaPath, "utf8"));
  wrongSchemaManifest.$schema = "./other/essentials-manifest.schema.json";
  await writeFile(wrongSchemaPath, `${JSON.stringify(wrongSchemaManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(wrongSchemaRoot, "essentials-manifest.json"), /\$schema must resolve/, "wrong vendored schema reference");

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

  for (const [name, value] of [["invalid-hex-theme", "#12345"], ["unknown-name-theme", "banana"], ["invalid-function-theme", "rgb(,,,)"]]) {
    const invalidThemeRoot = path.join(tempRoot, name);
    await cp(fixtureRoot, invalidThemeRoot, { recursive: true });
    const invalidThemePath = path.join(invalidThemeRoot, "essentials-manifest.json");
    const invalidThemeManifest = JSON.parse(await readFile(invalidThemePath, "utf8"));
    invalidThemeManifest.theme.surface = value;
    await writeFile(invalidThemePath, `${JSON.stringify(invalidThemeManifest, null, 2)}\n`, "utf8");
    await expectFailure(
      () => syncEssentials({ "app-root": invalidThemeRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
      /theme\.surface|pattern mismatch|hex color|custom-property/i,
      name
    );
  }

  const commentedStylesRoot = path.join(tempRoot, "commented-styles");
  await cp(fixtureRoot, commentedStylesRoot, { recursive: true });
  const commentedStylesPath = path.join(commentedStylesRoot, "index.html");
  const commentedStylesEntry = await readFile(commentedStylesPath, "utf8");
  await writeFile(commentedStylesPath, commentedStylesEntry.replace(/(\s*<link rel="stylesheet" href="vendor\/milosapps-essentials\/v1\/milos-app-essentials\.css">)/, "\n    <!--$1 -->"), "utf8");
  await expectFailure(() => verifyEssentials(commentedStylesRoot, "essentials-manifest.json"), /link elements/, "comment-only stylesheet marker");

  const dataAttributeStylesRoot = path.join(tempRoot, "data-attribute-styles");
  await cp(fixtureRoot, dataAttributeStylesRoot, { recursive: true });
  const dataAttributeStylesPath = path.join(dataAttributeStylesRoot, "index.html");
  const dataAttributeStylesEntry = await readFile(dataAttributeStylesPath, "utf8");
  await writeFile(
    dataAttributeStylesPath,
    dataAttributeStylesEntry
      .replace('rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials.css"', 'data-rel="stylesheet" data-href="vendor/milosapps-essentials/v1/milos-app-essentials.css"')
      .replace('rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials-theme.css"', 'data-rel="stylesheet" data-href="vendor/milosapps-essentials/v1/milos-app-essentials-theme.css"'),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(dataAttributeStylesRoot, "essentials-manifest.json"), /link elements/, "data-prefixed stylesheet attributes");

  const dataAttributeScriptRoot = path.join(tempRoot, "data-attribute-script");
  await cp(fixtureRoot, dataAttributeScriptRoot, { recursive: true });
  const dataAttributeScriptPath = path.join(dataAttributeScriptRoot, "index.html");
  const dataAttributeScriptEntry = await readFile(dataAttributeScriptPath, "utf8");
  await writeFile(
    dataAttributeScriptPath,
    dataAttributeScriptEntry.replace('type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"', 'data-type="module" data-src="vendor/milosapps-essentials/v1/bootstrap.js"'),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(dataAttributeScriptRoot, "essentials-manifest.json"), /module script/, "data-prefixed module attributes");

  const lateBootstrapRoot = path.join(tempRoot, "late-bootstrap");
  await cp(fixtureRoot, lateBootstrapRoot, { recursive: true });
  const lateBootstrapPath = path.join(lateBootstrapRoot, "index.html");
  const lateBootstrapEntry = await readFile(lateBootstrapPath, "utf8");
  await writeFile(
    lateBootstrapPath,
    lateBootstrapEntry.replace(
      '    <script type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"></script>\n    <script type="module" src="app.js"></script>',
      '    <script type="module" src="app.js"></script>\n    <script type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"></script>'
    ),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(lateBootstrapRoot, "essentials-manifest.json"), /first module script/, "late bootstrap ordering");

  const asyncModuleRoot = path.join(tempRoot, "async-module");
  await cp(fixtureRoot, asyncModuleRoot, { recursive: true });
  const asyncModulePath = path.join(asyncModuleRoot, "index.html");
  await writeFile(asyncModulePath, (await readFile(asyncModulePath, "utf8")).replace('<script type="module" src="app.js">', '<script type="module" async src="app.js">'), "utf8");
  await expectFailure(() => verifyEssentials(asyncModuleRoot, "essentials-manifest.json"), /async module scripts/, "async consumer module ordering");

  const fakeTagsRoot = path.join(tempRoot, "fake-tags");
  await cp(fixtureRoot, fakeTagsRoot, { recursive: true });
  const fakeTagsPath = path.join(fakeTagsRoot, "index.html");
  const fakeTagsEntry = await readFile(fakeTagsPath, "utf8");
  await writeFile(
    fakeTagsPath,
    fakeTagsEntry.replaceAll("<link rel=", "<link-fake rel=").replaceAll("<script type=", "<script-fake type=").replaceAll("</script>", "</script-fake>"),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(fakeTagsRoot, "essentials-manifest.json"), /link elements|module script/, "custom elements cannot impersonate link or script tags");

  const wrongRuntimePathRoot = path.join(tempRoot, "wrong-runtime-path");
  await cp(fixtureRoot, wrongRuntimePathRoot, { recursive: true });
  const wrongRuntimePathEntry = path.join(wrongRuntimePathRoot, "index.html");
  await writeFile(wrongRuntimePathEntry, (await readFile(wrongRuntimePathEntry, "utf8")).replaceAll("vendor/milosapps-essentials/v1/", "missing/vendor/milosapps-essentials/v1/"), "utf8");
  await expectFailure(() => verifyEssentials(wrongRuntimePathRoot, "essentials-manifest.json"), /link elements|module script/, "wrong local runtime path prefix");

  const wrongRootRuntimePathRoot = path.join(tempRoot, "wrong-root-runtime-path");
  await cp(fixtureRoot, wrongRootRuntimePathRoot, { recursive: true });
  const wrongRootRuntimePathEntry = path.join(wrongRootRuntimePathRoot, "index.html");
  await writeFile(wrongRootRuntimePathEntry, (await readFile(wrongRootRuntimePathEntry, "utf8")).replaceAll("vendor/milosapps-essentials/v1/", "/vendor/milosapps-essentials/v1/"), "utf8");
  await expectFailure(() => verifyEssentials(wrongRootRuntimePathRoot, "essentials-manifest.json"), /link elements|module script/, "origin-root runtime path cannot impersonate a relative app runtime path");

  for (const [name, mutate] of [
    ["disabled-critical-css", (tag) => tag.replace(">", " disabled>")],
    ["alternate-critical-css", (tag) => tag.replace('rel="stylesheet"', 'rel="alternate stylesheet" title="Inactive"')],
    ["inactive-media-critical-css", (tag) => tag.replace(">", ' media="not all">')],
    ["wrong-type-critical-css", (tag) => tag.replace(">", ' type="text/plain">')],
    ["wrong-integrity-critical-css", (tag) => tag.replace(">", ' integrity="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=">')]
  ]) {
    const root = path.join(tempRoot, name);
    await cp(fixtureRoot, root, { recursive: true });
    const entryPath = path.join(root, "index.html");
    const entry = await readFile(entryPath, "utf8");
    await writeFile(entryPath, entry.replace(/<link rel="stylesheet" href="vendor\/milosapps-essentials\/v1\/milos-app-essentials(?:-theme)?\.css">/g, (tag) => mutate(tag)), "utf8");
    await expectFailure(() => verifyEssentials(root, "essentials-manifest.json"), /stylesheets/, `${name} cannot satisfy the active critical stylesheet gate`);
  }

  const remoteBaseRoot = path.join(tempRoot, "remote-base");
  await cp(fixtureRoot, remoteBaseRoot, { recursive: true });
  const remoteBasePath = path.join(remoteBaseRoot, "index.html");
  await writeFile(remoteBasePath, (await readFile(remoteBasePath, "utf8")).replace("<title>", '<base href="https://evil.invalid/app/"><title>'), "utf8");
  await expectFailure(() => verifyEssentials(remoteBaseRoot, "essentials-manifest.json"), /base elements/, "remote base URL cannot rewrite relative runtime assets");

  const remoteRuntimePathRoot = path.join(tempRoot, "remote-runtime-path");
  await cp(fixtureRoot, remoteRuntimePathRoot, { recursive: true });
  const remoteRuntimeManifestPath = path.join(remoteRuntimePathRoot, "essentials-manifest.json");
  const remoteRuntimeManifest = JSON.parse(await readFile(remoteRuntimeManifestPath, "utf8"));
  remoteRuntimeManifest.essentialsContract.runtimeBasePath = "//evil.example/vendor/milosapps-essentials/v1";
  await writeFile(remoteRuntimeManifestPath, `${JSON.stringify(remoteRuntimeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": remoteRuntimePathRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /runtimeBasePath|pattern mismatch/,
    "protocol-relative runtime path"
  );

  const mappedRuntimeRoot = path.join(tempRoot, "mapped-runtime");
  await cp(fixtureRoot, mappedRuntimeRoot, { recursive: true });
  const mappedRuntimeManifestPath = path.join(mappedRuntimeRoot, "essentials-manifest.json");
  const mappedRuntimeManifest = JSON.parse(await readFile(mappedRuntimeManifestPath, "utf8"));
  mappedRuntimeManifest.essentialsContract.runtimeBasePath = "/noodle-assets/vendor/milosapps-essentials/v1";
  await writeFile(mappedRuntimeManifestPath, `${JSON.stringify(mappedRuntimeManifest, null, 2)}\n`, "utf8");
  const mappedRuntimeEntryPath = path.join(mappedRuntimeRoot, "index.html");
  await writeFile(mappedRuntimeEntryPath, (await readFile(mappedRuntimeEntryPath, "utf8")).replaceAll("vendor/milosapps-essentials/v1/", "/noodle-assets/vendor/milosapps-essentials/v1/"), "utf8");
  await syncEssentials({ "app-root": mappedRuntimeRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const mappedRuntime = await verifyEssentials(mappedRuntimeRoot, "essentials-manifest.json");
  assert(mappedRuntime.appKey === "reference-app", "explicit runtimeBasePath supports physical-to-public hosting mappings");

  const iconFallbackRoot = path.join(tempRoot, "icon-runtime-fallback");
  await cp(fixtureRoot, iconFallbackRoot, { recursive: true });
  const iconFallbackManifestPath = path.join(iconFallbackRoot, "essentials-manifest.json");
  const iconFallbackManifest = JSON.parse(await readFile(iconFallbackManifestPath, "utf8"));
  delete iconFallbackManifest.loading.iconRuntimePath;
  await writeFile(iconFallbackManifestPath, `${JSON.stringify(iconFallbackManifest, null, 2)}\n`, "utf8");
  const iconFallbackSync = await syncEssentials({ "app-root": iconFallbackRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const iconFallback = await verifyEssentials(iconFallbackRoot, "essentials-manifest.json");
  assert(iconFallback.appKey === "reference-app" && iconFallbackSync.lock.loadingIconRuntimePath === "icon.svg", "omitted iconRuntimePath falls back to iconPath");

  const mappedIconRoot = path.join(tempRoot, "mapped-loading-icon");
  await cp(fixtureRoot, mappedIconRoot, { recursive: true });
  const mappedIconManifestPath = path.join(mappedIconRoot, "essentials-manifest.json");
  const mappedIconManifest = JSON.parse(await readFile(mappedIconManifestPath, "utf8"));
  mappedIconManifest.loading.iconRuntimePath = "/noodle-assets/noodle-icon.svg";
  await writeFile(mappedIconManifestPath, `${JSON.stringify(mappedIconManifest, null, 2)}\n`, "utf8");
  const mappedIconEntryPath = path.join(mappedIconRoot, "index.html");
  await writeFile(mappedIconEntryPath, (await readFile(mappedIconEntryPath, "utf8")).replace('src="icon.svg"', 'src="/noodle-assets/noodle-icon.svg"'), "utf8");
  const mappedIconSync = await syncEssentials({ "app-root": mappedIconRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const mappedIcon = await verifyEssentials(mappedIconRoot, "essentials-manifest.json");
  assert(mappedIcon.appKey === "reference-app" && mappedIconSync.lock.loadingIconRuntimePath === "/noodle-assets/noodle-icon.svg", "loading icon supports distinct physical and public paths");

  const wrongMappedIconRoot = path.join(tempRoot, "wrong-mapped-loading-icon");
  await cp(mappedIconRoot, wrongMappedIconRoot, { recursive: true });
  const wrongMappedIconEntryPath = path.join(wrongMappedIconRoot, "index.html");
  await writeFile(wrongMappedIconEntryPath, (await readFile(wrongMappedIconEntryPath, "utf8")).replace('/noodle-assets/noodle-icon.svg', 'icon.svg'), "utf8");
  await expectFailure(() => verifyEssentials(wrongMappedIconRoot, "essentials-manifest.json"), /iconRuntimePath/, "loader HTML must use the declared icon runtime path");

  for (const [name, suffix] of [["query-loader-icon", "?variant=unexpected"], ["fragment-loader-icon", "#unexpected"]]) {
    const suffixedIconRoot = path.join(tempRoot, name);
    await cp(fixtureRoot, suffixedIconRoot, { recursive: true });
    const suffixedIconEntryPath = path.join(suffixedIconRoot, "index.html");
    await writeFile(suffixedIconEntryPath, (await readFile(suffixedIconEntryPath, "utf8")).replace('src="icon.svg"', `src="icon.svg${suffix}"`), "utf8");
    await expectFailure(() => verifyEssentials(suffixedIconRoot, "essentials-manifest.json"), /iconRuntimePath/, `${name} cannot alter the locked icon URL`);
  }

  const mismatchedIconLockRoot = path.join(tempRoot, "mismatched-icon-lock");
  await cp(mappedIconRoot, mismatchedIconLockRoot, { recursive: true });
  const mismatchedIconLockPath = path.join(mismatchedIconLockRoot, "vendor", "milosapps-essentials", "v1", "essentials-lock.json");
  const mismatchedIconLock = JSON.parse(await readFile(mismatchedIconLockPath, "utf8"));
  mismatchedIconLock.loadingIconRuntimePath = "icon.svg";
  await writeFile(mismatchedIconLockPath, `${JSON.stringify(mismatchedIconLock, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(mismatchedIconLockRoot, "essentials-manifest.json"), /lock\/loading icon runtime path mismatch/, "loading icon runtime path is locked");

  for (const [name, invalidRuntimePath] of [
    ["remote-icon-runtime", "https://evil.example/icon.svg"],
    ["protocol-relative-icon-runtime", "//evil.example/icon.svg"],
    ["data-icon-runtime", "data:image/svg+xml,evil.svg"],
    ["javascript-icon-runtime", "javascript:evil.svg"],
    ["parent-icon-runtime", "../icon.svg"],
    ["backslash-icon-runtime", "assets\\icon.svg"],
    ["query-icon-runtime", "icon.svg?v=1"],
    ["fragment-icon-runtime", "icon.svg#mark"],
    ["non-svg-icon-runtime", "icon.png"]
  ]) {
    const invalidIconRoot = path.join(tempRoot, name);
    await cp(fixtureRoot, invalidIconRoot, { recursive: true });
    const invalidIconManifestPath = path.join(invalidIconRoot, "essentials-manifest.json");
    const invalidIconManifest = JSON.parse(await readFile(invalidIconManifestPath, "utf8"));
    invalidIconManifest.loading.iconRuntimePath = invalidRuntimePath;
    await writeFile(invalidIconManifestPath, `${JSON.stringify(invalidIconManifest, null, 2)}\n`, "utf8");
    await expectFailure(
      () => syncEssentials({ "app-root": invalidIconRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
      /iconRuntimePath|pattern mismatch/,
      `${name} is rejected`
    );
  }

  const tsxMarkupRoot = path.join(tempRoot, "tsx-markup");
  await cp(fixtureRoot, tsxMarkupRoot, { recursive: true });
  const tsxManifestPath = path.join(tsxMarkupRoot, "essentials-manifest.json");
  const tsxManifest = JSON.parse(await readFile(tsxManifestPath, "utf8"));
  tsxManifest.integrationFiles = ["index.html", "app.js", "view.tsx"];
  await writeFile(tsxManifestPath, `${JSON.stringify(tsxManifest, null, 2)}\n`, "utf8");
  const tsxEntryPath = path.join(tsxMarkupRoot, "index.html");
  const tsxEntry = (await readFile(tsxEntryPath, "utf8"))
    .replace(/\s*<a data-milos-privacy-info[^>]*>[\s\S]*?<\/a>/i, "")
    .replace(/\s*<milos-date-picker[^>]*><\/milos-date-picker>/i, "")
    .replace(/\s*<milos-place-search[^>]*><\/milos-place-search>/i, "")
    .replace(/\s*<milos-share-button[^>]*><\/milos-share-button>/i, "");
  await writeFile(tsxEntryPath, tsxEntry, "utf8");
  await writeFile(path.join(tsxMarkupRoot, "view.tsx"), `export const view = (<section><a href="${tsxManifest.privacy.privacyUrl}" data-milos-privacy-info>Privacy</a><milos-date-picker /><milos-place-search /><milos-share-button /></section>);\n`, "utf8");
  await syncEssentials({ "app-root": tsxMarkupRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const tsxMarkup = await verifyEssentials(tsxMarkupRoot, "essentials-manifest.json");
  assert(tsxMarkup.appKey === "reference-app", "TSX markup with an exact privacy href verifies");

  const templateMarkupRoot = path.join(tempRoot, "template-markup");
  await cp(fixtureRoot, templateMarkupRoot, { recursive: true });
  const templateManifestPath = path.join(templateMarkupRoot, "essentials-manifest.json");
  const templateManifest = JSON.parse(await readFile(templateManifestPath, "utf8"));
  templateManifest.integrationFiles = ["index.html", "app.js", "view.ts"];
  await writeFile(templateManifestPath, `${JSON.stringify(templateManifest, null, 2)}\n`, "utf8");
  const templateEntryPath = path.join(templateMarkupRoot, "index.html");
  const templateEntry = (await readFile(templateEntryPath, "utf8"))
    .replace(/\s*<a data-milos-privacy-info[^>]*>[\s\S]*?<\/a>/i, "")
    .replace(/\s*<milos-date-picker[^>]*><\/milos-date-picker>/i, "")
    .replace(/\s*<milos-place-search[^>]*><\/milos-place-search>/i, "")
    .replace(/\s*<milos-share-button[^>]*><\/milos-share-button>/i, "");
  await writeFile(templateEntryPath, templateEntry, "utf8");
  await writeFile(path.join(templateMarkupRoot, "view.ts"), `export const view = \`<a data-milos-privacy-info href="${templateManifest.privacy.privacyUrl}">Privacy</a><milos-date-picker></milos-date-picker><milos-place-search></milos-place-search><milos-share-button></milos-share-button>\`;\n`, "utf8");
  await syncEssentials({ "app-root": templateMarkupRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const templateMarkup = await verifyEssentials(templateMarkupRoot, "essentials-manifest.json");
  assert(templateMarkup.appKey === "reference-app", "raw template markup verifies without trusting interpolation expressions");

  const staleManifestRoot = path.join(tempRoot, "stale-manifest");
  await cp(fixtureRoot, staleManifestRoot, { recursive: true });
  const staleManifestPath = path.join(staleManifestRoot, "essentials-manifest.json");
  const staleManifest = JSON.parse(await readFile(staleManifestPath, "utf8"));
  staleManifest.theme.accent = "#123456";
  staleManifest.loading.message.de = "Veralteter Lock darf nicht bestehen";
  await writeFile(staleManifestPath, `${JSON.stringify(staleManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(staleManifestRoot, "essentials-manifest.json"), /manifest configuration mismatch/, "stale generated manifest configuration");

  const commentedReadyRoot = path.join(tempRoot, "commented-ready");
  await cp(fixtureRoot, commentedReadyRoot, { recursive: true });
  const commentedReadyPath = path.join(commentedReadyRoot, "app.js");
  const commentedReadySource = await readFile(commentedReadyPath, "utf8");
  await writeFile(commentedReadyPath, commentedReadySource.replace("globalThis.milosAppEssentials.ready();", "// globalThis.milosAppEssentials.ready();"), "utf8");
  await expectFailure(() => verifyEssentials(commentedReadyRoot, "essentials-manifest.json"), /explicitly call/, "comment-only ready marker");

  const htmlCommentedReadyRoot = path.join(tempRoot, "html-commented-ready");
  await cp(commentedReadyRoot, htmlCommentedReadyRoot, { recursive: true });
  const htmlCommentedReadyPath = path.join(htmlCommentedReadyRoot, "index.html");
  await writeFile(htmlCommentedReadyPath, `${await readFile(htmlCommentedReadyPath, "utf8")}\n<!-- globalThis.milosAppEssentials.ready() -->\n`, "utf8");
  await expectFailure(() => verifyEssentials(htmlCommentedReadyRoot, "essentials-manifest.json"), /explicitly call/, "HTML comments cannot impersonate readiness code");

  const jsxTextReadyRoot = path.join(tempRoot, "jsx-text-ready");
  await cp(fixtureRoot, jsxTextReadyRoot, { recursive: true });
  const jsxTextReadyManifestPath = path.join(jsxTextReadyRoot, "essentials-manifest.json");
  const jsxTextReadyManifest = JSON.parse(await readFile(jsxTextReadyManifestPath, "utf8"));
  jsxTextReadyManifest.integrationFiles.push("fake-view.tsx");
  await writeFile(jsxTextReadyManifestPath, `${JSON.stringify(jsxTextReadyManifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(jsxTextReadyRoot, "fake-view.tsx"), "export const view = <p>safe text</p>;\n", "utf8");
  await syncEssentials({ "app-root": jsxTextReadyRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const jsxTextReadyAppPath = path.join(jsxTextReadyRoot, "app.js");
  await writeFile(jsxTextReadyAppPath, (await readFile(jsxTextReadyAppPath, "utf8")).replace("globalThis.milosAppEssentials.ready();", "// readiness intentionally removed"), "utf8");
  await writeFile(path.join(jsxTextReadyRoot, "fake-view.tsx"), "export const view = <p>globalThis.milosAppEssentials.ready()</p>;\n", "utf8");
  await expectFailure(() => verifyEssentials(jsxTextReadyRoot, "essentials-manifest.json"), /explicitly call/, "JSX text cannot impersonate executable readiness code");

  const templateReadyRoot = path.join(tempRoot, "template-ready");
  await cp(commentedReadyRoot, templateReadyRoot, { recursive: true });
  const templateReadyPath = path.join(templateReadyRoot, "app.js");
  await writeFile(templateReadyPath, `${await readFile(templateReadyPath, "utf8")}\n\`${'${/* globalThis.milosAppEssentials.ready(); */ 0}'}\`;\n`, "utf8");
  await expectFailure(() => verifyEssentials(templateReadyRoot, "essentials-manifest.json"), /explicitly call/, "template-comment ready marker");

  const regexReadyRoot = path.join(tempRoot, "regex-ready");
  await cp(commentedReadyRoot, regexReadyRoot, { recursive: true });
  const regexReadyPath = path.join(regexReadyRoot, "app.js");
  await writeFile(regexReadyPath, `${await readFile(regexReadyPath, "utf8")}\nconst fakeReady = /globalThis\\.milosAppEssentials\\.ready\\(\\)/;\n`, "utf8");
  await expectFailure(() => verifyEssentials(regexReadyRoot, "essentials-manifest.json"), /explicitly call/, "regex-literal ready marker");

  const controlRegexReadyRoot = path.join(tempRoot, "control-regex-ready");
  await cp(commentedReadyRoot, controlRegexReadyRoot, { recursive: true });
  const controlRegexReadyPath = path.join(controlRegexReadyRoot, "app.js");
  await writeFile(controlRegexReadyPath, `${await readFile(controlRegexReadyPath, "utf8")}\nif (true) /globalThis\\.milosAppEssentials\\.ready\\(\\)/.test("");\n`, "utf8");
  await expectFailure(() => verifyEssentials(controlRegexReadyRoot, "essentials-manifest.json"), /explicitly call/, "regex after a control header cannot impersonate readiness");

  const blockRegexReadyRoot = path.join(tempRoot, "block-regex-ready");
  await cp(commentedReadyRoot, blockRegexReadyRoot, { recursive: true });
  const blockRegexReadyPath = path.join(blockRegexReadyRoot, "app.js");
  await writeFile(blockRegexReadyPath, `${await readFile(blockRegexReadyPath, "utf8")}\nif (true) {} /globalThis\\.milosAppEssentials\\.ready\\(\\)/.test("");\n`, "utf8");
  await expectFailure(() => verifyEssentials(blockRegexReadyRoot, "essentials-manifest.json"), /explicitly call/, "regex after a statement block cannot impersonate readiness");

  const restrictedRegexReadyRoot = path.join(tempRoot, "restricted-regex-ready");
  await cp(commentedReadyRoot, restrictedRegexReadyRoot, { recursive: true });
  const restrictedRegexReadyPath = path.join(restrictedRegexReadyRoot, "app.js");
  await writeFile(restrictedRegexReadyPath, `${await readFile(restrictedRegexReadyPath, "utf8")}\ndebugger\n/globalThis\\.milosAppEssentials\\.ready\\(\\)/.test("");\n`, "utf8");
  await expectFailure(() => verifyEssentials(restrictedRegexReadyRoot, "essentials-manifest.json"), /explicitly call/, "regex after a restricted statement cannot impersonate readiness");

  const exportRegexReadyRoot = path.join(tempRoot, "export-regex-ready");
  await cp(commentedReadyRoot, exportRegexReadyRoot, { recursive: true });
  const exportRegexReadyPath = path.join(exportRegexReadyRoot, "app.js");
  await writeFile(exportRegexReadyPath, `${await readFile(exportRegexReadyPath, "utf8")}\nexport default /globalThis\\.milosAppEssentials\\.ready\\(\\)/;\n`, "utf8");
  await expectFailure(() => verifyEssentials(exportRegexReadyRoot, "essentials-manifest.json"), /explicitly call/, "export-default regex cannot impersonate readiness");

  const shadowReadyRoot = path.join(tempRoot, "shadow-ready");
  await cp(commentedReadyRoot, shadowReadyRoot, { recursive: true });
  const shadowReadyPath = path.join(shadowReadyRoot, "app.js");
  await writeFile(shadowReadyPath, `${await readFile(shadowReadyPath, "utf8")}\nconst milosAppEssentials = { ready() {} };\nmilosAppEssentials.ready();\n`, "utf8");
  await expectFailure(() => verifyEssentials(shadowReadyRoot, "essentials-manifest.json"), /globalThis\.milosAppEssentials\.ready/, "shadow readiness object");

  const wrongProvenanceRoot = path.join(tempRoot, "wrong-provenance");
  await cp(fixtureRoot, wrongProvenanceRoot, { recursive: true });
  const wrongProvenancePath = path.join(wrongProvenanceRoot, "essentials-manifest.json");
  const wrongProvenanceManifest = JSON.parse(await readFile(wrongProvenancePath, "utf8"));
  const wrongCommit = execFileSync("git", ["-C", path.resolve(root, "../../.."), "rev-parse", "public-app-essentials-v1.1.0^{commit}"], { encoding: "utf8" }).trim();
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

  const treeProvenanceRoot = path.join(tempRoot, "tree-provenance");
  await cp(fixtureRoot, treeProvenanceRoot, { recursive: true });
  const treeProvenancePath = path.join(treeProvenanceRoot, "essentials-manifest.json");
  const treeProvenanceManifest = JSON.parse(await readFile(treeProvenancePath, "utf8"));
  const treeObject = execFileSync("git", ["-C", path.resolve(root, "../../.."), "rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
  treeProvenanceManifest.appKey = "cloud-post";
  treeProvenanceManifest.ownerTask = "MilosApps – Wolkenpost";
  treeProvenanceManifest.privacy.storagePurposes[0].key = "milosapps.cloud-post.locale";
  treeProvenanceManifest.essentialsContract.sharedCommit = treeObject;
  await writeFile(treeProvenancePath, `${JSON.stringify(treeProvenanceManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": treeProvenanceRoot, manifest: "essentials-manifest.json", "source-commit": treeObject }),
    /Git commit object/,
    "tree object cannot impersonate a Shared commit"
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

  for (const [name, value] of [["empty-https-privacy-url", "https://"], ["invalid-host-privacy-url", "https:// not-a-host"], ["dot-host-privacy-url", "https://."], ["credentialed-privacy-url", "https://user:pass@example.test/privacy"]]) {
    const invalidPrivacyRoot = path.join(tempRoot, name);
    await cp(fixtureRoot, invalidPrivacyRoot, { recursive: true });
    const invalidPrivacyPath = path.join(invalidPrivacyRoot, "essentials-manifest.json");
    const invalidPrivacy = JSON.parse(await readFile(invalidPrivacyPath, "utf8"));
    invalidPrivacy.privacy.privacyUrl = value;
    await writeFile(invalidPrivacyPath, `${JSON.stringify(invalidPrivacy, null, 2)}\n`, "utf8");
    await expectFailure(
      () => syncEssentials({ "app-root": invalidPrivacyRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
      /privacyUrl|pattern mismatch|valid host|credentials/i,
      name
    );
  }

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
  await expectFailure(() => verifyEssentials(missingPrivacyInfoRoot, "essentials-manifest.json"), /persistent consumer-owned privacy information or a verified public-app-shell/, "missing persistent privacy info");

  const inertShellPrivacyRoot = path.join(tempRoot, "inert-shell-privacy-info");
  await cp(fixtureRoot, inertShellPrivacyRoot, { recursive: true });
  const inertShellPrivacyManifestPath = path.join(inertShellPrivacyRoot, "essentials-manifest.json");
  const inertShellPrivacyManifest = JSON.parse(await readFile(inertShellPrivacyManifestPath, "utf8"));
  inertShellPrivacyManifest.privacy.permanentLink = { provider: "public-app-shell/v2", manifest: "milos-app.json" };
  await writeFile(inertShellPrivacyManifestPath, `${JSON.stringify(inertShellPrivacyManifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(inertShellPrivacyRoot, "milos-app.json"), `${JSON.stringify({
    appKey: "reference-app",
    public: true,
    loginRequired: false,
    environment: "dev",
    productionApproved: false,
    shellContract: { id: "public-app-shell/v2", version: "2.0.3", entryHtml: "index.html" }
  }, null, 2)}\n`, "utf8");
  const inertShellPrivacyEntryPath = path.join(inertShellPrivacyRoot, "index.html");
  await writeFile(inertShellPrivacyEntryPath, (await readFile(inertShellPrivacyEntryPath, "utf8"))
    .replace(/\s*<a data-milos-privacy-info[^>]*>[^<]*<\/a>\s*/, "\n")
    .replace("<main>", '<milos-app-shell>\n    <main slot="main">')
    .replace("</main>", "</main>\n    </milos-app-shell>"), "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": inertShellPrivacyRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /sharedCommit|vendorDirectory|localeModule|shell lock/i,
    "inert Shell tag and minimal manifest cannot impersonate permanent footer privacy evidence"
  );

  const shellPrivacyRoot = path.join(tempRoot, "shell-privacy-info");
  await cp(fixtureRoot, shellPrivacyRoot, { recursive: true });
  const shellPrivacyManifestPath = path.join(shellPrivacyRoot, "essentials-manifest.json");
  const shellPrivacyManifest = JSON.parse(await readFile(shellPrivacyManifestPath, "utf8"));
  shellPrivacyManifest.privacy.permanentLink = { provider: "public-app-shell/v2", manifest: "milos-app.json" };
  await writeFile(shellPrivacyManifestPath, `${JSON.stringify(shellPrivacyManifest, null, 2)}\n`, "utf8");
  await cp(path.join(shellFixtureRoot, "milos-app.json"), path.join(shellPrivacyRoot, "milos-app.json"));
  await mkdir(path.join(shellPrivacyRoot, "vendor", "milosapps-shell"), { recursive: true });
  await cp(path.join(shellFixtureRoot, "vendor", "milosapps-shell", "v2"), path.join(shellPrivacyRoot, "vendor", "milosapps-shell", "v2"), { recursive: true });
  const shellPrivacyEntryPath = path.join(shellPrivacyRoot, "index.html");
  const shellPrivacyEntry = (await readFile(shellPrivacyEntryPath, "utf8"))
    .replace(/\s*<a data-milos-privacy-info[^>]*>[^<]*<\/a>\s*/, "\n")
    .replace("<main>", '<milos-app-shell>\n      <svg slot="app-icon" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"></circle></svg>\n    <main slot="main">')
    .replace('    <script type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"></script>', '    <script type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"></script>\n    <script type="module" src="vendor/milosapps-shell/v2/bootstrap.js"></script>')
    .replace("</main>", "</main>\n    </milos-app-shell>");
  await writeFile(shellPrivacyEntryPath, shellPrivacyEntry, "utf8");
  const shellPrivacyAppPath = path.join(shellPrivacyRoot, "app.js");
  await writeFile(shellPrivacyAppPath, `${await readFile(shellPrivacyAppPath, "utf8")}\nconst shellLocales = { de: {}, en: {} };\nwindow.addEventListener("milosapps:localechange", ({ detail }) => { document.documentElement.lang = shellLocales[detail.locale] ? detail.locale : "de"; });\ndocument.documentElement.lang = shellLocales[document.documentElement.lang] ? document.documentElement.lang : "de";\n`, "utf8");
  const shellContractFixture = await verifyShellApp(shellPrivacyRoot, "milos-app.json");
  assert(shellContractFixture.appKey === "reference-app", "Shell v2 verifier accepts the combined permanent-link reference fixture");
  await syncEssentials({ "app-root": shellPrivacyRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const shellPrivacyFixture = await verifyEssentials(shellPrivacyRoot, "essentials-manifest.json");
  assert(shellPrivacyFixture.appKey === "reference-app", "verified Shell v2 footer satisfies permanent no-cookies privacy information without a duplicate app link");

  const routedShellPrivacyRoot = path.join(tempRoot, "routed-shell-privacy-info");
  await cp(shellPrivacyRoot, routedShellPrivacyRoot, { recursive: true });
  const routedShellPrivacyEntryPath = path.join(routedShellPrivacyRoot, "index.html");
  await writeFile(routedShellPrivacyEntryPath, (await readFile(routedShellPrivacyEntryPath, "utf8")).replace('src="vendor/milosapps-shell/v2/bootstrap.js"', 'src="/reference-assets/vendor/milosapps-shell/v2/bootstrap.js"'), "utf8");
  const routedShellPrivacyFixture = await verifyEssentials(routedShellPrivacyRoot, "essentials-manifest.json");
  assert(routedShellPrivacyFixture.appKey === "reference-app", "verified Shell footer supports a distinct same-origin routed bootstrap URL without a shadow asset");

  const selfLockedInertShellRoot = path.join(tempRoot, "self-locked-inert-shell-privacy-info");
  await cp(shellPrivacyRoot, selfLockedInertShellRoot, { recursive: true });
  const selfLockedInertShellComponentPath = path.join(selfLockedInertShellRoot, "vendor", "milosapps-shell", "v2", "milos-app-shell.js");
  const selfLockedInertShellComponent = Buffer.from((await readFile(selfLockedInertShellComponentPath, "utf8")).replace('<a href="${links.privacy}" data-text="privacy">', '<span data-text="privacy">'), "utf8");
  await writeFile(selfLockedInertShellComponentPath, selfLockedInertShellComponent);
  const selfLockedInertShellLockPath = path.join(selfLockedInertShellRoot, "vendor", "milosapps-shell", "v2", "shell-lock.json");
  const selfLockedInertShellLock = JSON.parse(await readFile(selfLockedInertShellLockPath, "utf8"));
  selfLockedInertShellLock.artifacts["milos-app-shell.js"] = digest(selfLockedInertShellComponent);
  await writeFile(selfLockedInertShellLockPath, `${JSON.stringify(selfLockedInertShellLock, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(selfLockedInertShellRoot, "essentials-manifest.json"), /immutable v2\.0\.3 artifact/, "self-locked inert Shell component cannot impersonate the visible footer privacy link");

  const duplicateShellPrivacyRoot = path.join(tempRoot, "duplicate-shell-privacy-info");
  await cp(shellPrivacyRoot, duplicateShellPrivacyRoot, { recursive: true });
  const duplicateShellPrivacyEntryPath = path.join(duplicateShellPrivacyRoot, "index.html");
  await writeFile(duplicateShellPrivacyEntryPath, (await readFile(duplicateShellPrivacyEntryPath, "utf8")).replace('<milos-app-shell>', '<a data-milos-privacy-info href="https://dev.milos-apps.de/datenschutz">Datenschutz</a>\n    <milos-app-shell>'), "utf8");
  await expectFailure(() => verifyEssentials(duplicateShellPrivacyRoot, "essentials-manifest.json"), /must not duplicate/, "Shell footer privacy evidence forbids a duplicate app link");

  const unmarkedDuplicateShellPrivacyRoot = path.join(tempRoot, "unmarked-duplicate-shell-privacy-info");
  await cp(shellPrivacyRoot, unmarkedDuplicateShellPrivacyRoot, { recursive: true });
  const unmarkedDuplicateShellPrivacyEntryPath = path.join(unmarkedDuplicateShellPrivacyRoot, "index.html");
  await writeFile(unmarkedDuplicateShellPrivacyEntryPath, (await readFile(unmarkedDuplicateShellPrivacyEntryPath, "utf8")).replace('<milos-app-shell>', '<a href="https://dev.milos-apps.de/datenschutz">Datenschutz</a>\n    <milos-app-shell>'), "utf8");
  await expectFailure(() => verifyEssentials(unmarkedDuplicateShellPrivacyRoot, "essentials-manifest.json"), /must not duplicate/, "Shell footer privacy evidence forbids an unmarked duplicate app link to the same privacy URL");

  const mismatchedShellPrivacyRoot = path.join(tempRoot, "mismatched-shell-privacy-info");
  await cp(shellPrivacyRoot, mismatchedShellPrivacyRoot, { recursive: true });
  const mismatchedShellManifestPath = path.join(mismatchedShellPrivacyRoot, "milos-app.json");
  const mismatchedShellManifest = JSON.parse(await readFile(mismatchedShellManifestPath, "utf8"));
  mismatchedShellManifest.appKey = "other-app";
  await writeFile(mismatchedShellManifestPath, `${JSON.stringify(mismatchedShellManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(mismatchedShellPrivacyRoot, "essentials-manifest.json"), /shell manifest appKey must match/, "Shell footer privacy evidence is bound to the same app");

  const mismatchedShellEnvironmentRoot = path.join(tempRoot, "mismatched-shell-environment");
  await cp(shellPrivacyRoot, mismatchedShellEnvironmentRoot, { recursive: true });
  const mismatchedShellEnvironmentPath = path.join(mismatchedShellEnvironmentRoot, "milos-app.json");
  const mismatchedShellEnvironment = JSON.parse(await readFile(mismatchedShellEnvironmentPath, "utf8"));
  mismatchedShellEnvironment.environment = "production";
  mismatchedShellEnvironment.productionApproved = true;
  await writeFile(mismatchedShellEnvironmentPath, `${JSON.stringify(mismatchedShellEnvironment, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(mismatchedShellEnvironmentRoot, "essentials-manifest.json"), /environment and production boundary must match/, "Shell footer privacy evidence is bound to the same environment and Production boundary");

  const mismatchedShellEntryRoot = path.join(tempRoot, "mismatched-shell-entry");
  await cp(shellPrivacyRoot, mismatchedShellEntryRoot, { recursive: true });
  const mismatchedShellEntryPath = path.join(mismatchedShellEntryRoot, "milos-app.json");
  const mismatchedShellEntry = JSON.parse(await readFile(mismatchedShellEntryPath, "utf8"));
  mismatchedShellEntry.shellContract.entryHtml = "other.html";
  await writeFile(mismatchedShellEntryPath, `${JSON.stringify(mismatchedShellEntry, null, 2)}\n`, "utf8");
  await expectFailure(() => verifyEssentials(mismatchedShellEntryRoot, "essentials-manifest.json"), /same entry HTML/, "Shell footer privacy evidence is bound to the same entry document");

  const wrongShellPrivacyUrlRoot = path.join(tempRoot, "wrong-shell-privacy-url");
  await cp(shellPrivacyRoot, wrongShellPrivacyUrlRoot, { recursive: true });
  const wrongShellPrivacyUrlManifestPath = path.join(wrongShellPrivacyUrlRoot, "essentials-manifest.json");
  const wrongShellPrivacyUrlManifest = JSON.parse(await readFile(wrongShellPrivacyUrlManifestPath, "utf8"));
  wrongShellPrivacyUrlManifest.privacy.privacyUrl = "https://example.test/privacy";
  await writeFile(wrongShellPrivacyUrlManifestPath, `${JSON.stringify(wrongShellPrivacyUrlManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => syncEssentials({ "app-root": wrongShellPrivacyUrlRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }), /canonical environment privacyUrl/, "Shell footer privacy evidence cannot redirect to an arbitrary privacy URL");

  const essentialOnlyShellPrivacyRoot = path.join(tempRoot, "essential-only-shell-privacy");
  await cp(shellPrivacyRoot, essentialOnlyShellPrivacyRoot, { recursive: true });
  const essentialOnlyShellPrivacyManifestPath = path.join(essentialOnlyShellPrivacyRoot, "essentials-manifest.json");
  const essentialOnlyShellPrivacyManifest = JSON.parse(await readFile(essentialOnlyShellPrivacyManifestPath, "utf8"));
  essentialOnlyShellPrivacyManifest.privacy.mode = "essential-only";
  essentialOnlyShellPrivacyManifest.features.privacyNotice = true;
  await writeFile(essentialOnlyShellPrivacyManifestPath, `${JSON.stringify(essentialOnlyShellPrivacyManifest, null, 2)}\n`, "utf8");
  await expectFailure(() => syncEssentials({ "app-root": essentialOnlyShellPrivacyRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }), /permanentLink.*additional property|only supported for no-cookies/i, "Shell footer evidence does not suppress the essential-only runtime notice");

  const wrongPrivacyLinkRoot = path.join(tempRoot, "wrong-privacy-link");
  await cp(fixtureRoot, wrongPrivacyLinkRoot, { recursive: true });
  const wrongPrivacyLinkPath = path.join(wrongPrivacyLinkRoot, "index.html");
  await writeFile(wrongPrivacyLinkPath, (await readFile(wrongPrivacyLinkPath, "utf8")).replace(fixtureManifest.privacy.privacyUrl, "javascript:alert(1)"), "utf8");
  await expectFailure(() => verifyEssentials(wrongPrivacyLinkRoot, "essentials-manifest.json"), /exact manifest privacyUrl/, "privacy information link cannot diverge from the manifest URL");

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
  await expectFailure(
    () => syncEssentials({ "app-root": missingSuggestionsEvidenceRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /suggestions evidence is missing/,
    "missing suggestions evidence"
  );

  const noLoaderRoot = path.join(tempRoot, "no-loader");
  await cp(fixtureRoot, noLoaderRoot, { recursive: true });
  const entryPath = path.join(noLoaderRoot, "index.html");
  const entry = await readFile(entryPath, "utf8");
  await writeFile(entryPath, entry.replace("data-milos-loading-card", "data-app-loading-card"), "utf8");
  await expectFailure(() => verifyEssentials(noLoaderRoot, "essentials-manifest.json"), /startup marker/, "missing loader marker");

  const missingLoadingIconRoot = path.join(tempRoot, "missing-loading-icon");
  await cp(fixtureRoot, missingLoadingIconRoot, { recursive: true });
  await rm(path.join(missingLoadingIconRoot, "icon.svg"));
  await expectFailure(() => verifyEssentials(missingLoadingIconRoot, "essentials-manifest.json"), /loading icon is missing/, "missing app-owned loading icon");

  const wrongLoadingIconSizeRoot = path.join(tempRoot, "wrong-loading-icon-size");
  await cp(fixtureRoot, wrongLoadingIconSizeRoot, { recursive: true });
  const wrongLoadingIconSizePath = path.join(wrongLoadingIconSizeRoot, "index.html");
  await writeFile(wrongLoadingIconSizePath, (await readFile(wrongLoadingIconSizePath, "utf8")).replace('width="32" height="32"', 'width="48" height="48"'), "utf8");
  await expectFailure(() => verifyEssentials(wrongLoadingIconSizeRoot, "essentials-manifest.json"), /exactly 32/, "legacy loading icon fallback size");

  const numericLookingLoadingIconSizeRoot = path.join(tempRoot, "numeric-looking-loading-icon-size");
  await cp(fixtureRoot, numericLookingLoadingIconSizeRoot, { recursive: true });
  const numericLookingLoadingIconSizePath = path.join(numericLookingLoadingIconSizeRoot, "index.html");
  await writeFile(numericLookingLoadingIconSizePath, (await readFile(numericLookingLoadingIconSizePath, "utf8")).replace('width="32" height="32"', 'width="32e0" height="32.0"'), "utf8");
  await expectFailure(() => verifyEssentials(numericLookingLoadingIconSizeRoot, "essentials-manifest.json"), /exactly 32/, "numeric-looking non-canonical loading icon fallback size");

  const quotedLoaderMarkerRoot = path.join(tempRoot, "quoted-loader-marker");
  await cp(noLoaderRoot, quotedLoaderMarkerRoot, { recursive: true });
  const quotedLoaderMarkerPath = path.join(quotedLoaderMarkerRoot, "index.html");
  await writeFile(quotedLoaderMarkerPath, (await readFile(quotedLoaderMarkerPath, "utf8")).replace("<main>", `<main title=" data-milos-loading-card ">`), "utf8");
  await expectFailure(() => verifyEssentials(quotedLoaderMarkerRoot, "essentials-manifest.json"), /startup marker/, "quoted attribute text cannot impersonate a loader marker");

  const noShareRoot = path.join(tempRoot, "no-share");
  await cp(fixtureRoot, noShareRoot, { recursive: true });
  const noShareEntryPath = path.join(noShareRoot, "index.html");
  const noShareEntry = await readFile(noShareEntryPath, "utf8");
  await writeFile(noShareEntryPath, noShareEntry.replace("milos-share-button", "app-share-button"), "utf8");
  await expectFailure(() => verifyEssentials(noShareRoot, "essentials-manifest.json"), /share control/, "missing share control");

  const commentOnlyShareRoot = path.join(tempRoot, "comment-only-share");
  await cp(noShareRoot, commentOnlyShareRoot, { recursive: true });
  const commentOnlySharePath = path.join(commentOnlyShareRoot, "app.js");
  await writeFile(commentOnlySharePath, `${await readFile(commentOnlySharePath, "utf8")}\nconst fakeMarkup = \`\${/* <milos-share-button></milos-share-button> */ 0}\`;\n`, "utf8");
  await expectFailure(() => verifyEssentials(commentOnlyShareRoot, "essentials-manifest.json"), /share control/, "template-interpolation comment cannot impersonate share markup");

  const htmlCommentShareRoot = path.join(tempRoot, "html-comment-share");
  await cp(noShareRoot, htmlCommentShareRoot, { recursive: true });
  const htmlCommentSharePath = path.join(htmlCommentShareRoot, "app.js");
  await writeFile(htmlCommentSharePath, `${await readFile(htmlCommentSharePath, "utf8")}\nconst fakeMarkup = \`<!-- <milos-share-button></milos-share-button> -->\`;\n`, "utf8");
  await expectFailure(() => verifyEssentials(htmlCommentShareRoot, "essentials-manifest.json"), /share control/, "template HTML comment cannot impersonate share markup");

  const controlRegexShareRoot = path.join(tempRoot, "control-regex-share");
  await cp(noShareRoot, controlRegexShareRoot, { recursive: true });
  const controlRegexSharePath = path.join(controlRegexShareRoot, "app.js");
  await writeFile(controlRegexSharePath, `${await readFile(controlRegexSharePath, "utf8")}\nif (true) /<milos-share-button><\\/milos-share-button>/.test("");\n`, "utf8");
  await expectFailure(() => verifyEssentials(controlRegexShareRoot, "essentials-manifest.json"), /share control/, "regex after a control header cannot impersonate share markup");

  const blockRegexShareRoot = path.join(tempRoot, "block-regex-share");
  await cp(noShareRoot, blockRegexShareRoot, { recursive: true });
  const blockRegexSharePath = path.join(blockRegexShareRoot, "app.js");
  await writeFile(blockRegexSharePath, `${await readFile(blockRegexSharePath, "utf8")}\nif (true) {} /<milos-share-button><\\/milos-share-button>/.test("");\n`, "utf8");
  await expectFailure(() => verifyEssentials(blockRegexShareRoot, "essentials-manifest.json"), /share control/, "regex after a statement block cannot impersonate share markup");

  for (const keyword of ["break", "continue", "debugger"]) {
    const root = path.join(tempRoot, `${keyword}-regex-share`);
    await cp(noShareRoot, root, { recursive: true });
    const appPath = path.join(root, "app.js");
    const fake = keyword === "debugger"
      ? `debugger\n/<milos-share-button><\\/milos-share-button>/.test("");`
      : `while (true) { ${keyword}\n/<milos-share-button><\\/milos-share-button>/.test(""); }`;
    await writeFile(appPath, `${await readFile(appPath, "utf8")}\n${fake}\n`, "utf8");
    await expectFailure(() => verifyEssentials(root, "essentials-manifest.json"), /share control/, `regex after ${keyword} cannot impersonate share markup`);
  }

  const exportRegexShareRoot = path.join(tempRoot, "export-regex-share");
  await cp(noShareRoot, exportRegexShareRoot, { recursive: true });
  const exportRegexSharePath = path.join(exportRegexShareRoot, "app.js");
  await writeFile(exportRegexSharePath, `${await readFile(exportRegexSharePath, "utf8")}\nexport default /<milos-share-button><\\/milos-share-button>/;\n`, "utf8");
  await expectFailure(() => verifyEssentials(exportRegexShareRoot, "essentials-manifest.json"), /share control/, "export-default regex cannot impersonate share markup");

  const hashbangShareRoot = path.join(tempRoot, "hashbang-share");
  await cp(noShareRoot, hashbangShareRoot, { recursive: true });
  const hashbangSharePath = path.join(hashbangShareRoot, "app.js");
  await writeFile(hashbangSharePath, `\ufeff#! <milos-share-button></milos-share-button>\n${await readFile(hashbangSharePath, "utf8")}`, "utf8");
  await expectFailure(() => verifyEssentials(hashbangShareRoot, "essentials-manifest.json"), /share control/, "BOM plus hashbang cannot impersonate share markup");

  for (const [name, fakeMarkup] of [
    ["html-bang-comment-share", "<!-- <milos-share-button></milos-share-button> --!>"],
    ["html-unclosed-comment-share", "<!-- <milos-share-button></milos-share-button>"],
    ["html-cdata-share", "<![CDATA[ <milos-share-button></milos-share-button> ]]>"],
    ["html-processing-share", "<?fake <milos-share-button></milos-share-button> ?>"]
  ]) {
    const root = path.join(tempRoot, name);
    await cp(noShareRoot, root, { recursive: true });
    const appPath = path.join(root, "app.js");
    await writeFile(appPath, `${await readFile(appPath, "utf8")}\nconst fakeMarkup = \`${fakeMarkup}\`;\n`, "utf8");
    await expectFailure(() => verifyEssentials(root, "essentials-manifest.json"), /share control/, `${name} cannot impersonate share markup`);
  }

  const rawTextShareRoot = path.join(tempRoot, "raw-text-share");
  await cp(noShareRoot, rawTextShareRoot, { recursive: true });
  const rawTextSharePath = path.join(rawTextShareRoot, "index.html");
  await writeFile(
    rawTextSharePath,
    (await readFile(rawTextSharePath, "utf8")).replace("</head>", `<script>const fake = '<milos-share-button></milos-share-button>';</script>\n<style>.fake::after { content: '<milos-share-button></milos-share-button>'; }</style>\n</head>`),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(rawTextShareRoot, "essentials-manifest.json"), /share control/, "raw-text elements cannot impersonate share markup");

  const selfClosingRawTextShareRoot = path.join(tempRoot, "self-closing-raw-text-share");
  await cp(noShareRoot, selfClosingRawTextShareRoot, { recursive: true });
  const selfClosingRawTextSharePath = path.join(selfClosingRawTextShareRoot, "index.html");
  await writeFile(
    selfClosingRawTextSharePath,
    (await readFile(selfClosingRawTextSharePath, "utf8")).replace("</head>", `<script/> <milos-share-button></milos-share-button> </script>\n</head>`),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(selfClosingRawTextShareRoot, "essentials-manifest.json"), /share control/, "HTML raw-text elements ignore a self-closing slash and cannot expose fake markup");

  const inertTemplateShareRoot = path.join(tempRoot, "inert-template-share");
  await cp(noShareRoot, inertTemplateShareRoot, { recursive: true });
  const inertTemplateSharePath = path.join(inertTemplateShareRoot, "index.html");
  await writeFile(
    inertTemplateSharePath,
    (await readFile(inertTemplateSharePath, "utf8")).replace("</head>", `<template><milos-share-button></milos-share-button></template>\n</head>`),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(inertTemplateShareRoot, "essentials-manifest.json"), /template|share control/, "inert template content cannot impersonate a connected share control");

  const attributeShareRoot = path.join(tempRoot, "attribute-share");
  await cp(noShareRoot, attributeShareRoot, { recursive: true });
  const attributeSharePath = path.join(attributeShareRoot, "index.html");
  await writeFile(
    attributeSharePath,
    (await readFile(attributeSharePath, "utf8")).replace("<main>", `<main data-fake="<milos-share-button></milos-share-button>">`),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(attributeShareRoot, "essentials-manifest.json"), /share control/, "attribute values cannot impersonate share markup");

  const comparisonShareRoot = path.join(tempRoot, "comparison-share");
  await cp(noShareRoot, comparisonShareRoot, { recursive: true });
  const comparisonSharePath = path.join(comparisonShareRoot, "app.js");
  await writeFile(comparisonSharePath, `${await readFile(comparisonSharePath, "utf8")}\nlet a=0,milos=1,share=1,button=1,z=0; a<milos-share-button>z;\n`, "utf8");
  await expectFailure(() => verifyEssentials(comparisonShareRoot, "essentials-manifest.json"), /share control/, "plain JavaScript comparisons cannot impersonate JSX markup");

  const bogusEndTagShareRoot = path.join(tempRoot, "bogus-end-tag-share");
  await cp(noShareRoot, bogusEndTagShareRoot, { recursive: true });
  const bogusEndTagSharePath = path.join(bogusEndTagShareRoot, "index.html");
  await writeFile(bogusEndTagSharePath, (await readFile(bogusEndTagSharePath, "utf8")).replace("</main>", `</! <milos-share-button></milos-share-button>>\n</main>`), "utf8");
  await expectFailure(() => verifyEssentials(bogusEndTagShareRoot, "essentials-manifest.json"), /share control/, "bogus end-tag comments cannot impersonate share markup");

  const quotedAttributeShareRoot = path.join(tempRoot, "quoted-attribute-share");
  await cp(noShareRoot, quotedAttributeShareRoot, { recursive: true });
  const quotedAttributeSharePath = path.join(quotedAttributeShareRoot, "index.html");
  await writeFile(quotedAttributeSharePath, (await readFile(quotedAttributeSharePath, "utf8")).replace("<main>", `<main title=' data-milos-privacy-info <milos-share-button></milos-share-button> '>`), "utf8");
  await expectFailure(() => verifyEssentials(quotedAttributeShareRoot, "essentials-manifest.json"), /share control/, "quoted attribute text cannot impersonate integration markup or markers");

  const nbspShareRoot = path.join(tempRoot, "nbsp-share");
  await cp(noShareRoot, nbspShareRoot, { recursive: true });
  const nbspSharePath = path.join(nbspShareRoot, "index.html");
  await writeFile(nbspSharePath, (await readFile(nbspSharePath, "utf8")).replace("</main>", `<milos-share-button\u00a0 ></milos-share-button\u00a0>\n</main>`), "utf8");
  await expectFailure(() => verifyEssentials(nbspShareRoot, "essentials-manifest.json"), /share control/, "non-ASCII whitespace cannot terminate an HTML tag name");

  const rawTextRuntimeRoot = path.join(tempRoot, "raw-text-runtime");
  await cp(fixtureRoot, rawTextRuntimeRoot, { recursive: true });
  const rawTextRuntimePath = path.join(rawTextRuntimeRoot, "index.html");
  const rawTextRuntimeEntry = (await readFile(rawTextRuntimePath, "utf8"))
    .replace(/^\s*<link[^>]+milos-app-essentials\.css[^>]*>\s*$/m, "")
    .replace(/^\s*<link[^>]+milos-app-essentials-theme\.css[^>]*>\s*$/m, "")
    .replace(/^\s*<script[^>]+bootstrap\.js[^>]*><\/script>\s*$/m, "")
    .replace("</head>", `<script>const fakeRuntime = '<link rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials.css"><link rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials-theme.css"><script type="module" src="vendor/milosapps-essentials/v1/bootstrap.js">';</script>\n</head>`);
  await writeFile(rawTextRuntimePath, rawTextRuntimeEntry, "utf8");
  await expectFailure(() => verifyEssentials(rawTextRuntimeRoot, "essentials-manifest.json"), /stylesheets|bootstrap/, "raw-text strings cannot impersonate runtime assets");

  for (const foreignName of ["svg", "math"]) {
    const root = path.join(tempRoot, `${foreignName}-runtime`);
    await cp(rawTextRuntimeRoot, root, { recursive: true });
    const entryPath = path.join(root, "index.html");
    const fakeRuntime = `<${foreignName}><link rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials.css"><link rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials-theme.css"><script type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"></script></${foreignName}>`;
    await writeFile(entryPath, (await readFile(entryPath, "utf8")).replace("</head>", `${fakeRuntime}\n</head>`), "utf8");
    await expectFailure(() => verifyEssentials(root, "essentials-manifest.json"), /stylesheets|bootstrap/, `${foreignName} foreign content cannot impersonate HTML runtime tags`);
  }

  const quotedAttributeRuntimeRoot = path.join(tempRoot, "quoted-attribute-runtime");
  await cp(rawTextRuntimeRoot, quotedAttributeRuntimeRoot, { recursive: true });
  const quotedAttributeRuntimePath = path.join(quotedAttributeRuntimeRoot, "index.html");
  const quotedFakeRuntime = `<link title=' rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials.css" '><link title=' rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials-theme.css" '><script data-x=' type="module" src="vendor/milosapps-essentials/v1/bootstrap.js" '></script>`;
  await writeFile(quotedAttributeRuntimePath, (await readFile(quotedAttributeRuntimePath, "utf8")).replace("</head>", `${quotedFakeRuntime}\n</head>`), "utf8");
  await expectFailure(() => verifyEssentials(quotedAttributeRuntimeRoot, "essentials-manifest.json"), /stylesheets|bootstrap/, "quoted attribute values cannot impersonate runtime attributes");

  const escapedScriptRuntimeRoot = path.join(tempRoot, "escaped-script-runtime");
  await cp(rawTextRuntimeRoot, escapedScriptRuntimeRoot, { recursive: true });
  const escapedScriptRuntimePath = path.join(escapedScriptRuntimeRoot, "index.html");
  const escapedFakeRuntime = `<script><!--<script></script>\n<link rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials.css">\n<link rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials-theme.css">\n<script type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"></script>\n</script>`;
  await writeFile(escapedScriptRuntimePath, (await readFile(escapedScriptRuntimePath, "utf8")).replace("</head>", `${escapedFakeRuntime}\n</head>`), "utf8");
  await expectFailure(() => verifyEssentials(escapedScriptRuntimeRoot, "essentials-manifest.json"), /escaped or unterminated inline script data/, "escaped script-data states cannot expose fake runtime tags");

  const selfClosingBootstrapRoot = path.join(tempRoot, "self-closing-bootstrap");
  await cp(fixtureRoot, selfClosingBootstrapRoot, { recursive: true });
  const selfClosingBootstrapPath = path.join(selfClosingBootstrapRoot, "index.html");
  await writeFile(selfClosingBootstrapPath, (await readFile(selfClosingBootstrapPath, "utf8")).replace(/<script type="module" src="([^"]*bootstrap\.js)"><\/script>/, '<script type="module" src="$1"/>'), "utf8");
  await expectFailure(() => verifyEssentials(selfClosingBootstrapRoot, "essentials-manifest.json"), /escaped or unterminated|closing tags|consumer entry module/, "self-closing HTML bootstrap cannot swallow the consumer module");

  const selfClosingConsumerRoot = path.join(tempRoot, "self-closing-consumer");
  await cp(fixtureRoot, selfClosingConsumerRoot, { recursive: true });
  const selfClosingConsumerPath = path.join(selfClosingConsumerRoot, "index.html");
  await writeFile(selfClosingConsumerPath, (await readFile(selfClosingConsumerPath, "utf8")).replace('<script type="module" src="app.js"></script>', '<script type="module" src="app.js"/>'), "utf8");
  await expectFailure(() => verifyEssentials(selfClosingConsumerRoot, "essentials-manifest.json"), /escaped or unterminated|closing tags/, "self-closing consumer module cannot satisfy startup wiring");

  const wrongConsumerModuleRoot = path.join(tempRoot, "wrong-consumer-module");
  await cp(fixtureRoot, wrongConsumerModuleRoot, { recursive: true });
  await writeFile(path.join(wrongConsumerModuleRoot, "not-integrated.js"), "export {};\n", "utf8");
  const wrongConsumerModulePath = path.join(wrongConsumerModuleRoot, "index.html");
  await writeFile(wrongConsumerModulePath, (await readFile(wrongConsumerModulePath, "utf8")).replace('src="app.js"', 'src="not-integrated.js"'), "utf8");
  await expectFailure(() => verifyEssentials(wrongConsumerModuleRoot, "essentials-manifest.json"), /declared consumer entry module/, "an unlisted module cannot stand in for the consumer entry source");

  const wrongIntegrityRuntimeRoot = path.join(tempRoot, "wrong-integrity-runtime");
  await cp(fixtureRoot, wrongIntegrityRuntimeRoot, { recursive: true });
  const wrongIntegrityRuntimePath = path.join(wrongIntegrityRuntimeRoot, "index.html");
  await writeFile(wrongIntegrityRuntimePath, (await readFile(wrongIntegrityRuntimePath, "utf8")).replace(/(<script type="module" src="[^"]+">)/g, (tag) => tag.replace(">", ' integrity="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=">')), "utf8");
  await expectFailure(() => verifyEssentials(wrongIntegrityRuntimeRoot, "essentials-manifest.json"), /integrity metadata/, "wrong local integrity metadata cannot block runtime modules");

  const nbspRuntimeRoot = path.join(tempRoot, "nbsp-runtime");
  await cp(rawTextRuntimeRoot, nbspRuntimeRoot, { recursive: true });
  const nbspRuntimePath = path.join(nbspRuntimeRoot, "index.html");
  await writeFile(
    nbspRuntimePath,
    (await readFile(nbspRuntimePath, "utf8")).replace("</head>", `<link\u00a0 rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials.css"><link\u00a0 rel="stylesheet" href="vendor/milosapps-essentials/v1/milos-app-essentials-theme.css"><script\u00a0 type="module" src="vendor/milosapps-essentials/v1/bootstrap.js"></script\u00a0>\n</head>`),
    "utf8"
  );
  await expectFailure(() => verifyEssentials(nbspRuntimeRoot, "essentials-manifest.json"), /stylesheets|bootstrap/, "non-ASCII whitespace cannot impersonate runtime tags");

  const unwiredShareRoot = path.join(tempRoot, "unwired-share");
  await cp(fixtureRoot, unwiredShareRoot, { recursive: true });
  const unwiredSharePath = path.join(unwiredShareRoot, "app.js");
  await writeFile(unwiredSharePath, (await readFile(unwiredSharePath, "utf8")).replace("setPayloadProvider", "setAppPayloadProvider"), "utf8");
  await expectFailure(() => verifyEssentials(unwiredShareRoot, "essentials-manifest.json"), /payload provider/, "unwired share payload");

  const jsxTextShareProviderRoot = path.join(tempRoot, "jsx-text-share-provider");
  await cp(fixtureRoot, jsxTextShareProviderRoot, { recursive: true });
  const jsxTextShareManifestPath = path.join(jsxTextShareProviderRoot, "essentials-manifest.json");
  const jsxTextShareManifest = JSON.parse(await readFile(jsxTextShareManifestPath, "utf8"));
  jsxTextShareManifest.integrationFiles.push("fake-view.tsx");
  await writeFile(jsxTextShareManifestPath, `${JSON.stringify(jsxTextShareManifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(jsxTextShareProviderRoot, "fake-view.tsx"), "export const view = <p>safe text</p>;\n", "utf8");
  await syncEssentials({ "app-root": jsxTextShareProviderRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
  const jsxTextShareAppPath = path.join(jsxTextShareProviderRoot, "app.js");
  await writeFile(jsxTextShareAppPath, (await readFile(jsxTextShareAppPath, "utf8")).replace("setPayloadProvider", "setAppPayloadProvider"), "utf8");
  await writeFile(path.join(jsxTextShareProviderRoot, "fake-view.tsx"), "export const view = <p>.setPayloadProvider()</p>;\n", "utf8");
  await expectFailure(() => verifyEssentials(jsxTextShareProviderRoot, "essentials-manifest.json"), /payload provider/, "JSX text cannot impersonate executable provider wiring");

  const htmlCommentedShareProviderRoot = path.join(tempRoot, "html-commented-share-provider");
  await cp(unwiredShareRoot, htmlCommentedShareProviderRoot, { recursive: true });
  const htmlCommentedShareProviderPath = path.join(htmlCommentedShareProviderRoot, "index.html");
  await writeFile(htmlCommentedShareProviderPath, `${await readFile(htmlCommentedShareProviderPath, "utf8")}\n<!-- fake.setPayloadProvider() -->\n`, "utf8");
  await expectFailure(() => verifyEssentials(htmlCommentedShareProviderRoot, "essentials-manifest.json"), /payload provider/, "HTML comments cannot impersonate a share provider");

  const unwiredPlaceRoot = path.join(tempRoot, "unwired-place");
  await cp(fixtureRoot, unwiredPlaceRoot, { recursive: true });
  const unwiredPlacePath = path.join(unwiredPlaceRoot, "app.js");
  await writeFile(unwiredPlacePath, (await readFile(unwiredPlacePath, "utf8")).replace("setSearchProvider", "setAppSearchProvider"), "utf8");
  await expectFailure(() => verifyEssentials(unwiredPlaceRoot, "essentials-manifest.json"), /search provider/, "unwired place search provider");

  const htmlCommentedPlaceProviderRoot = path.join(tempRoot, "html-commented-place-provider");
  await cp(unwiredPlaceRoot, htmlCommentedPlaceProviderRoot, { recursive: true });
  const htmlCommentedPlaceProviderPath = path.join(htmlCommentedPlaceProviderRoot, "index.html");
  await writeFile(htmlCommentedPlaceProviderPath, `${await readFile(htmlCommentedPlaceProviderPath, "utf8")}\n<!-- fake.setSearchProvider() -->\n`, "utf8");
  await expectFailure(() => verifyEssentials(htmlCommentedPlaceProviderRoot, "essentials-manifest.json"), /search provider/, "HTML comments cannot impersonate a place provider");

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

  const junctionRoot = path.join(tempRoot, "junction-escape");
  await cp(fixtureRoot, junctionRoot, { recursive: true });
  const junctionVendor = path.join(junctionRoot, "vendor", "milosapps-essentials", "v1");
  const junctionOutside = path.join(tempRoot, "outside-vendor");
  await rm(junctionVendor, { recursive: true, force: true });
  await mkdir(junctionOutside, { recursive: true });
  await symlink(junctionOutside, junctionVendor, process.platform === "win32" ? "junction" : "dir");
  await expectFailure(
    () => syncEssentials({ "app-root": junctionRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /symbolic links|junctions|outside app root/,
    "vendor junction escape"
  );

  const hardlinkRoot = path.join(tempRoot, "hardlink-escape");
  await cp(fixtureRoot, hardlinkRoot, { recursive: true });
  const hardlinkOutside = path.join(tempRoot, "outside-hardlink.css");
  const hardlinkDestination = path.join(hardlinkRoot, "vendor", "milosapps-essentials", "v1", "milos-app-essentials.css");
  await writeFile(hardlinkOutside, "external must remain unchanged", "utf8");
  await rm(hardlinkDestination, { force: true });
  await link(hardlinkOutside, hardlinkDestination);
  await expectFailure(
    () => syncEssentials({ "app-root": hardlinkRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /hard-linked files/,
    "hard-linked vendor destination"
  );
  assert((await readFile(hardlinkOutside, "utf8")) === "external must remain unchanged", "hard-linked external file is not overwritten");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write(`public-app-essentials/v1 validation: PASS (${assertions} assertions)\n`);
process.stdout.write("Startup, truthful privacy, share, native date and provider-neutral place search: verified; Production: blocked\n");
