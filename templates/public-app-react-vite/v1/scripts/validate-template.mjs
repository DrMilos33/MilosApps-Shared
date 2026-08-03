import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const [metadataText, schemaText, packageText, html, bridge, elementTypes, viteConfig, recipe] = await Promise.all([
  read('template.json'),
  read('template.schema.json'),
  read('package.json'),
  read('index.html'),
  read('src/milosapps-bridge.ts'),
  read('src/milosapps-elements.d.ts'),
  read('vite.config.ts'),
  read('recipes/react-aria/README.md'),
]);

const metadata = JSON.parse(metadataText);
const schema = JSON.parse(schemaText);
const packageJson = JSON.parse(packageText);
let assertions = 0;
const assert = (condition, message) => {
  assertions += 1;
  if (!condition) throw new Error(`React template validation failed: ${message}`);
};

assert(metadata.id === 'public-app-react-vite-template/v1', 'template id');
assert(metadata.version === packageJson.version, 'metadata and package version match');
assert(metadata.lifecycle === 'scaffold-only', 'template is not a runtime contract');
assert(schema.properties.version.const === metadata.version, 'schema fixes template version');
assert(packageJson.packageManager === 'pnpm@11.9.0', 'package manager pin');
assert(packageJson.dependencies.react === '19.2.8', 'React pin');
assert(packageJson.dependencies['react-dom'] === '19.2.8', 'React DOM pin');
assert(packageJson.devDependencies.vite === '8.1.5', 'Vite pin');
assert(packageJson.devDependencies.typescript === '7.0.2', 'TypeScript pin');
assert(!packageJson.dependencies['react-aria-components'], 'React Aria remains opt-in');
assert(html.indexOf('<milos-app-shell>') < html.indexOf('data-milos-react-root'), 'Shell owns React host');
assert(html.indexOf('data-milos-app-loading') < html.indexOf('data-milos-react-root'), 'loader is outside React host');
assert(html.includes('width="32" height="32"'), 'loader intrinsic size');
assert(html.includes('slot="app-icon" width="38" height="38"'), 'shell icon intrinsic size');
assert(bridge.includes("milosapps:localechange"), 'locale event bridge');
assert(bridge.includes('milosAppEssentials.ready()'), 'ready lifecycle bridge');
assert(elementTypes.includes("'milos-share-button'"), 'typed Shared custom-element boundary');
assert(viteConfig.includes("script-src 'self'"), 'strict script CSP');
assert(viteConfig.includes("style-src 'self'"), 'strict style CSP');
assert(!/https?:\/\//.test(html + bridge + viteConfig), 'no runtime CDN or external import');
assert(recipe.includes('react-aria-components@1.20.0'), 'React Aria recipe pin');
assert(recipe.includes('style-src'), 'React Aria recipe documents CSP boundary');

console.log(`React template validation: PASS (${assertions} assertions)`);
