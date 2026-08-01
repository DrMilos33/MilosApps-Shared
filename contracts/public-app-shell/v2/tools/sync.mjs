import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "2.0.0";
const ID = "public-app-shell/v2";
const CONSUMERS = new Set(["noodle-calculator", "sky", "cloud-post", "somewhere-now", "gravity-loop", "waste-guide", "daylight"]);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const contractRoot = path.resolve(scriptRoot, "..");

function fail(message) {
  throw new Error(`public-app-shell/v2 sync failed: ${message}`);
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
  return createHash("sha256").update(content).digest("hex");
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function validateManifest(manifest, sourceCommit, fixture) {
  if (manifest.public !== true || manifest.loginRequired !== false) fail("only public no-login apps are consumers");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.appKey || "")) fail("invalid appKey");
  if (!fixture && !CONSUMERS.has(manifest.appKey)) fail("appKey is not an approved public-shell consumer");
  if (fixture && manifest.appKey !== "reference-app") fail("fixture mode is restricted to reference-app");
  if (manifest.shellContract?.id !== ID || manifest.shellContract?.version !== VERSION) fail("manifest contract/version mismatch");
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) fail("source commit must be a full lowercase SHA");
  if (!fixture && /^0+$/.test(sourceCommit)) fail("zero source commit is fixture-only");
  if (manifest.shellContract.sharedCommit !== sourceCommit) fail("manifest sharedCommit must equal --source-commit");
  if (!manifest.description?.de?.trim() || !manifest.description?.en?.trim()) fail("description.de/en are required");
  if (!/^\/[a-z0-9][a-z0-9/-]*$/.test(manifest.integration?.portalRoute || "")) fail("valid portalRoute is required");
  if (!manifest.shellContract.vendorDirectory || !manifest.shellContract.entryHtml || !manifest.shellContract.localeModule) {
    fail("vendorDirectory, entryHtml and localeModule are required");
  }
  if (manifest.environment !== "dev" && manifest.environment !== "production") fail("invalid environment");
  if (manifest.environment === "dev" && manifest.productionApproved !== false) fail("DEV requires productionApproved=false");
  if (manifest.environment === "production" && manifest.productionApproved !== true) fail("Production requires explicit approval");
}

function bootstrapSource(manifest) {
  const config = {
    appKey: manifest.appKey,
    environment: manifest.environment,
    productionApproved: manifest.productionApproved,
    description: manifest.description,
    theme: manifest.theme || {}
  };
  return `import { registerMilosAppShell } from "./milos-app-shell.js";\n\nregisterMilosAppShell(${JSON.stringify(config, null, 2)});\n`;
}

export async function syncShell(options) {
  const appRoot = path.resolve(options["app-root"]);
  const manifestPath = path.resolve(appRoot, options.manifest);
  if (!isInside(appRoot, manifestPath)) fail("manifest must stay inside app root");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  validateManifest(manifest, options["source-commit"], options.fixture === true);

  const vendorRoot = path.resolve(appRoot, manifest.shellContract.vendorDirectory);
  if (!isInside(appRoot, vendorRoot)) fail("vendor directory must stay inside app root");
  await mkdir(vendorRoot, { recursive: true });

  const componentSource = await readFile(path.join(contractRoot, "dist", "milos-app-shell.js"));
  const verifierSource = await readFile(path.join(contractRoot, "dist", "verify.mjs"));
  const bootstrap = Buffer.from(bootstrapSource(manifest), "utf8");

  await writeFile(path.join(vendorRoot, "milos-app-shell.js"), componentSource);
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
      "milos-app-shell.js": `sha256:${sha256(componentSource)}`,
      "bootstrap.js": `sha256:${sha256(bootstrap)}`,
      "verify.mjs": `sha256:${sha256(verifierSource)}`
    }
  };
  await writeFile(path.join(vendorRoot, "shell-lock.json"), `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return { appRoot, manifestPath, vendorRoot, lock };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = await syncShell(parseArgs(process.argv.slice(2)));
  process.stdout.write(`public-app-shell/v2 synced: ${result.lock.appKey} -> ${result.vendorRoot}\n`);
}
