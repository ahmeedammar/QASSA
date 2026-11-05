import { createServerClient } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";

export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and this call.
  // This refreshes the session cookie — proxy-level only; authorization
  // decisions are always made server-side in data access functions.
  try {
    await supabase.auth.getUser();
  } catch {
    // Supabase unreachable: continue unauthenticated rather than blocking
    // the entire site (graceful degradation).
  }

  return response;
}
