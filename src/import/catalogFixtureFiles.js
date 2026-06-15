import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseCatalogFixtures,
  parseReferenceFixtures
} from '../validation/catalogFixtures.js';

export async function loadReferenceFixtures(rootDir = process.cwd()) {
  return parseReferenceFixtures({
    muscles: await readJsonFile(rootDir, 'data/reference/muscles.json'),
    equipment: await readJsonFile(rootDir, 'data/reference/equipment.json'),
    categories: await readJsonFile(rootDir, 'data/reference/categories.json'),
    exerciseFlags: await readJsonFile(
      rootDir,
      'data/reference/exercise-flags.json'
    ),
    jointRegions: await readJsonFile(
      rootDir,
      'data/reference/joint-regions.json'
    )
  });
}

export async function loadCatalogFixtures(rootDir = process.cwd()) {
  const references = await loadReferenceFixtures(rootDir);
  const exercises = await readJsonFile(
    rootDir,
    'data/exercises/sample-exercises.json'
  );

  return parseCatalogFixtures({ references, exercises });
}

async function readJsonFile(rootDir, relativePath) {
  const raw = await readFile(path.join(rootDir, relativePath), 'utf8');

  return JSON.parse(raw);
}
