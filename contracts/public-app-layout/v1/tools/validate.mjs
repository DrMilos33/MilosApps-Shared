import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncLayout } from "./sync.mjs";
import { verifyLayout } from "../dist/verify-layout.mjs";

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
  if (!condition) throw new Error(`public-app-layout/v1 validation failed: ${message}`);
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
const manifestSchema = await json("layout-manifest.schema.json");
const example = await json("layout-manifest.example.json");
const release = await json("release.json");
const layoutCss = await readFile(path.join(root, "dist", "milos-app-layout.css"));
const verifier = await readFile(path.join(root, "dist", "verify-layout.mjs"));
const readme = await readFile(path.join(root, "README.md"), "utf8");

assert(contract.id === "public-app-layout/v1" && contract.version === "1.0.0", "contract id/version");
assert(contract.status === "pilot", "pilot status");
assert(schema.properties.id.const === contract.id && schema.properties.version.const === contract.version, "contract schema pins id/version");
assert(JSON.stringify([...contract.eligibleConsumers].sort()) === JSON.stringify(expectedConsumers), "eligible public consumers");
assert(contract.pilotConsumer === "cloud-post", "Wolkenpost is the only pilot");
assert(JSON.stringify(contract.referenceConsumers) === JSON.stringify(["sky", "gravity-loop", "noodle-calculator"]), "exact design references");
assert(contract.excludedConsumers.includes("calendar") && contract.excludedClasses.includes("login-required"), "calendar and login apps excluded");
assert(contract.relationship.shellContract === "public-app-shell/v2", "shell relationship remains explicit");
assert(contract.delivery.cdnAllowed === false && contract.delivery.crossRepositoryRuntimeImportAllowed === false, "local pinned delivery");
assert(contract.delivery.lockRequired && contract.delivery.sha256Required, "lock and hashes required");
assert(contract.quality.desktop.introMaxHeightPx === 320 && contract.quality.desktop.primaryWorkMaxTopPx === 520, "desktop density budget");
assert(contract.quality.mobile.introMaxHeightPx === 280 && contract.quality.mobile.primaryWorkMaxTopPx === 500, "mobile density budget");
assert(contract.quality.zoom.percent === 200 && contract.quality.controlsMinTargetPx === 44, "zoom and touch targets");
assert(contract.rollout.automaticMigration === false && contract.rollout.pilotMustPassUserReview === true, "pilot review gate");
assert(contract.rollout.productionApproved === false, "Production blocked");
assert(manifestSchema.properties.$schema.type === "string", "manifest permits schema declaration");
assert(Object.keys(example).every((key) => Object.hasOwn(manifestSchema.properties, key)), "example uses only schema properties");
assert(example.layoutContract.id === contract.id && example.layoutContract.version === contract.version, "example pins contract");
assert(example.public === true && example.loginRequired === false && example.productionApproved === false, "example public DEV boundary");
assert(release.id === contract.id && release.version === contract.version && release.tag === "public-app-layout-v1.0.0", "release identity");
assert(release.artifacts["dist/milos-app-layout.css"] === `sha256:${createHash("sha256").update(layoutCss).digest("hex")}`, "layout release hash");
assert(release.artifacts["dist/verify-layout.mjs"] === `sha256:${createHash("sha256").update(verifier).digest("hex")}`, "verifier release hash");

const cssText = layoutCss.toString("utf8");
for (const marker of [
  "data-milos-layout=\"compact\"",
  "--milos-layout-content-max: 72rem",
  "--milos-layout-work-max: 60rem",
  "min-height: 44px",
  "data-milos-primary-work",
  "data-milos-panel] [data-milos-panel",
  "grid-template-rows: auto minmax(0, 1fr) auto",
  "prefers-reduced-motion: reduce"
]) {
  assert(cssText.includes(marker), `layout CSS marker: ${marker}`);
}
assert(!cssText.includes("min-width: 20rem"), "fixed viewport floor forbidden");
assert(readme.includes("1440 × 900") && readme.includes("390 × 844") && readme.includes("360 × 800"), "README density matrix");
assert(readme.includes("Der erste Verbraucher ist ausschließlich `cloud-post`"), "README single-pilot gate");

await syncLayout({
  "app-root": fixtureRoot,
  manifest: "milos-layout.json",
  "source-commit": zeroCommit,
  fixture: true
});
const fixtureResult = await verifyLayout(fixtureRoot, "milos-layout.json");
assert(fixtureResult.appKey === "reference-app" && fixtureResult.profile === "focused-task", "reference fixture verifies");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "milos-layout-v1-"));
try {
  const tamperedRoot = path.join(tempRoot, "tampered");
  await cp(fixtureRoot, tamperedRoot, { recursive: true });
  await writeFile(path.join(tamperedRoot, "vendor", "milosapps-layout", "v1", "milos-app-layout.css"), "tampered", "utf8");
  await expectFailure(() => verifyLayout(tamperedRoot, "milos-layout.json"), /checksum mismatch/, "tampered artifact");

  const productionRoot = path.join(tempRoot, "production");
  await cp(fixtureRoot, productionRoot, { recursive: true });
  const productionManifestPath = path.join(productionRoot, "milos-layout.json");
  const productionManifest = JSON.parse(await readFile(productionManifestPath, "utf8"));
  productionManifest.productionApproved = true;
  await writeFile(productionManifestPath, `${JSON.stringify(productionManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncLayout({ "app-root": productionRoot, manifest: "milos-layout.json", "source-commit": zeroCommit, fixture: true }),
    /DEV-only/,
    "Production pilot"
  );

  const missingMarkerRoot = path.join(tempRoot, "missing-marker");
  await cp(fixtureRoot, missingMarkerRoot, { recursive: true });
  const entryPath = path.join(missingMarkerRoot, "index.html");
  const entry = await readFile(entryPath, "utf8");
  await writeFile(entryPath, entry.replace("data-milos-primary-work", "data-app-work"), "utf8");
  await expectFailure(() => verifyLayout(missingMarkerRoot, "milos-layout.json"), /primary work marker/, "missing primary marker");

  const escapeRoot = path.join(tempRoot, "escape");
  await cp(fixtureRoot, escapeRoot, { recursive: true });
  const escapeManifestPath = path.join(escapeRoot, "milos-layout.json");
  const escapeManifest = JSON.parse(await readFile(escapeManifestPath, "utf8"));
  escapeManifest.layoutContract.vendorDirectory = "../outside";
  await writeFile(escapeManifestPath, `${JSON.stringify(escapeManifest, null, 2)}\n`, "utf8");
  await expectFailure(
    () => syncLayout({ "app-root": escapeRoot, manifest: "milos-layout.json", "source-commit": zeroCommit, fixture: true }),
    /inside app root/,
    "path escape"
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

process.stdout.write(`public-app-layout/v1 validation: PASS (${assertions} assertions)\n`);
process.stdout.write("Pilot: cloud-post; references: sky, gravity-loop, noodle-calculator; Production: blocked\n");
