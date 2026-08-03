import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "public-app-essentials/v1";
const VERSION = "1.1.1";
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
  "verify.mjs",
  "essentials-manifest.schema.json"
];

function fail(message) {
  throw new Error(`public-app-essentials/v1 verification failed: ${message}`);
}

function valueHasType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

export function schemaErrors(schema, value, location = "$", errors = []) {
  if (!schema || typeof schema !== "object") return errors;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => valueHasType(value, type))) {
    errors.push(`${location}: expected ${types.join(" or ")}`);
    return errors;
  }
  if (Object.hasOwn(schema, "const") && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${location}: value differs from const`);
  if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) errors.push(`${location}: value is not in enum`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location}: string is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${location}: string is too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${location}: pattern mismatch`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${location}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${location}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${location}: too many items`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${location}: duplicate items`);
    if (schema.items) value.forEach((item, index) => schemaErrors(schema.items, item, `${location}[${index}]`, errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required || []) if (!Object.hasOwn(value, required)) errors.push(`${location}.${required}: required property missing`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) errors.push(`${location}.${key}: additional property`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, key)) schemaErrors(child, value[key], `${location}.${key}`, errors);
  }
  for (const child of schema.allOf || []) schemaErrors(child, value, location, errors);
  if (schema.if) {
    const conditionalErrors = [];
    schemaErrors(schema.if, value, location, conditionalErrors);
    if (conditionalErrors.length === 0 && schema.then) schemaErrors(schema.then, value, location, errors);
    if (conditionalErrors.length > 0 && schema.else) schemaErrors(schema.else, value, location, errors);
  }
  return errors;
}

function stripHtmlComments(value) {
  return String(value).replace(/<!--[\s\S]*?-->/g, "");
}

function stripJavaScriptComments(value) {
  const source = String(value);
  let output = "";
  let quote = "";
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (quote) {
      output += current;
      if (current === "\\") output += source[++index] || "";
      else if (current === quote) quote = "";
      continue;
    }
    if (current === '"' || current === "'" || current === "`") {
      quote = current;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += current;
  }
  return output;
}

function htmlTags(source, tagName) {
  return [...source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map((match) => ({ source: match[0], index: match.index }));
}

function attributeValue(tag, attribute) {
  return tag.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? null;
}

function hasAttribute(tag, attribute) {
  return new RegExp(`(?:\\s|^)${attribute}(?:\\s*=|\\s|/?>)`, "i").test(tag);
}

function pathEndsWith(value, expected) {
  return String(value || "").split(/[?#]/, 1)[0].replaceAll("\\", "/").endsWith(expected);
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

export async function verifyEssentials(appRootInput, manifestInput) {
  const appRoot = path.resolve(appRootInput);
  const manifestPath = inside(appRoot, path.resolve(appRoot, manifestInput), "manifest");
  const manifest = JSON.parse((await requiredFile(manifestPath, "manifest")).toString("utf8"));
  if (typeof manifest.essentialsContract?.vendorDirectory !== "string") fail("vendor directory is required");
  const vendorRoot = inside(appRoot, path.resolve(appRoot, manifest.essentialsContract.vendorDirectory), "vendor directory");
  const lock = JSON.parse((await requiredFile(path.join(vendorRoot, "essentials-lock.json"), "essentials lock")).toString("utf8"));
  if (lock.contract !== ID || lock.version !== VERSION) fail("lock contract/version mismatch");
  if (lock.sharedCommit !== manifest.essentialsContract.sharedCommit) fail("lock/shared commit mismatch");
  if (lock.appKey !== manifest.appKey) fail("lock/app key mismatch");
  for (const artifact of ARTIFACTS) {
    const content = await requiredFile(path.join(vendorRoot, artifact), artifact);
    if (sha256(content) !== lock.artifacts?.[artifact]) fail(`${artifact} checksum mismatch`);
  }
  const manifestSchema = JSON.parse((await requiredFile(path.join(vendorRoot, "essentials-manifest.schema.json"), "manifest schema")).toString("utf8"));
  const manifestErrors = schemaErrors(manifestSchema, manifest);
  if (manifestErrors.length) fail(`manifest schema: ${manifestErrors.join("; ")}`);
  if (manifest.public !== true || manifest.loginRequired !== false) fail("consumer must be a public no-login surface");
  const fixture = manifest.appKey === "reference-app" && /^0+$/.test(manifest.essentialsContract?.sharedCommit || "");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an eligible consumer");
  if (manifest.essentialsContract?.id !== ID || manifest.essentialsContract?.version !== VERSION) fail("contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(manifest.essentialsContract.sharedCommit || "")) fail("full sharedCommit is required");
  if (manifest.environment === "dev" && manifest.productionApproved !== false) fail("DEV requires productionApproved=false");
  if (manifest.environment === "production" && manifest.productionApproved !== true) fail("Production requires explicit approval");
  if (manifest.privacy?.mode !== "no-cookies" && manifest.privacy?.mode !== "essential-only") fail("unsupported privacy mode");
  if (manifest.privacy?.optionalTracking !== false) fail("optional tracking is forbidden");
  validateStoragePurposes(manifest);
  if (!/^https:\/\//.test(manifest.privacy?.privacyUrl || "")) fail("privacy URL must use HTTPS");
  if (manifest.features?.startup !== true) fail("startup is required for public apps");
  if (manifest.features?.share !== true) fail("share is required");
  if (manifest.privacy?.mode === "no-cookies" && manifest.features?.privacyNotice !== false) fail("no-cookies requires privacyNotice=false");
  if (manifest.privacy?.mode === "essential-only" && manifest.features?.privacyNotice !== true) fail("essential-only requires privacyNotice=true");
  const suggestions = manifest.features?.placeSuggestions;
  if (!suggestions || !Number.isInteger(suggestions.minChars) || suggestions.minChars < 2 || suggestions.minChars > 6) fail("place suggestions require minChars between 2 and 6");
  if (!Number.isInteger(suggestions.debounceMs) || suggestions.debounceMs < 200 || suggestions.debounceMs > 1000) fail("place suggestions require debounceMs between 200 and 1000");
  if (suggestions.enabled === true) {
    if (manifest.features?.placeSearch !== true) fail("place suggestions require placeSearch=true");
    if (suggestions.providerCapability !== "consumer-autocomplete-proxy") fail("place suggestions require a consumer autocomplete proxy");
    if (typeof suggestions.evidenceFile !== "string" || !suggestions.evidenceFile.trim()) fail("place suggestions require provider evidence");
    await requiredFile(inside(appRoot, path.resolve(appRoot, suggestions.evidenceFile), "suggestions evidence"), "suggestions evidence");
  } else if (suggestions.enabled !== false || suggestions.providerCapability !== "submit-only" || suggestions.evidenceFile !== null) {
    fail("disabled place suggestions must remain submit-only without provider evidence");
  }

  const entryPath = inside(appRoot, path.resolve(appRoot, manifest.entryHtml), "entry HTML");
  const entry = stripHtmlComments((await requiredFile(entryPath, "entry HTML")).toString("utf8"));
  const vendorWeb = normalizedWebPath(manifest.essentialsContract.vendorDirectory);
  const baseCss = `${vendorWeb}/milos-app-essentials.css`;
  const themeCss = `${vendorWeb}/milos-app-essentials-theme.css`;
  const bootstrap = `${vendorWeb}/bootstrap.js`;
  const stylesheetLinks = htmlTags(entry, "link").filter(({ source }) => (attributeValue(source, "rel") || "").toLowerCase().split(/\s+/).includes("stylesheet"));
  const baseLink = stylesheetLinks.find(({ source }) => pathEndsWith(attributeValue(source, "href"), baseCss));
  const themeLink = stylesheetLinks.find(({ source }) => pathEndsWith(attributeValue(source, "href"), themeCss));
  if (!baseLink || !themeLink) fail("entry HTML must load both local essentials stylesheets as link elements");
  const moduleScripts = htmlTags(entry, "script").filter(({ source }) => (attributeValue(source, "type") || "").toLowerCase() === "module");
  const bootstrapScript = moduleScripts.find(({ source }) => pathEndsWith(attributeValue(source, "src"), bootstrap));
  if (!bootstrapScript) fail("entry HTML must load the local generated bootstrap as a module script");
  const firstModule = moduleScripts[0]?.index ?? -1;
  if (firstModule >= 0 && (baseLink.index > firstModule || themeLink.index > firstModule)) fail("critical stylesheets must load before module scripts");
  if (/https?:[^"']+milos-app-essentials/i.test(entry)) fail("remote essentials runtime is forbidden");
  if (/data:text\/(?:css|javascript)/i.test(entry)) fail("inlined data runtime is forbidden");

  const integrationSources = [];
  for (const relative of manifest.integrationFiles || []) {
    const file = inside(appRoot, path.resolve(appRoot, relative), "integration file");
    const raw = (await requiredFile(file, "integration file")).toString("utf8");
    integrationSources.push(stripJavaScriptComments(stripHtmlComments(raw)));
  }
  const allSources = [stripJavaScriptComments(entry), ...integrationSources].join("\n");
  if (!/<milos-share-button(?:\s|>)/i.test(allSources)) fail("shared share control is required");
  if (manifest.privacy?.mode === "no-cookies") {
    if (!/data-milos-privacy-info/i.test(allSources) || !allSources.includes(manifest.privacy.privacyUrl)) fail("no-cookies requires persistent consumer-owned privacy information");
  }
  if (manifest.features?.datePicker && !/<milos-date-picker(?:\s|>)/i.test(allSources)) fail("enabled date picker is missing");
  if (manifest.features?.placeSearch && !/<milos-place-search(?:\s|>)/i.test(allSources)) fail("enabled place search is missing");
  if (suggestions.enabled) {
    if (!/setSuggestionsProvider\s*\(/.test(allSources)) fail("enabled place suggestions require an app-owned suggestions provider");
  }

  for (const marker of ["data-milos-app-loading", "data-milos-loading-card", "data-milos-loading-icon", "data-milos-loading-title", "data-milos-loading-message", "data-milos-loading-progress"]) {
    if (!new RegExp(`<[a-z][^>]*\\s${marker}(?:\\s*=|\\s|/?>)`, "i").test(entry)) fail(`startup marker is missing: ${marker}`);
  }
  const iconPath = normalizedWebPath(manifest.loading?.iconPath);
  const loadingIcon = htmlTags(entry, "img").map(({ source }) => source).find((source) => hasAttribute(source, "data-milos-loading-icon") && pathEndsWith(attributeValue(source, "src"), iconPath));
  if (!loadingIcon) fail("loading icon must use the app-owned manifest iconPath");
  const width = Number(attributeValue(loadingIcon, "width"));
  const height = Number(attributeValue(loadingIcon, "height"));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 56 || height > 56) fail("loading icon needs explicit width/height no larger than 56");
  if (!/markMilosAppReady\s*\(|(?:CustomEvent|Event)\s*\(\s*["']milosapps:ready["']/i.test(allSources)) fail("app must explicitly signal readiness");

  return Object.freeze({ appKey: manifest.appKey, version: VERSION, vendorRoot, features: Object.freeze({ ...manifest.features }) });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyEssentials(args["app-root"], args.manifest);
  process.stdout.write(`public-app-essentials/v1 verification: PASS (${result.appKey}, ${result.version})\n`);
}
