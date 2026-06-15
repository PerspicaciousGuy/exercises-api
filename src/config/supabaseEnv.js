import { z } from 'zod';

const supabaseScriptEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
});

export function parseSupabaseScriptEnv(source) {
  const parsed = supabaseScriptEnvSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for seed/import scripts: ${parsed.error.message}`
    );
  }

  return {
    supabaseUrl: parsed.data.SUPABASE_URL,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY
  };
}
