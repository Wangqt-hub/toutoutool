import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type SupabaseCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components 中无法设置 cookie 时忽略错误
        }
      }
    }
  });
}

