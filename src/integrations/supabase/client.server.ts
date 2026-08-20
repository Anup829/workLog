import { createServerClient } from "@supabase/ssr";
import { getCookie, setCookie } from "vinxi/http";

export function getSupabaseServerClient(request: Request) {
  return createServerClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        get(key: string) {
          const cookie = getCookie(request, key);
          return cookie ?? "";
        },
        set(key: string, value: string, options: Record<string, unknown>) {
          setCookie(key, value, options as never);
        },
        remove(key: string, options: Record<string, unknown>) {
          setCookie(key, "", { ...options, maxAge: 0 } as never);
        },
      },
    },
  );
}
