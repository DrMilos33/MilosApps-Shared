import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "public-app-essentials/v1";
const VERSION = "1.1.0";
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
const THEME_PROPERTIES = Object.freeze({
  accent: "--milos-essential-accent",
  accentContrast: "--milos-essential-accent-contrast",
  surface: "--milos-essential-surface",
  surfaceSoft: "--milos-essential-surface-soft",
  text: "--milos-essential-text",
  muted: "--milos-essential-muted",
  border: "--milos-essential-border",
  focus: "--milos-essential-focus"
});
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const contractRoot = path.resolve(scriptRoot, "..");

function fail(message) {
  throw new Error(`public-app-essentials/v1 sync failed: ${message}`);
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

function inside(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} must stay inside app root`);
  return candidate;
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function safeThemeValue(value, key) {
  if (typeof value !== "string" || !value.trim()) fail(`theme.${key} is required`);
  if (/[;{}<>\r\n]/.test(value)) fail(`theme.${key} contains an unsafe CSS token`);
  return value.trim();
}

function validateManifest(manifest, sourceCommit, fixture) {
  if (manifest.public !== true || manifest.loginRequired !== false) fail("only public no-login surfaces are consumers");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.appKey || "")) fail("invalid appKey");
  if (fixture && manifest.appKey !== "reference-app") fail("fixture mode is restricted to reference-app");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an eligible essentials consumer");
  if (manifest.essentialsContract?.id !== ID || manifest.essentialsContract?.version !== VERSION) fail("manifest contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) fail("source commit must be a full lowercase SHA");
  if (!fixture && /^0+$/.test(sourceCommit)) fail("zero source commit is fixture-only");
  if (manifest.essentialsContract.sharedCommit !== sourceCommit) fail("manifest sharedCommit must equal --source-commit");
  if (manifest.environment !== "dev" && manifest.environment !== "production") fail("invalid environment");
  if (manifest.environment === "dev" && manifest.productionApproved !== false) fail("DEV requires productionApproved=false");
  if (manifest.environment === "production" && manifest.productionApproved !== true) fail("Production requires explicit approval");
  if (!Array.isArray(manifest.integrationFiles) || manifest.integrationFiles.length === 0) fail("integrationFiles are required");
  if (manifest.privacy?.mode !== "no-cookies" && manifest.privacy?.mode !== "essential-only") fail("unsupported privacy mode");
  if (manifest.privacy?.optionalTracking !== false) fail("optional tracking is forbidden");
  if (!/^https:\/\//.test(manifest.privacy?.privacyUrl || "")) fail("privacyUrl must use HTTPS");
  if (manifest.features?.share !== true) fail("share is required");
  if (manifest.privacy.mode === "no-cookies" && manifest.features?.privacyNotice !== false) fail("no-cookies requires privacyNotice=false");
  if (manifest.privacy.mode === "essential-only" && manifest.features?.privacyNotice !== true) fail("essential-only requires privacyNotice=true");
  const suggestions = manifest.features?.placeSuggestions;
  if (!suggestions || !Number.isInteger(suggestions.minChars) || suggestions.minChars < 2 || suggestions.minChars > 6) fail("place suggestions require minChars between 2 and 6");
  if (!Number.isInteger(suggestions.debounceMs) || suggestions.debounceMs < 200 || suggestions.debounceMs > 1000) fail("place suggestions require debounceMs between 200 and 1000");
  if (suggestions.enabled === true) {
    if (manifest.features?.placeSearch !== true) fail("place suggestions require placeSearch=true");
    if (suggestions.providerCapability !== "consumer-autocomplete-proxy") fail("place suggestions require a consumer autocomplete proxy");
    if (typeof suggestions.evidenceFile !== "string" || !suggestions.evidenceFile.trim()) fail("place suggestions require provider evidence");
  } else if (suggestions.enabled !== false || suggestions.providerCapability !== "submit-only" || suggestions.evidenceFile !== null) {
    fail("disabled place suggestions must remain submit-only without provider evidence");
  }
  if (!manifest.loading?.appName?.trim() || !manifest.loading?.message?.de?.trim() || !manifest.loading?.message?.en?.trim()) fail("loading copy is required in DE and EN");
  for (const key of Object.keys(THEME_PROPERTIES)) safeThemeValue(manifest.theme?.[key], key);
}

function themeSource(manifest) {
  const properties = Object.entries(THEME_PROPERTIES)
    .map(([key, property]) => `  ${property}: ${safeThemeValue(manifest.theme[key], key)};`)
    .join("\n");
  return `body[data-milos-essentials-app="${manifest.appKey}"] {\n${properties}\n}\n`;
}

function bootstrapSource(manifest) {
  const config = {
    appKey: manifest.appKey,
    environment: manifest.environment,
    productionApproved: manifest.productionApproved,
    loading: manifest.loading,
    privacy: manifest.privacy,
    features: manifest.features
  };
  return `import { initMilosAppEssentials } from "./milos-app-essentials.js";\n\ndocument.body?.setAttribute("data-milos-essentials-app", ${JSON.stringify(manifest.appKey)});\nexport const milosAppEssentials = initMilosAppEssentials(${JSON.stringify(config, null, 2)});\nglobalThis.milosAppEssentials = milosAppEssentials;\n`;
}

export async function syncEssentials(options) {
  const appRoot = path.resolve(options["app-root"]);
  const manifestPath = inside(appRoot, path.resolve(appRoot, options.manifest), "manifest");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifest(manifest, options["source-commit"], options.fixture === true);

  const vendorRoot = inside(appRoot, path.resolve(appRoot, manifest.essentialsContract.vendorDirectory), "vendor directory");
  await mkdir(vendorRoot, { recursive: true });
  const runtimeCss = await readFile(path.join(contractRoot, "dist", "milos-app-essentials.css"));
  const runtimeJs = await readFile(path.join(contractRoot, "dist", "milos-app-essentials.js"));
  const verifier = await readFile(path.join(contractRoot, "dist", "verify.mjs"));
  const themeCss = Buffer.from(themeSource(manifest), "utf8");
  const bootstrap = Buffer.from(bootstrapSource(manifest), "utf8");

  await writeFile(path.join(vendorRoot, "milos-app-essentials.css"), runtimeCss);
  await writeFile(path.join(vendorRoot, "milos-app-essentials-theme.css"), themeCss);
  await writeFile(path.join(vendorRoot, "milos-app-essentials.js"), runtimeJs);
  await writeFile(path.join(vendorRoot, "bootstrap.js"), bootstrap);
  await copyFile(path.join(contractRoot, "dist", "verify.mjs"), path.join(vendorRoot, "verify.mjs"));

  const lock = {
    contract: ID,
    version: VERSION,
    sharedCommit: options["source-commit"],
    appKey: manifest.appKey,
    manifest: path.relative(appRoot, manifestPath).replaceAll(path.sep, "/"),
    vendorDirectory: path.relative(appRoot, vendorRoot).replaceAll(path.sep, "/"),
    artifacts: {
      "milos-app-essentials.css": sha256(runtimeCss),
      "milos-app-essentials-theme.css": sha256(themeCss),
      "milos-app-essentials.js": sha256(runtimeJs),
      "bootstrap.js": sha256(bootstrap),
      "verify.mjs": sha256(verifier)
    }
  };
  await writeFile(path.join(vendorRoot, "essentials-lock.json"), `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return { appRoot, manifestPath, vendorRoot, lock };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = await syncEssentials(parseArgs(process.argv.slice(2)));
  process.stdout.write(`public-app-essentials/v1 synced: ${result.lock.appKey} -> ${result.vendorRoot}\n`);
}
