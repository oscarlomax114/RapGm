import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === "your-supabase-url-here") {
    // Return a stub that no-ops — allows the app to run without Supabase configured
    return new Proxy({} as SupabaseClient, {
      get(_, prop) {
        if (prop === "auth") {
          return {
            getUser: async () => ({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithPassword: async () => ({ error: { message: "Supabase not configured" } }),
            signUp: async () => ({ error: { message: "Supabase not configured" } }),
            signOut: async () => {},
          };
        }
        if (prop === "from") {
          return () => ({
            select: () => ({ order: () => ({ data: [], error: null }), single: () => ({ data: null, error: { message: "Not configured" } }), eq: () => ({ single: () => ({ data: null, error: null }), data: [], error: null }) }),
            upsert: async () => ({ error: null }),
            insert: async () => ({ error: null }),
            delete: () => ({ eq: () => ({ error: null }) }),
          });
        }
        return undefined;
      },
    });
  }

  client = createBrowserClient(url, key);
  return client;
}
