import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // "server-only" throws outside a React Server Component bundle; under
      // test these modules genuinely are server-side, so stub the guard out.
      "server-only": path.resolve(import.meta.dirname, "test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    env: {
      AUTH_SECRET: "test-secret-only-used-by-vitest",
      // Enough for the Supabase client to construct; no test makes a request.
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SECRET_KEY: "not-a-real-key-for-tests",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "not-a-real-key-for-tests",
    },
  },
});
