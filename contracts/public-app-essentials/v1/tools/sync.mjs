import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schemaErrors } from "../dist/verify.mjs";

const ID = "public-app-essentials/v1";
const VERSION = "1.1.6";
const PLACE_SUGGESTION_CAPABILITIES = new Set(["consumer-autocomplete-proxy", "provider-autocomplete-direct"]);
const SHELL_ID = "public-app-shell/v2";
const SHELL_VERSION = "2.0.3";
const SHELL_SHARED_COMMIT = "ed898412306e22c6ae1b10ee8953df29f8acd627";
const SHELL_COMPONENT_SHA256 = "sha256:bff9c09ae64e453d186508a4372a1cacc17b4dcd30b770046c7f4efee53731b3";
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
const repositoryRoot = path.resolve(contractRoot, "../../..");
const COLOR_TOKEN = /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|var\(--[a-z0-9]+(?:-[a-z0-9]+)*\))$/i;
const SOURCE_RELEASE_ARTIFACTS = [
  "dist/milos-app-essentials.css",
  "dist/milos-app-essentials.js",
  "dist/verify.mjs",
  "essentials-manifest.schema.json",
  "tools/sync.mjs"
];
const SHELL_ARTIFACTS = [
  "milos-app-shell.js",
  "milos-app-shell.css",
  "bootstrap.js",
  "milos-app-shell-theme.css",
  "verify.mjs"
];

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

async function confinedPath(root, candidate, label, allowMissing = false) {
  const lexical = inside(root, candidate, label);
  const relative = path.relative(root, lexical);
  let cursor = root;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) fail(`${label} must not traverse symbolic links or junctions`);
      if (info.isFile() && info.nlink > 1) fail(`${label} must not use hard-linked files`);
      const resolved = await realpath(cursor);
      const resolvedRelative = path.relative(root, resolved);
      if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) fail(`${label} resolves outside app root`);
    } catch (error) {
      if (error?.code === "ENOENT" && allowMissing) break;
      if (error?.code === "ENOENT") return lexical;
      throw error;
    }
  }
  return lexical;
}

async function requiredFile(file, label) {
  try {
    return await readFile(file);
  } catch {
    fail(`${label} is missing: ${file}`);
  }
}

function canonicalShellPrivacyUrl(environment) {
  return environment === "production"
    ? "https://milos-apps.de/datenschutz"
    : "https://dev.milos-apps.de/datenschutz";
}

async function verifyShellPermanentLink(appRoot, manifest) {
  const reference = manifest.privacy?.permanentLink;
  if (!reference) return;
  if (manifest.privacy.mode !== "no-cookies") fail("privacy.permanentLink is only supported for no-cookies");
  if (reference.provider !== SHELL_ID) fail("privacy.permanentLink requires public-app-shell/v2");
  const shellManifestPath = await confinedPath(appRoot, path.resolve(appRoot, reference.manifest), "shell manifest");
  const shellManifest = JSON.parse((await requiredFile(shellManifestPath, "shell manifest")).toString("utf8"));
  if (shellManifest.appKey !== manifest.appKey) fail("shell manifest appKey must match the essentials manifest");
  if (shellManifest.environment !== manifest.environment || shellManifest.productionApproved !== manifest.productionApproved) fail("shell manifest environment and production boundary must match the essentials manifest");
  if (shellManifest.public !== true || shellManifest.loginRequired !== false) fail("shell manifest must describe the same public no-login surface");
  if (shellManifest.shellContract?.id !== SHELL_ID || shellManifest.shellContract?.version !== SHELL_VERSION) fail("shell manifest must pin public-app-shell/v2.0.3");
  const shellFixture = shellManifest.appKey === "reference-app" && /^0+$/.test(shellManifest.shellContract?.sharedCommit || "");
  if (!shellFixture && shellManifest.shellContract?.sharedCommit !== SHELL_SHARED_COMMIT) fail("shell manifest must pin the immutable public-app-shell/v2.0.3 sharedCommit");
  if (typeof shellManifest.shellContract?.vendorDirectory !== "string" || !shellManifest.shellContract.vendorDirectory.trim()) fail("shell manifest requires a vendorDirectory");
  if (typeof shellManifest.shellContract?.localeModule !== "string" || !shellManifest.shellContract.localeModule.trim()) fail("shell manifest requires a localeModule");
  const shellEntryPath = await confinedPath(appRoot, path.resolve(appRoot, shellManifest.shellContract.entryHtml), "shell entry HTML");
  const essentialsEntryPath = await confinedPath(appRoot, path.resolve(appRoot, manifest.entryHtml), "essentials entry HTML");
  if (path.normalize(shellEntryPath) !== path.normalize(essentialsEntryPath)) fail("shell and essentials manifests must name the same entry HTML");
  if (manifest.privacy.privacyUrl !== canonicalShellPrivacyUrl(manifest.environment)) fail("shell-provided privacy link requires the canonical environment privacyUrl");

  const shellVendorRoot = await confinedPath(appRoot, path.resolve(appRoot, shellManifest.shellContract.vendorDirectory), "shell vendor directory");
  const shellLockPath = await confinedPath(appRoot, path.join(shellVendorRoot, "shell-lock.json"), "shell lock");
  const shellLock = JSON.parse((await requiredFile(shellLockPath, "shell lock")).toString("utf8"));
  if (shellLock.contract !== SHELL_ID || shellLock.version !== SHELL_VERSION) fail("shell lock contract/version mismatch");
  if (shellLock.sharedCommit !== shellManifest.shellContract.sharedCommit) fail("shell lock/shared commit mismatch");
  if (shellLock.appKey !== manifest.appKey) fail("shell lock/app key mismatch");
  const relativeShellManifest = path.relative(appRoot, shellManifestPath).replaceAll(path.sep, "/");
  if (shellLock.manifest !== relativeShellManifest) fail("shell lock/manifest path mismatch");
  const shellVendorDirectory = shellManifest.shellContract.vendorDirectory.replaceAll("\\", "/").replace(/^\.\//, "");
  if (shellLock.vendorDirectory !== shellVendorDirectory) fail("shell lock/vendor directory mismatch");
  if (JSON.stringify(Object.keys(shellLock.artifacts || {}).sort()) !== JSON.stringify([...SHELL_ARTIFACTS].sort())) fail("shell lock artifact set mismatch");
  const shellContents = new Map();
  for (const artifact of SHELL_ARTIFACTS) {
    const artifactPath = await confinedPath(appRoot, path.join(shellVendorRoot, artifact), `shell ${artifact}`);
    const content = await requiredFile(artifactPath, `shell ${artifact}`);
    if (sha256(content) !== shellLock.artifacts?.[artifact]) fail(`shell ${artifact} checksum mismatch`);
    shellContents.set(artifact, content);
  }
  const shellComponent = shellContents.get("milos-app-shell.js").toString("utf8");
  if (sha256(shellContents.get("milos-app-shell.js")) !== SHELL_COMPONENT_SHA256
    || !shellComponent.includes('<a href="${links.privacy}" data-text="privacy">')
    || !shellComponent.includes("https://dev.milos-apps.de/datenschutz")
    || !shellComponent.includes("https://milos-apps.de/datenschutz")) {
    fail("verified shell component must be the immutable v2.0.3 artifact with its canonical permanent privacy footer link");
  }
  const shellEntry = (await requiredFile(shellEntryPath, "shell entry HTML")).toString("utf8").replace(/<!--[\s\S]*?-->/g, "");
  if ((shellEntry.match(/<milos-app-shell(?:\s|>)/gi) || []).length !== 1) fail("shell-provided privacy information requires exactly one milos-app-shell in entry HTML");
  const shellBootstrapPattern = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'](?:\.\/|\/)?(?:[A-Za-z0-9._~/-]+\/)?milosapps-shell\/v2\/bootstrap\.js["'])[^>]*>/i;
  if (!shellBootstrapPattern.test(shellEntry)) fail("shell-provided privacy information requires the locked local Shell bootstrap");
  const shellLocalePath = await confinedPath(appRoot, path.resolve(appRoot, shellManifest.shellContract.localeModule), "shell locale module");
  await requiredFile(shellLocalePath, "shell locale module");
}

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function manifestSha256(manifest) {
  return sha256(Buffer.from(canonicalJson(manifest), "utf8"));
}

function validHttpsUrl(value) {
  if (typeof value !== "string" || /\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.replace(/\.$/, "");
    const labels = hostname.split(".");
    return parsed.protocol === "https:"
      && labels.length >= 2
      && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function safeThemeValue(value, key) {
  if (typeof value !== "string" || !value.trim()) fail(`theme.${key} is required`);
  const token = value.trim();
  if (!COLOR_TOKEN.test(token)) fail(`theme.${key} must be a valid hex color or local CSS custom-property token`);
  return token;
}

export function assertImmutableReleaseCommit(sourceCommit, releaseCommit) {
  if (releaseCommit !== sourceCommit) fail("source commit must equal the immutable release tag commit");
}

async function verifySourceProvenance(sourceCommit) {
  let sourceType;
  try {
    sourceType = execFileSync("git", ["-C", repositoryRoot, "cat-file", "-t", sourceCommit], { encoding: "utf8" }).trim();
  } catch {
    fail("source commit is not a readable Git object");
  }
  if (sourceType !== "commit") fail("source commit must name a Git commit object");
  const relativeFiles = [...SOURCE_RELEASE_ARTIFACTS, "release.json"];
  for (const relative of relativeFiles) {
    const current = await readFile(path.join(contractRoot, relative));
    let committed;
    try {
      committed = execFileSync("git", ["-C", repositoryRoot, "show", `${sourceCommit}:contracts/public-app-essentials/v1/${relative}`], { maxBuffer: 16 * 1024 * 1024 });
    } catch {
      fail(`source commit does not contain the released ${relative}`);
    }
    if (!current.equals(committed)) fail(`${relative} does not match --source-commit`);
  }
  const release = JSON.parse(await readFile(path.join(contractRoot, "release.json"), "utf8"));
  if (release.id !== ID || release.version !== VERSION) fail("release identity does not match the sync tool");
  if (release.tag !== `public-app-essentials-v${VERSION}`) fail("release tag identity does not match the sync tool");
  if (JSON.stringify(Object.keys(release.artifacts || {}).sort()) !== JSON.stringify([...SOURCE_RELEASE_ARTIFACTS].sort())) fail("release artifact set mismatch");
  for (const [relative, expected] of Object.entries(release.artifacts || {})) {
    const content = await readFile(path.join(contractRoot, relative));
    if (sha256(content) !== expected) fail(`release checksum mismatch: ${relative}`);
  }
  let tagType;
  let releaseCommit;
  try {
    tagType = execFileSync("git", ["-C", repositoryRoot, "cat-file", "-t", release.tag], { encoding: "utf8" }).trim();
    releaseCommit = execFileSync("git", ["-C", repositoryRoot, "rev-parse", `${release.tag}^{commit}`], { encoding: "utf8" }).trim();
  } catch {
    fail(`annotated release tag is not available: ${release.tag}`);
  }
  if (tagType !== "tag") fail("release tag must be an annotated Git tag");
  assertImmutableReleaseCommit(sourceCommit, releaseCommit);
}

function validateStoragePurposes(manifest) {
  const purposes = manifest.privacy?.storagePurposes;
  if (!Array.isArray(purposes)) fail("privacy.storagePurposes is required");
  if (manifest.privacy?.usesLocalStorage === true && purposes.length === 0) fail("usesLocalStorage=true requires at least one storage purpose");
  if (manifest.privacy?.usesLocalStorage !== true && purposes.length > 0) fail("storage purposes require usesLocalStorage=true");
  const keys = new Set();
  for (const purpose of purposes) {
    if (typeof purpose?.key !== "string" || !purpose.key.startsWith(`milosapps.${manifest.appKey}.`)) fail("storage purpose key must use the app namespace");
    if (keys.has(purpose.key)) fail("storage purpose keys must be unique");
    keys.add(purpose.key);
    if (typeof purpose.purpose !== "string" || !purpose.purpose.trim()) fail("storage purpose requires a non-empty purpose");
    if (!["session", "bounded", "until-user-clears"].includes(purpose.lifetime)) fail("storage purpose requires a supported lifetime");
    if (purpose.strictlyNecessary !== true) fail("optional device storage is forbidden without a separate consent contract");
  }
}

function validateManifest(manifest, manifestSchema, sourceCommit, fixture) {
  const errors = schemaErrors(manifestSchema, manifest);
  if (errors.length) fail(`manifest schema: ${errors.join("; ")}`);
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
  if (typeof manifest.essentialsContract?.runtimeBasePath !== "string" || !manifest.essentialsContract.runtimeBasePath.trim()) fail("runtimeBasePath is required");
  if (manifest.features?.startup !== true) fail("startup is required for public apps");
  if (manifest.privacy?.mode !== "no-cookies" && manifest.privacy?.mode !== "essential-only") fail("unsupported privacy mode");
  if (manifest.privacy?.optionalTracking !== false) fail("optional tracking is forbidden");
  validateStoragePurposes(manifest);
  if (!validHttpsUrl(manifest.privacy?.privacyUrl)) fail("privacyUrl must be an absolute HTTPS URL with a valid host and no credentials");
  if (manifest.features?.share !== true) fail("share is required");
  if (manifest.privacy.mode === "no-cookies" && manifest.features?.privacyNotice !== false) fail("no-cookies requires privacyNotice=false");
  if (manifest.privacy.mode === "essential-only" && manifest.features?.privacyNotice !== true) fail("essential-only requires privacyNotice=true");
  const suggestions = manifest.features?.placeSuggestions;
  if (!suggestions || !Number.isInteger(suggestions.minChars) || suggestions.minChars < 2 || suggestions.minChars > 6) fail("place suggestions require minChars between 2 and 6");
  if (!Number.isInteger(suggestions.debounceMs) || suggestions.debounceMs < 200 || suggestions.debounceMs > 1000) fail("place suggestions require debounceMs between 200 and 1000");
  if (suggestions.enabled === true) {
    if (manifest.features?.placeSearch !== true) fail("place suggestions require placeSearch=true");
    if (!PLACE_SUGGESTION_CAPABILITIES.has(suggestions.providerCapability)) fail("place suggestions require an evidenced autocomplete capability");
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
  const appRoot = await realpath(path.resolve(options["app-root"]));
  const manifestPath = await confinedPath(appRoot, path.resolve(appRoot, options.manifest), "manifest");
  const manifestContent = await readFile(manifestPath);
  const manifest = JSON.parse(manifestContent.toString("utf8"));
  const manifestSchema = JSON.parse(await readFile(path.join(contractRoot, "essentials-manifest.schema.json"), "utf8"));
  validateManifest(manifest, manifestSchema, options["source-commit"], options.fixture === true);
  await verifyShellPermanentLink(appRoot, manifest);
  if (options.fixture !== true) await verifySourceProvenance(options["source-commit"]);

  const vendorRoot = await confinedPath(appRoot, path.resolve(appRoot, manifest.essentialsContract.vendorDirectory), "vendor directory", true);
  const manifestSchemaTarget = path.join(vendorRoot, "essentials-manifest.schema.json");
  const relativeSchema = path.relative(path.dirname(manifestPath), manifestSchemaTarget).replaceAll(path.sep, "/");
  const expectedSchema = relativeSchema.startsWith(".") ? relativeSchema : `./${relativeSchema}`;
  if (manifest.$schema !== expectedSchema) fail("manifest $schema must resolve to the locked vendored schema");
  if (manifest.features?.placeSuggestions?.enabled) {
    const evidencePath = await confinedPath(appRoot, path.resolve(appRoot, manifest.features.placeSuggestions.evidenceFile), "suggestions evidence");
    await requiredFile(evidencePath, "suggestions evidence");
  }
  const iconPath = await confinedPath(appRoot, path.resolve(appRoot, manifest.loading.iconPath), "loading icon");
  await requiredFile(iconPath, "loading icon");
  await mkdir(vendorRoot, { recursive: true });
  await confinedPath(appRoot, vendorRoot, "vendor directory");
  const runtimeCss = await readFile(path.join(contractRoot, "dist", "milos-app-essentials.css"));
  const runtimeJs = await readFile(path.join(contractRoot, "dist", "milos-app-essentials.js"));
  const verifier = await readFile(path.join(contractRoot, "dist", "verify.mjs"));
  const manifestSchemaContent = await readFile(path.join(contractRoot, "essentials-manifest.schema.json"));
  const themeCss = Buffer.from(themeSource(manifest), "utf8");
  const bootstrap = Buffer.from(bootstrapSource(manifest), "utf8");

  const outputs = {
    "milos-app-essentials.css": runtimeCss,
    "milos-app-essentials-theme.css": themeCss,
    "milos-app-essentials.js": runtimeJs,
    "bootstrap.js": bootstrap,
    "verify.mjs": verifier,
    "essentials-manifest.schema.json": manifestSchemaContent
  };
  for (const [name, content] of Object.entries(outputs)) {
    const destination = await confinedPath(appRoot, path.join(vendorRoot, name), name, true);
    await writeFile(destination, content);
  }

  const lock = {
    contract: ID,
    version: VERSION,
    sharedCommit: options["source-commit"],
    appKey: manifest.appKey,
    manifest: path.relative(appRoot, manifestPath).replaceAll(path.sep, "/"),
    manifestSha256: manifestSha256(manifest),
    vendorDirectory: path.relative(appRoot, vendorRoot).replaceAll(path.sep, "/"),
    runtimeBasePath: manifest.essentialsContract.runtimeBasePath,
    loadingIconRuntimePath: manifest.loading.iconRuntimePath || manifest.loading.iconPath,
    artifacts: {
      "milos-app-essentials.css": sha256(runtimeCss),
      "milos-app-essentials-theme.css": sha256(themeCss),
      "milos-app-essentials.js": sha256(runtimeJs),
      "bootstrap.js": sha256(bootstrap),
      "verify.mjs": sha256(verifier),
      "essentials-manifest.schema.json": sha256(manifestSchemaContent)
    }
  };
  const lockPath = await confinedPath(appRoot, path.join(vendorRoot, "essentials-lock.json"), "essentials lock", true);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return { appRoot, manifestPath, vendorRoot, lock };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = await syncEssentials(parseArgs(process.argv.slice(2)));
  process.stdout.write(`public-app-essentials/v1 synced: ${result.lock.appKey} -> ${result.vendorRoot}\n`);
}
