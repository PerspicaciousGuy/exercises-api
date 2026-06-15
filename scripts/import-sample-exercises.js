import { config } from 'dotenv';

import { parseSupabaseScriptEnv } from '../src/config/supabaseEnv.js';
import { loadCatalogFixtures } from '../src/import/catalogFixtureFiles.js';
import { importCatalogFixtures } from '../src/import/catalogSeeder.js';
import { SupabaseRestClient } from '../src/supabase/restClient.js';

config();

const env = parseSupabaseScriptEnv(process.env);
const client = new SupabaseRestClient(env);
const fixtures = await loadCatalogFixtures();
const plan = await importCatalogFixtures({ client, fixtures });

console.info(
  `Imported ${plan.exercises.length} sample exercises, ` +
    `${plan.aliases.length} aliases, ` +
    `${plan.primaryMuscles.length + plan.secondaryMuscles.length + plan.stabilizerMuscles.length} muscle links, ` +
    `${plan.equipment.length} equipment links, and ` +
    `${plan.changeEvents.length} sync change events.`
);
