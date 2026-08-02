import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "public-app-layout/v1";
const VERSION = "1.1.0";
const CONSUMERS = new Set([
  "noodle-calculator",
  "sky",
  "cloud-post",
  "somewhere-now",
  "gravity-loop",
  "waste-guide",
  "daylight"
]);

function fail(message) {
  throw new Error(`public-app-layout/v1 verification failed: ${message}`);
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

export async function verifyLayout(appRootInput, manifestInput) {
  const appRoot = path.resolve(appRootInput);
  const manifestPath = inside(appRoot, path.resolve(appRoot, manifestInput), "manifest");
  const manifest = JSON.parse((await requiredFile(manifestPath, "manifest")).toString("utf8"));
  const fixture = manifest.appKey === "reference-app" && /^0+$/.test(manifest.layoutContract?.sharedCommit || "");

  if (manifest.public !== true || manifest.loginRequired !== false) fail("consumer must be public and no-login");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an eligible layout consumer");
  if (manifest.layoutContract?.id !== ID || manifest.layoutContract?.version !== VERSION) fail("contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(manifest.layoutContract.sharedCommit || "")) fail("full sharedCommit is required");
  if (!["focused-task", "guided-flow", "immersive"].includes(manifest.profile)) fail("unknown layout profile");
  if (manifest.productionApproved !== false) fail("v1 pilot is DEV-only");

  const vendorRoot = inside(appRoot, path.resolve(appRoot, manifest.layoutContract.vendorDirectory), "vendor directory");
  const lock = JSON.parse((await requiredFile(path.join(vendorRoot, "layout-lock.json"), "layout lock")).toString("utf8"));
  if (lock.contract !== ID || lock.version !== VERSION) fail("lock contract/version mismatch");
  if (lock.sharedCommit !== manifest.layoutContract.sharedCommit) fail("lock/shared commit mismatch");
  if (lock.appKey !== manifest.appKey || lock.profile !== manifest.profile) fail("lock consumer/profile mismatch");

  for (const artifact of ["milos-app-layout.css", "milos-app-layout-theme.css", "verify-layout.mjs"]) {
    const content = await requiredFile(path.join(vendorRoot, artifact), artifact);
    if (sha256(content) !== lock.artifacts?.[artifact]) fail(`${artifact} checksum mismatch`);
  }

  const markupSources = [];
  for (const source of manifest.sources?.markup || []) {
    const sourcePath = inside(appRoot, path.resolve(appRoot, source), `markup source ${source}`);
    markupSources.push((await requiredFile(sourcePath, `markup source ${source}`)).toString("utf8"));
  }
  const styleSources = [];
  for (const source of manifest.sources?.styles || []) {
    const sourcePath = inside(appRoot, path.resolve(appRoot, source), `style source ${source}`);
    styleSources.push((await requiredFile(sourcePath, `style source ${source}`)).toString("utf8"));
  }
  const markup = markupSources.join("\n");
  const delivery = `${markup}\n${styleSources.join("\n")}`;

  if (!markup.includes("data-milos-layout") || !markup.includes("compact")) fail("compact layout marker is required");
  if (!markup.includes("data-milos-intro")) fail("intro marker is required");
  if (!markup.includes("data-milos-primary-work")) fail("primary work marker is required");
  if (!markup.includes(`data-milos-profile`) || !markup.includes(manifest.profile)) fail("manifest profile must appear in markup");
  if (!markup.includes("data-milos-app-key") || !markup.includes(manifest.appKey)) fail("app key marker is required");
  if (markup.includes("data-milos-settings")) {
    for (const marker of ["data-milos-settings-intro", "data-milos-settings-controls", "data-milos-settings-control"]) {
      if (!markup.includes(marker)) fail(`compact settings require ${marker}`);
    }
  }
  if (markup.includes("data-milos-flow-columns")) fail("paired flow must use the explicit data-milos-flow=paired contract");
  if (!delivery.includes("milos-app-layout.css") || !delivery.includes("milos-app-layout-theme.css")) fail("both local layout stylesheets must be referenced");
  if (/https?:[^"')]+milos-app-layout/i.test(delivery)) fail("remote layout runtime is forbidden");

  return {
    appKey: manifest.appKey,
    profile: manifest.profile,
    sharedCommit: manifest.layoutContract.sharedCommit,
    vendorRoot
  };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await verifyLayout(args["app-root"], args.manifest);
  process.stdout.write(`public-app-layout/v1 verification: PASS (${result.appKey}, ${result.profile})\n`);
}
