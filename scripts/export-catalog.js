import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { config } from 'dotenv';

import { createDefaultReferenceRepository } from '../src/repositories/referenceRepository.js';
import { createDefaultSyncRepository } from '../src/repositories/syncRepository.js';
import {
  buildCatalogExport,
  serializeCatalogExport
} from '../src/services/catalogExportService.js';

// Writes the starting catalog a mobile app bundles. Usage:
//   npm run export:catalog -- [--out path/to/catalog.json] [--exported-at <iso>]
// Without --exported-at, an existing file whose data is unchanged keeps its
// exportedAt, so the rewrite is byte-identical.
config();

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const outPath = argument('--out') ?? 'exports/exercise-catalog.json';
const exportedAt = argument('--exported-at');

if (exportedAt !== undefined && Number.isNaN(Date.parse(exportedAt))) {
  throw new Error(
    `--exported-at must be an ISO 8601 timestamp, got "${exportedAt}"`
  );
}

const catalog = await buildCatalogExport({
  syncRepository: createDefaultSyncRepository(),
  referenceRepository: createDefaultReferenceRepository(),
  ...(exportedAt ? { now: () => new Date(exportedAt) } : {})
});
const previousText = exportedAt
  ? undefined
  : await readFile(outPath, 'utf8').catch(() => undefined);
const output = serializeCatalogExport(catalog, previousText);

await mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
await writeFile(outPath, output, 'utf8');

console.info(
  `${output === previousText ? 'Unchanged' : 'Exported'} ` +
    `${catalog.exercises.length} exercises (catalog version ` +
    `${catalog.catalogVersion}, latestChangeAt ${catalog.latestChangeAt}) to ${outPath}`
);
