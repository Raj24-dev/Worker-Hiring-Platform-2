import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Session-bound client. Used only to read/write the auth cookie. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          // Throws when called from a Server Component render; the middleware
          // refresh path handles those, so swallowing here is correct.
          try {
            for (const { name, value, options } of list) store.set(name, value, options);
          } catch {}
        },
      },
    },
  );
}
