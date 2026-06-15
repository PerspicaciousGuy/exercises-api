import { describe, expect, it } from 'vitest';

import { parseSupabaseScriptEnv } from '../src/config/supabaseEnv.js';

describe('parseSupabaseScriptEnv', () => {
  it('requires hosted Supabase script credentials', () => {
    expect(() => parseSupabaseScriptEnv({})).toThrow(
      /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/
    );
  });

  it('parses hosted Supabase script credentials', () => {
    const env = parseSupabaseScriptEnv({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    });

    expect(env).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key'
    });
  });
});
