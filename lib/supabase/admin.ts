import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES RLS — import only in server code, and only
 * after the caller has been authorised (requireAdmin / webhook signature / own-row checks).
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
