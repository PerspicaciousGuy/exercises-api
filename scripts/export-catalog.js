import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from 'dotenv';

import { createDefaultReferenceRepository } from '../src/repositories/referenceRepository.js';
import { createDefaultSyncRepository } from '../src/repositories/syncRepository.js';
import { buildCatalogExport } from '../src/services/catalogExportService.js';

// Writes the starting catalog a mobile app bundles. Usage:
//   npm run export:catalog -- [--out path/to/catalog.json]
config();

const outIndex = process.argv.indexOf('--out');
const outPath =
  outIndex === -1
    ? 'exports/exercise-catalog.json'
    : process.argv[outIndex + 1];

const catalog = await buildCatalogExport({
  syncRepository: createDefaultSyncRepository(),
  referenceRepository: createDefaultReferenceRepository()
});

await mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
await writeFile(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

console.info(
  `Exported ${catalog.exercises.length} exercises (catalog version ` +
    `${catalog.catalogVersion}, latestChangeAt ${catalog.latestChangeAt}) to ${outPath}`
);
