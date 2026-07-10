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
      '009_create_rls_and_grants.sql',
      '010_harden_functions_and_indexes.sql',
      '011_revoke_public_helper_execution.sql',
      '012_add_billing_fields.sql',
      '013_create_api_sessions.sql'
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

  it('hardens database functions with explicit search paths', async () => {
    const hardeningMigration = await readFile(
      path.join(migrationsPath, '010_harden_functions_and_indexes.sql'),
      'utf8'
    );

    expect(hardeningMigration).toContain(
      'alter function public.set_updated_at()'
    );
    expect(hardeningMigration).toContain(
      'alter function public.exercise_search_document(text, text, text[])'
    );
    expect(hardeningMigration).toContain(
      'set search_path = pg_catalog, public'
    );
  });
});
