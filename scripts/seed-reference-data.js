import { config } from 'dotenv';

import { parseSupabaseScriptEnv } from '../src/config/supabaseEnv.js';
import { loadReferenceFixtures } from '../src/import/catalogFixtureFiles.js';
import { seedReferenceData } from '../src/import/catalogSeeder.js';
import { SupabaseRestClient } from '../src/supabase/restClient.js';

config();

const env = parseSupabaseScriptEnv(process.env);
const client = new SupabaseRestClient(env);
const references = await loadReferenceFixtures();
const lookups = await seedReferenceData({ client, references });

console.info(
  `Seeded reference data: ${lookups.muscleIdsBySlug.size} muscles, ` +
    `${lookups.equipmentIdsBySlug.size} equipment records, ` +
    `${lookups.categoryIdsBySlug.size} categories, ` +
    `${lookups.exerciseFlagIdsBySlug.size} exercise flags, and ` +
    `${lookups.jointRegionIdsBySlug.size} joint regions.`
);
