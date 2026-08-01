import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "public-app-layout/v1";
const VERSION = "1.0.0";
const CONSUMERS = new Set([
  "noodle-calculator",
  "sky",
  "cloud-post",
  "somewhere-now",
  "gravity-loop",
  "waste-guide",
  "daylight"
]);
const THEME_PROPERTIES = Object.freeze({
  page: "--milos-layout-page",
  surface: "--milos-layout-surface",
  surfaceStrong: "--milos-layout-surface-strong",
  text: "--milos-layout-text",
  muted: "--milos-layout-muted",
  border: "--milos-layout-border",
  accent: "--milos-layout-accent",
  accentContrast: "--milos-layout-accent-contrast",
  focus: "--milos-layout-focus"
});
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const contractRoot = path.resolve(scriptRoot, "..");

function fail(message) {
  throw new Error(`public-app-layout/v1 sync failed: ${message}`);
}

function parseArgs(argv) {
  const result = { fixture: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--fixture") {
      result.fixture = true;
      continue;
    }
    if (!token.startsWith("--")) fail(`unexpected argument ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for ${token}`);
    result[token.slice(2)] = value;
    index += 1;
  }
  for (const required of ["app-root", "manifest", "source-commit"]) {
    if (!result[required]) fail(`--${required} is required`);
  }
  return result;
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function inside(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} must stay inside app root`);
  return candidate;
}

function safeThemeValue(value, key) {
  if (typeof value !== "string" || !value.trim()) fail(`theme.${key} is required`);
  if (/[;{}<>\r\n]/.test(value)) fail(`theme.${key} contains an unsafe CSS token`);
  return value.trim();
}

function validateManifest(manifest, sourceCommit, fixture) {
  if (manifest.public !== true || manifest.loginRequired !== false) fail("only public no-login apps are consumers");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.appKey || "")) fail("invalid appKey");
  if (fixture && manifest.appKey !== "reference-app") fail("fixture mode is restricted to reference-app");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an eligible layout consumer");
  if (manifest.layoutContract?.id !== ID || manifest.layoutContract?.version !== VERSION) fail("manifest contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) fail("source commit must be a full lowercase SHA");
  if (!fixture && /^0+$/.test(sourceCommit)) fail("zero source commit is fixture-only");
  if (manifest.layoutContract.sharedCommit !== sourceCommit) fail("manifest sharedCommit must equal --source-commit");
  if (!["focused-task", "guided-flow", "immersive"].includes(manifest.profile)) fail("unknown layout profile");
  if (!Array.isArray(manifest.sources?.markup) || manifest.sources.markup.length === 0) fail("at least one markup source is required");
  if (!Array.isArray(manifest.sources?.styles) || manifest.sources.styles.length === 0) fail("at least one style source is required");
  if (manifest.productionApproved !== false) fail("v1 pilot is DEV-only and requires productionApproved=false");
  for (const key of Object.keys(THEME_PROPERTIES)) safeThemeValue(manifest.theme?.[key], key);
}

function themeSource(manifest) {
  const properties = Object.entries(THEME_PROPERTIES)
    .map(([key, property]) => `  ${property}: ${safeThemeValue(manifest.theme[key], key)};`)
    .join("\n");
  return `[data-milos-layout="compact"][data-milos-app-key="${manifest.appKey}"] {\n${properties}\n}\n`;
}

export async function syncLayout(options) {
  const appRoot = path.resolve(options["app-root"]);
  const manifestPath = inside(appRoot, path.resolve(appRoot, options.manifest), "manifest");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifest(manifest, options["source-commit"], options.fixture === true);

  const vendorRoot = inside(appRoot, path.resolve(appRoot, manifest.layoutContract.vendorDirectory), "vendor directory");
  await mkdir(vendorRoot, { recursive: true });
  const layoutCss = await readFile(path.join(contractRoot, "dist", "milos-app-layout.css"));
  const verifier = await readFile(path.join(contractRoot, "dist", "verify-layout.mjs"));
  const themeCss = Buffer.from(themeSource(manifest), "utf8");

  await writeFile(path.join(vendorRoot, "milos-app-layout.css"), layoutCss);
  await writeFile(path.join(vendorRoot, "milos-app-layout-theme.css"), themeCss);
  await copyFile(path.join(contractRoot, "dist", "verify-layout.mjs"), path.join(vendorRoot, "verify-layout.mjs"));

  const lock = {
    contract: ID,
    version: VERSION,
    sharedCommit: options["source-commit"],
    appKey: manifest.appKey,
    profile: manifest.profile,
    manifest: path.relative(appRoot, manifestPath).replaceAll(path.sep, "/"),
    vendorDirectory: path.relative(appRoot, vendorRoot).replaceAll(path.sep, "/"),
    artifacts: {
      "milos-app-layout.css": sha256(layoutCss),
      "milos-app-layout-theme.css": sha256(themeCss),
      "verify-layout.mjs": sha256(verifier)
    }
  };
  await writeFile(path.join(vendorRoot, "layout-lock.json"), `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return { appRoot, manifestPath, vendorRoot, lock };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = await syncLayout(parseArgs(process.argv.slice(2)));
  process.stdout.write(`public-app-layout/v1 synced: ${result.lock.appKey} -> ${result.vendorRoot}\n`);
}
