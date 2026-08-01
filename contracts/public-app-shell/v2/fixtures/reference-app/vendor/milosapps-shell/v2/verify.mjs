import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "public-app-shell/v2";
const VERSION = "2.0.2";
const CONSUMERS = new Set(["noodle-calculator", "sky", "cloud-post", "somewhere-now", "gravity-loop", "waste-guide", "daylight"]);

function fail(message) {
  throw new Error(`public-app-shell/v2 verification failed: ${message}`);
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

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
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

export async function verifyApp(appRootInput, manifestInput) {
  const appRoot = path.resolve(appRootInput);
  const manifestPath = inside(appRoot, path.resolve(appRoot, manifestInput), "manifest");
  const manifest = JSON.parse((await requiredFile(manifestPath, "manifest")).toString("utf8"));

  if (manifest.public !== true || manifest.loginRequired !== false) fail("consumer must be public and no-login");
  const fixture = manifest.appKey === "reference-app" && /^0+$/.test(manifest.shellContract?.sharedCommit || "");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an approved public-shell consumer");
  if (manifest.shellContract?.id !== ID || manifest.shellContract?.version !== VERSION) fail("contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(manifest.shellContract.sharedCommit || "")) fail("full sharedCommit is required");
  if (!manifest.description?.de?.trim() || !manifest.description?.en?.trim()) fail("description.de/en are required");
  if (!/^\/[a-z0-9][a-z0-9/-]*$/.test(manifest.integration?.portalRoute || "")) fail("valid portalRoute is required");
  if (manifest.environment === "dev" && manifest.productionApproved !== false) fail("DEV must keep Production false");
  if (manifest.environment === "production" && manifest.productionApproved !== true) fail("Production requires explicit approval");
  const hasPublishedDev = /^https:\/\//.test(manifest.dev?.url || "") && /^https:\/\//.test(manifest.dev?.healthUrl || "");
  const hasBlockedDev = manifest.dev?.url === null && manifest.dev?.healthUrl === null;
  if (!hasPublishedDev && !hasBlockedDev) fail("dev.url and dev.healthUrl must both be HTTPS or both be null");

  const vendorRoot = inside(appRoot, path.resolve(appRoot, manifest.shellContract.vendorDirectory), "vendor directory");
  const lockPath = path.join(vendorRoot, "shell-lock.json");
  const lock = JSON.parse((await requiredFile(lockPath, "shell lock")).toString("utf8"));
  if (lock.contract !== ID || lock.version !== VERSION) fail("lock contract/version mismatch");
  if (lock.sharedCommit !== manifest.shellContract.sharedCommit) fail("lock/shared commit mismatch");
  if (lock.appKey !== manifest.appKey) fail("lock/app key mismatch");

  for (const artifact of ["milos-app-shell.js", "bootstrap.js", "verify.mjs"]) {
    const content = await requiredFile(path.join(vendorRoot, artifact), artifact);
    if (sha256(content) !== lock.artifacts?.[artifact]) fail(`${artifact} checksum mismatch`);
  }

  const entryPath = inside(appRoot, path.resolve(appRoot, manifest.shellContract.entryHtml), "entry HTML");
  const entry = (await requiredFile(entryPath, "entry HTML")).toString("utf8");
  const localePath = inside(appRoot, path.resolve(appRoot, manifest.shellContract.localeModule), "locale module");
  const localeModule = (await requiredFile(localePath, "locale module")).toString("utf8");
  const vendorWeb = manifest.shellContract.vendorDirectory.replaceAll("\\", "/").replace(/^\.\//, "");

  if (!entry.includes(`${vendorWeb}/bootstrap.js`)) fail("entry HTML must load the local generated bootstrap");
  if (/https?:[^"']+milos-app-shell/i.test(entry)) fail("remote shell runtime is forbidden");
  if ((entry.match(/<milos-app-shell(?:\s|>)/g) || []).length !== 1) fail("entry HTML must contain exactly one milos-app-shell");
  if (!/<svg[^>]*slot=["']app-icon["']/i.test(entry)) fail("app-owned inline SVG icon slot is required");
  if (!/<main[^>]*slot=["']main["']/i.test(entry)) fail("semantic main slot is required");
  if ((entry.match(/<h1(?:\s|>)/gi) || []).length !== 1) fail("entry HTML must contain exactly one H1");
  if (!localeModule.includes("milosapps:localechange")) fail("app locale module must consume the shell locale event");
  if (!/\bde\b/.test(localeModule) || !/\ben\b/.test(localeModule)) fail("app locale module must define DE and EN");
  if (!localeModule.includes("document.documentElement.lang")) fail("app locale module must apply the initial document locale");

  return {
    appKey: manifest.appKey,
    environment: manifest.environment,
    devPublished: hasPublishedDev,
    sharedCommit: manifest.shellContract.sharedCommit,
    vendorRoot
  };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyApp(args["app-root"], args.manifest);
  process.stdout.write(`public-app-shell/v2 verification: PASS (${result.appKey}, ${result.environment})\n`);
}
