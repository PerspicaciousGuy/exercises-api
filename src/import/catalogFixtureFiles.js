import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseCatalogFixtures,
  parseReferenceFixtures
} from '../validation/catalogFixtures.js';

const EXERCISES_DIR = 'data/exercises';

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
  const exercises = await loadExerciseFixtures(rootDir);

  return parseCatalogFixtures({ references, exercises });
}

/**
 * Reads every `*.json` file under `data/exercises` and concatenates them into a
 * single array. The catalog is drafted one movement pattern at a time, so it
 * lives across per-pattern files rather than one growing blob no reviewer can
 * read. Files are read in sorted order for a deterministic seed; slug
 * uniqueness across all files is enforced downstream by the validator.
 */
async function loadExerciseFixtures(rootDir) {
  const dir = path.join(rootDir, EXERCISES_DIR);
  const entries = await readdir(dir);
  const jsonFiles = entries
    .filter((entry) => entry.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const exercises = [];

  for (const fileName of jsonFiles) {
    const records = await readJsonFile(rootDir, path.join(EXERCISES_DIR, fileName));

    exercises.push(...records);
  }

  return exercises;
}

async function readJsonFile(rootDir, relativePath) {
  const raw = await readFile(path.join(rootDir, relativePath), 'utf8');

  return JSON.parse(raw);
}
