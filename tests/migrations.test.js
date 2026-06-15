import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');

describe('Supabase migrations', () => {
  it('keeps Phase 1 migration files in the expected order', async () => {
    const files = await readdir(migrationsPath);

    expect(files).toEqual([
      '001_enable_extensions.sql',
      '002_create_enums.sql',
      '003_create_reference_tables.sql',
      '004_create_exercises.sql',
      '005_create_exercise_relations.sql',
      '006_create_media_and_sync.sql',
      '007_create_api_users_keys_usage.sql',
      '008_create_indexes_and_triggers.sql',
      '009_create_rls_and_grants.sql'
    ]);
  });

  it('keeps public catalog access server-owned for Version 1', async () => {
    const rlsMigration = await readFile(
      path.join(migrationsPath, '009_create_rls_and_grants.sql'),
      'utf8'
    );

    expect(rlsMigration).toContain('to service_role');
    expect(rlsMigration).toContain('enable row level security');
    expect(rlsMigration).not.toContain('to anon');
    expect(rlsMigration).not.toContain('to authenticated');
  });
});
