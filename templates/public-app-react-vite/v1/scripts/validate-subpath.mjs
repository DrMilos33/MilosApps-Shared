import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const expectedBase = '/template-subpath/';
const assetReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);

if (assetReferences.length === 0) throw new Error('Subpath validation found no built assets.');
for (const reference of assetReferences) {
  if (reference.startsWith('data:') || reference.startsWith('#')) continue;
  if (!reference.startsWith(expectedBase)) {
    throw new Error(`Subpath validation failed for ${reference}.`);
  }
}

console.log(`React template subpath validation: PASS (${assetReferences.length} references)`);
