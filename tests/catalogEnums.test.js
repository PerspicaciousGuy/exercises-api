import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CATALOG_ENUM_VALUES,
  CATEGORY_TYPES,
  EXERCISE_STATUSES,
  MEDIA_STATUSES
} from '../src/constants/catalogEnums.js';
import { createSyncService } from '../src/services/syncService.js';

const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');

// Postgres enum type -> the constant that must list exactly its values.
const ENUM_TYPES = {
  difficulty_level: CATALOG_ENUM_VALUES.difficulties,
  movement_pattern: CATALOG_ENUM_VALUES.movementPatterns,
  force_type: CATALOG_ENUM_VALUES.forceTypes,
  mechanics_type: CATALOG_ENUM_VALUES.mechanics,
  position_type: CATALOG_ENUM_VALUES.positions,
  plane_of_motion_type: CATALOG_ENUM_VALUES.planesOfMotion,
  laterality_type: CATALOG_ENUM_VALUES.lateralities,
  load_type: CATALOG_ENUM_VALUES.loadTypes,
  skill_type: CATALOG_ENUM_VALUES.skillTypes,
  media_type: CATALOG_ENUM_VALUES.mediaTypes,
  exercise_status: EXERCISE_STATUSES,
  exercise_category: CATEGORY_TYPES,
  media_status: MEDIA_STATUSES
};

async function readDatabaseEnums() {
  const files = (await readdir(migrationsPath)).sort();
  const sql = (
    await Promise.all(
      files.map((file) => readFile(path.join(migrationsPath, file), 'utf8'))
    )
  ).join('\n');
  const enums = {};

  for (const [, name, values] of sql.matchAll(
    /create type public\.(\w+) as enum \(([^)]*)\)/g
  )) {
    enums[name] = [...values.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  }
  for (const [, name, value] of sql.matchAll(
    /alter type public\.(\w+) add value (?:if not exists )?'([^']+)'/g
  )) {
    enums[name].push(value);
  }

  return enums;
}

describe('catalog enum constants', () => {
  it('match the Postgres enum types in the migrations', async () => {
    const databaseEnums = await readDatabaseEnums();

    for (const [typeName, values] of Object.entries(ENUM_TYPES)) {
      expect({ [typeName]: [...values].sort() }).toEqual({
        [typeName]: [...databaseEnums[typeName]].sort()
      });
    }
  });

  it('publishes core in the /sync/metadata movement patterns', async () => {
    const service = createSyncService({
      syncRepository: { getSyncMetadata: async () => ({}) }
    });

    const metadata = await service.getSyncMetadata();

    expect(metadata.enums.movementPatterns).toContain('core');
  });
});
