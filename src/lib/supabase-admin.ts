import { createClient } from "@supabase/supabase-js";

// Este cliente usa el service_role key - SOLO usar en rutas de servidor
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
