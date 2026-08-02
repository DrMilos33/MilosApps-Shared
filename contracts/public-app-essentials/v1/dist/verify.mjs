import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "public-app-essentials/v1";
const VERSION = "1.0.0";
const CONSUMERS = new Set([
  "portal",
  "noodle-calculator",
  "sky",
  "cloud-post",
  "somewhere-now",
  "gravity-loop",
  "waste-guide",
  "daylight"
]);
const ARTIFACTS = [
  "milos-app-essentials.css",
  "milos-app-essentials-theme.css",
  "milos-app-essentials.js",
  "bootstrap.js",
  "verify.mjs"
];

function fail(message) {
  throw new Error(`public-app-essentials/v1 verification failed: ${message}`);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    const value = argv[index + 1];
    if (!token?.startsWith("--") || !value) fail("expected --app-root and --manifest");
    result[token.slice(2)] = value;
  }
  if (!result["app-root"] || !result.manifest) fail("--app-root and --manifest are required");
  return result;
}

function inside(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} escapes app root`);
  return candidate;
}

async function requiredFile(file, label) {
  try {
    return await readFile(file);
  } catch {
    fail(`${label} is missing: ${file}`);
  }
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function normalizedWebPath(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

export async function verifyEssentials(appRootInput, manifestInput) {
  const appRoot = path.resolve(appRootInput);
  const manifestPath = inside(appRoot, path.resolve(appRoot, manifestInput), "manifest");
  const manifest = JSON.parse((await requiredFile(manifestPath, "manifest")).toString("utf8"));
  if (manifest.public !== true || manifest.loginRequired !== false) fail("consumer must be a public no-login surface");
  const fixture = manifest.appKey === "reference-app" && /^0+$/.test(manifest.essentialsContract?.sharedCommit || "");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an eligible consumer");
  if (manifest.essentialsContract?.id !== ID || manifest.essentialsContract?.version !== VERSION) fail("contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(manifest.essentialsContract.sharedCommit || "")) fail("full sharedCommit is required");
  if (manifest.environment === "dev" && manifest.productionApproved !== false) fail("DEV requires productionApproved=false");
  if (manifest.environment === "production" && manifest.productionApproved !== true) fail("Production requires explicit approval");
  if (manifest.privacy?.optionalTracking !== false) fail("optional tracking is forbidden");
  if (!/^https:\/\//.test(manifest.privacy?.privacyUrl || "")) fail("privacy URL must use HTTPS");
  if (manifest.features?.privacyNotice !== true || manifest.features?.share !== true) fail("privacy notice and share are required");

  const vendorRoot = inside(appRoot, path.resolve(appRoot, manifest.essentialsContract.vendorDirectory), "vendor directory");
  const lock = JSON.parse((await requiredFile(path.join(vendorRoot, "essentials-lock.json"), "essentials lock")).toString("utf8"));
  if (lock.contract !== ID || lock.version !== VERSION) fail("lock contract/version mismatch");
  if (lock.sharedCommit !== manifest.essentialsContract.sharedCommit) fail("lock/shared commit mismatch");
  if (lock.appKey !== manifest.appKey) fail("lock/app key mismatch");
  for (const artifact of ARTIFACTS) {
    const content = await requiredFile(path.join(vendorRoot, artifact), artifact);
    if (sha256(content) !== lock.artifacts?.[artifact]) fail(`${artifact} checksum mismatch`);
  }

  const entryPath = inside(appRoot, path.resolve(appRoot, manifest.entryHtml), "entry HTML");
  const entry = (await requiredFile(entryPath, "entry HTML")).toString("utf8");
  const vendorWeb = normalizedWebPath(manifest.essentialsContract.vendorDirectory);
  const baseCss = `${vendorWeb}/milos-app-essentials.css`;
  const themeCss = `${vendorWeb}/milos-app-essentials-theme.css`;
  const bootstrap = `${vendorWeb}/bootstrap.js`;
  if (!entry.includes(baseCss) || !entry.includes(themeCss)) fail("entry HTML must load both local essentials stylesheets");
  if (!entry.includes(bootstrap)) fail("entry HTML must load the local generated bootstrap");
  const firstModule = entry.search(/<script\b[^>]*type=["']module["']/i);
  if (firstModule >= 0 && (entry.indexOf(baseCss) > firstModule || entry.indexOf(themeCss) > firstModule)) fail("critical stylesheets must load before module scripts");
  if (/https?:[^"']+milos-app-essentials/i.test(entry)) fail("remote essentials runtime is forbidden");
  if (/data:text\/(?:css|javascript)/i.test(entry)) fail("inlined data runtime is forbidden");

  const integrationSources = [];
  for (const relative of manifest.integrationFiles || []) {
    const file = inside(appRoot, path.resolve(appRoot, relative), "integration file");
    integrationSources.push((await requiredFile(file, "integration file")).toString("utf8"));
  }
  const allSources = [entry, ...integrationSources].join("\n");
  if (!/<milos-share-button(?:\s|>)/i.test(allSources)) fail("shared share control is required");
  if (manifest.features?.datePicker && !/<milos-date-picker(?:\s|>)/i.test(allSources)) fail("enabled date picker is missing");
  if (manifest.features?.placeSearch && !/<milos-place-search(?:\s|>)/i.test(allSources)) fail("enabled place search is missing");

  if (manifest.features?.startup) {
    for (const marker of ["data-milos-app-loading", "data-milos-loading-card", "data-milos-loading-icon", "data-milos-loading-title", "data-milos-loading-message", "data-milos-loading-progress"]) {
      if (!entry.includes(marker)) fail(`startup marker is missing: ${marker}`);
    }
    const iconPath = normalizedWebPath(manifest.loading?.iconPath);
    const imagePattern = new RegExp(`<img[^>]+data-milos-loading-icon[^>]+src=["'](?:\\./)?${iconPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
    const reverseImagePattern = new RegExp(`<img[^>]+src=["'](?:\\./)?${iconPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+data-milos-loading-icon[^>]*>`, "i");
    const match = entry.match(imagePattern)?.[0] || entry.match(reverseImagePattern)?.[0];
    if (!match) fail("loading icon must use the app-owned manifest iconPath");
    if (!/\bwidth=["'](?:[1-4]?\d|5[0-6])["']/i.test(match) || !/\bheight=["'](?:[1-4]?\d|5[0-6])["']/i.test(match)) fail("loading icon needs explicit width/height no larger than 56");
    if (!/(?:milosapps:ready|markMilosAppReady)/.test(allSources)) fail("app must explicitly signal readiness");
  }

  return Object.freeze({ appKey: manifest.appKey, version: VERSION, vendorRoot, features: Object.freeze({ ...manifest.features }) });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyEssentials(args["app-root"], args.manifest);
  process.stdout.write(`public-app-essentials/v1 verification: PASS (${result.appKey}, ${result.version})\n`);
}
