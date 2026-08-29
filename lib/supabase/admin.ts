import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it must never be imported into a
 * client component. Every table in this project has RLS enabled with no
 * policies, which means this is the only way in — authorisation is therefore
 * enforced in server code (see lib/session.ts), not by the database.
 */
export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
