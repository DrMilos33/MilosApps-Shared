import { createHash } from "node:crypto";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncShell } from "./sync.mjs";
import { verifyApp } from "../dist/verify.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(root, "fixtures", "reference-app");
const zeroCommit = "0".repeat(40);
const expectedConsumers = [
  "noodle-calculator",
  "sky",
  "cloud-post",
  "somewhere-now",
  "gravity-loop",
  "waste-guide",
  "daylight"
].sort();

let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`public-app-shell/v2 validation failed: ${message}`);
}

async function json(name) {
  return JSON.parse(await readFile(path.join(root, name), "utf8"));
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
const appSchema = await json("app-manifest.schema.json");
const example = await json("app-manifest.example.json");
const release = await json("release.json");
const component = await readFile(path.join(root, "dist", "milos-app-shell.js"), "utf8");
const componentStyles = await readFile(path.join(root, "dist", "milos-app-shell.css"));
const portableVerifier = await readFile(path.join(root, "dist", "verify.mjs"));
const readme = await readFile(path.join(root, "README.md"), "utf8");

assert(contract.id === "public-app-shell/v2", "contract id");
assert(contract.version === "2.0.3", "contract version");
assert(contract.status === "stable", "stable contract status");
assert(schema.properties.id.const === contract.id, "schema contract id");
assert(schema.properties.version.const === contract.version, "schema contract version");
assert(JSON.stringify([...contract.consumers].sort()) === JSON.stringify(expectedConsumers), "exact public consumers");
assert(contract.excludedConsumers.includes("calendar"), "calendar exclusion");
assert(contract.excludedClasses.includes("login-required"), "login-required exclusion");
assert(contract.delivery.cdnAllowed === false, "CDN forbidden");
assert(contract.delivery.crossRepositoryRuntimeImportAllowed === false, "cross-repository runtime forbidden");
assert(contract.delivery.lockRequired === true && contract.delivery.sha256Required === true, "lock and sha required");
assert(contract.delivery.inlineStyleInjectionAllowed === false, "inline style injection forbidden");
assert(contract.delivery.strictStyleSourceSelfSupported === true, "strict style-src self required");
assert(JSON.stringify(contract.delivery.runtimeAssets.map(({ file, relativeUrl, contentType }) => ({ file, relativeUrl, contentType }))) === JSON.stringify([
  { file: "bootstrap.js", relativeUrl: "./bootstrap.js", contentType: "text/javascript; charset=utf-8" },
  { file: "milos-app-shell.js", relativeUrl: "./milos-app-shell.js", contentType: "text/javascript; charset=utf-8" },
  { file: "milos-app-shell.css", relativeUrl: "./milos-app-shell.css", contentType: "text/css; charset=utf-8" },
  { file: "milos-app-shell-theme.css", relativeUrl: "./milos-app-shell-theme.css", contentType: "text/css; charset=utf-8" }
]), "exact CSP-safe runtime assets and content types");
assert(contract.runtimeDependency === false && contract.databaseDependency === false, "no shared runtime or database");
assert(contract.productionApproved === false, "Production remains unapproved");
assert(contract.languages.required.includes("de") && contract.languages.required.includes("en"), "DE and EN required");
assert(contract.languages.event === "milosapps:localechange", "locale event");
assert(contract.environments.dev.links.apps === "https://dev.milos-apps.de/apps", "DEV apps link");
assert(contract.environments.production.links.apps === "https://milos-apps.de/apps", "Production apps link");
assert(contract.shell.icon.format === "inline-svg" && contract.shell.icon.visibleSizePx === 38, "38px inline SVG slot");
assert(contract.shell.controlsMinTargetPx === 44, "44px controls");
assert(contract.quality.desktop === "1440x900" && contract.quality.mobile === "390x844", "reference viewports");
assert(contract.quality.zoomPercent === 200, "200 percent zoom");
assert(contract.quality.strictCsp.includes("style-src 'self'"), "strict CSP quality gate");
assert(appSchema.properties.$schema?.type === "string", "manifest schema permits its own $schema declaration");
assert(Object.keys(example).every((key) => Object.hasOwn(appSchema.properties, key)), "example contains only schema-declared properties");
assert(appSchema.properties.shellContract.required.includes("localeModule"), "locale module required by schema");
assert(appSchema.properties.dev.oneOf.length === 2, "DEV URLs support published or blocked lifecycle");
assert(example.shellContract.id === contract.id && example.shellContract.version === contract.version, "example pins v2");
assert(example.public === true && example.loginRequired === false && example.productionApproved === false, "example public DEV boundary");
assert(release.id === contract.id && release.version === contract.version, "release id/version");
assert(release.tag === "public-app-shell-v2.0.3", "release tag");
assert(release.artifacts["dist/milos-app-shell.js"] === `sha256:${createHash("sha256").update(component).digest("hex")}`, "component release hash");
assert(release.artifacts["dist/milos-app-shell.css"] === `sha256:${createHash("sha256").update(componentStyles).digest("hex")}`, "component stylesheet release hash");
assert(release.artifacts["dist/verify.mjs"] === `sha256:${createHash("sha256").update(portableVerifier).digest("hex")}`, "verifier release hash");

for (const marker of [
  "customElements.define",
  "milosapps:localechange",
  "slot name=\"app-icon\"",
  "slot name=\"main\"",
  "germanFlag()",
  "All apps",
  "https://dev.milos-apps.de/apps",
  "https://milos-apps.de/apps"
]) {
  assert(component.includes(marker), `component marker: ${marker}`);
}
for (const marker of [
  "grid-template-rows: auto minmax(0, 1fr) auto",
  "min-height: 100dvh",
  "prefers-reduced-motion: reduce",
  "--milos-shell-icon-size: 38px",
  ".brand { width: 100%; max-width: 100%; flex-wrap: wrap; }"
]) {
  assert(componentStyles.includes(marker), `component stylesheet marker: ${marker}`);
}
assert(component.includes('new URL("./milos-app-shell.css", import.meta.url)'), "component loads external same-origin stylesheet");
assert(!component.includes("<style>") && !component.includes("style.setProperty"), "component avoids inline styles");
assert(!componentStyles.includes("min-width: 20rem"), "fixed 20rem page minimum is forbidden");
assert(!componentStyles.includes("--milos-shell-icon-size: 2.375rem"), "icon must not double with root font zoom");
assert(readme.includes("kein CDN") && readme.includes("keine gemeinsame Laufzeit"), "README lifecycle boundary");

const syntax = spawnSync(process.execPath, ["--check", path.join(root, "dist", "milos-app-shell.js")], { encoding: "utf8" });
assert(syntax.status === 0, `component syntax: ${syntax.stderr}`);
const verifierSyntax = spawnSync(process.execPath, ["--check", path.join(root, "dist", "verify.mjs")], { encoding: "utf8" });
assert(verifierSyntax.status === 0, `verifier syntax: ${verifierSyntax.stderr}`);

await syncShell({
  "app-root": fixtureRoot,
  manifest: "milos-app.json",
  "source-commit": zeroCommit,
  fixture: true
});
const fixtureResult = await verifyApp(fixtureRoot, "milos-app.json");
assert(fixtureResult.appKey === "reference-app", "reference fixture verifies");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "milos-shell-v2-"));
try {
  const appRoot = path.join(tempRoot, "app");
  await cp(fixtureRoot, appRoot, { recursive: true });
  await syncShell({ "app-root": appRoot, manifest: "milos-app.json", "source-commit": zeroCommit, fixture: true });
  await writeFile(path.join(appRoot, "vendor", "milosapps-shell", "v2", "milos-app-shell.js"), "tampered", "utf8");
  await expectFailure(
    () => verifyApp(appRoot, "milos-app.json"),
    /checksum mismatch/,
    "tampered artifact"
  );

  const productionRoot = path.join(tempRoot, "production");
  await cp(fixtureRoot, productionRoot, { recursive: true });
  const productionManifestPath = path.join(productionRoot, "milos-app.json");
  const productionManifest = JSON.parse(await readFile(productionManifestPath, "utf8"));
  productionManifest.environment = "production";
  productionManifest.productionApproved = false;
  await writeFile(productionManifestPath, `${JSON.stringify(productionManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncShell({ "app-root": productionRoot, manifest: "milos-app.json", "source-commit": zeroCommit, fixture: true }),
    /Production requires explicit approval/,
    "unapproved Production"
  );

  const escapeRoot = path.join(tempRoot, "escape");
  await cp(fixtureRoot, escapeRoot, { recursive: true });
  const escapeManifestPath = path.join(escapeRoot, "milos-app.json");
  const escapeManifest = JSON.parse(await readFile(escapeManifestPath, "utf8"));
  escapeManifest.shellContract.vendorDirectory = "../outside";
  await writeFile(escapeManifestPath, `${JSON.stringify(escapeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncShell({ "app-root": escapeRoot, manifest: "milos-app.json", "source-commit": zeroCommit, fixture: true }),
    /vendor directory must stay inside app root/,
    "path escape"
  );

  const unknownRoot = path.join(tempRoot, "unknown");
  await cp(fixtureRoot, unknownRoot, { recursive: true });
  const unknownManifestPath = path.join(unknownRoot, "milos-app.json");
  const unknownManifest = JSON.parse(await readFile(unknownManifestPath, "utf8"));
  unknownManifest.appKey = "unknown-public-app";
  await writeFile(unknownManifestPath, `${JSON.stringify(unknownManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncShell({ "app-root": unknownRoot, manifest: "milos-app.json", "source-commit": "1".repeat(40) }),
    /not an approved public-shell consumer/,
    "unknown consumer"
  );

  const blockedRoot = path.join(tempRoot, "blocked");
  await cp(fixtureRoot, blockedRoot, { recursive: true });
  const blockedManifestPath = path.join(blockedRoot, "milos-app.json");
  const blockedManifest = JSON.parse(await readFile(blockedManifestPath, "utf8"));
  blockedManifest.dev.url = null;
  blockedManifest.dev.healthUrl = null;
  await writeFile(blockedManifestPath, `${JSON.stringify(blockedManifest, null, 2)}\n`, "utf8");
  await syncShell({ "app-root": blockedRoot, manifest: "milos-app.json", "source-commit": zeroCommit, fixture: true });
  const blockedResult = await verifyApp(blockedRoot, "milos-app.json");
  assert(blockedResult.devPublished === false, "blocked DEV lifecycle verifies without invented URLs");

  const partialDevRoot = path.join(tempRoot, "partial-dev");
  await cp(fixtureRoot, partialDevRoot, { recursive: true });
  const partialDevManifestPath = path.join(partialDevRoot, "milos-app.json");
  const partialDevManifest = JSON.parse(await readFile(partialDevManifestPath, "utf8"));
  partialDevManifest.dev.healthUrl = null;
  await writeFile(partialDevManifestPath, `${JSON.stringify(partialDevManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncShell({ "app-root": partialDevRoot, manifest: "milos-app.json", "source-commit": zeroCommit, fixture: true }),
    /must both be HTTPS or both be null/,
    "partial DEV URL pair"
  );

  const unsafeThemeRoot = path.join(tempRoot, "unsafe-theme");
  await cp(fixtureRoot, unsafeThemeRoot, { recursive: true });
  const unsafeThemeManifestPath = path.join(unsafeThemeRoot, "milos-app.json");
  const unsafeThemeManifest = JSON.parse(await readFile(unsafeThemeManifestPath, "utf8"));
  unsafeThemeManifest.theme.accent = "red; background: url(https://invalid.example/)";
  await writeFile(unsafeThemeManifestPath, `${JSON.stringify(unsafeThemeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncShell({ "app-root": unsafeThemeRoot, manifest: "milos-app.json", "source-commit": zeroCommit, fixture: true }),
    /unsafe CSS token/,
    "unsafe generated theme value"
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write(`public-app-shell/v2 validation: PASS (${assertions} assertions)\n`);
process.stdout.write(`Consumers: ${expectedConsumers.length}; delivery: pinned local ES module; Production: blocked\n`);
