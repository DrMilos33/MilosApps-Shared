import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncEssentials } from "./sync.mjs";
import { verifyEssentials } from "../dist/verify.mjs";

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
const manifestSchema = await json("essentials-manifest.schema.json");
const example = await json("essentials-manifest.example.json");
const release = await json("release.json");
const css = await readFile(path.join(root, "dist", "milos-app-essentials.css"));
const runtime = await readFile(path.join(root, "dist", "milos-app-essentials.js"));
const verifier = await readFile(path.join(root, "dist", "verify.mjs"));
const readme = await readFile(path.join(root, "README.md"), "utf8");

assert(contract.id === "public-app-essentials/v1" && contract.version === "1.0.0", "contract id/version");
assert(contract.status === "stable", "stable contract status");
assert(schema.properties.id.const === contract.id && schema.properties.version.const === contract.version, "contract schema pins id/version");
assert(JSON.stringify([...contract.eligibleConsumers].sort()) === JSON.stringify(expectedConsumers), "exact eligible consumers");
assert(contract.excludedConsumers.includes("calendar") && contract.excludedClasses.includes("login-required-app"), "calendar and login apps excluded");
assert(contract.modules.startup.iconMaxPx === 56 && contract.modules.startup.iconMaxMobilePx === 48, "bounded startup icon");
assert(contract.modules.privacyNotice.fakeConsentForbidden && contract.modules.privacyNotice.optionalTrackingAllowed === false, "truthful privacy notice");
assert(contract.modules.share.nativeApi === "navigator.share" && contract.modules.share.fallback === "clipboard", "share strategy");
assert(contract.modules.datePicker.implementation === "native-date-input-plus-year-jump", "native date foundation");
assert(contract.modules.placeSearch.providerOwnedByConsumer && contract.modules.placeSearch.explicitSubmitRequired, "provider-neutral explicit place search");
assert(contract.modules.placeSearch.publicNominatimAutocompleteForbidden, "public Nominatim autocomplete blocked");
assert(contract.quality.controlsMinTargetPx === 44 && contract.quality.zoomViewport === "360x800@200%", "touch and reflow gates");
assert(contract.quality.productionApproved === false, "Production blocked");
assert(manifestSchema.properties.$schema.type === "string", "manifest permits schema declaration");
assert(Object.keys(example).every((key) => Object.hasOwn(manifestSchema.properties, key)), "example uses schema properties only");
assert(example.public === true && example.loginRequired === false && example.productionApproved === false, "example public DEV boundary");
assert(example.privacy.optionalTracking === false && example.features.share === true, "example privacy/share boundary");
assert(release.id === contract.id && release.version === contract.version && release.tag === "public-app-essentials-v1.0.0", "release identity");
assert(release.artifacts["dist/milos-app-essentials.css"] === digest(css), "release CSS hash");
assert(release.artifacts["dist/milos-app-essentials.js"] === digest(runtime), "release runtime hash");
assert(release.artifacts["dist/verify.mjs"] === digest(verifier), "release verifier hash");

const cssText = css.toString("utf8");
for (const marker of [
  "milos-app-shell:not(:defined) > [slot=\"app-icon\"]",
  "width: min(56px, 18vw)",
  "max-width: 48px",
  "data-milos-app-loading",
  "data-milos-privacy-notice",
  "min-height: var(--milos-essential-target)",
  "data-milos-date-row",
  "data-milos-place-results",
  "prefers-reduced-motion: reduce"
]) assert(cssText.includes(marker), `runtime CSS marker: ${marker}`);
assert(!cssText.includes("min-width: 20rem"), "fixed viewport floor forbidden");

const runtimeText = runtime.toString("utf8");
for (const marker of ["navigator.share", "navigator.clipboard", "milosapps:datechange", "milosapps:placechange", "milosapps:ready", "role\", \"combobox"] ) {
  assert(runtimeText.includes(marker), `runtime JS marker: ${marker}`);
}
assert(!runtimeText.includes("style.setProperty"), "runtime inline theme mutation forbidden");
assert(!runtimeText.includes("queueSearch"), "place search must not autocomplete on input");
assert(readme.includes("kein Einwilligungsbanner") && readme.includes("Suchen-Schaltfläche") && readme.includes("abgeschickt"), "README explains privacy and provider boundaries");

await syncEssentials({ "app-root": fixtureRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true });
const fixture = await verifyEssentials(fixtureRoot, "essentials-manifest.json");
assert(fixture.appKey === "reference-app" && fixture.version === "1.0.0", "reference fixture verifies");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "milos-essentials-v1-"));
try {
  const tamperedRoot = path.join(tempRoot, "tampered");
  await cp(fixtureRoot, tamperedRoot, { recursive: true });
  await writeFile(path.join(tamperedRoot, "vendor", "milosapps-essentials", "v1", "milos-app-essentials.css"), "tampered", "utf8");
  await expectFailure(() => verifyEssentials(tamperedRoot, "essentials-manifest.json"), /checksum mismatch/, "tampered artifact");

  const trackingRoot = path.join(tempRoot, "tracking");
  await cp(fixtureRoot, trackingRoot, { recursive: true });
  const trackingManifestPath = path.join(trackingRoot, "essentials-manifest.json");
  const trackingManifest = JSON.parse(await readFile(trackingManifestPath, "utf8"));
  trackingManifest.privacy.optionalTracking = true;
  await writeFile(trackingManifestPath, `${JSON.stringify(trackingManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncEssentials({ "app-root": trackingRoot, manifest: "essentials-manifest.json", "source-commit": zeroCommit, fixture: true }),
    /optional tracking/,
    "optional tracking"
  );

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
    /inside app root/,
    "path escape"
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write(`public-app-essentials/v1 validation: PASS (${assertions} assertions)\n`);
process.stdout.write("Startup, truthful privacy, share, native date and provider-neutral place search: verified; Production: blocked\n");
