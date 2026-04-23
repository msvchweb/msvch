import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasStaffAccess } from "@/lib/admin-auth";

function loginRedirect(request: NextRequest) {
  const url = new URL("/login", request.url);
  const current = request.nextUrl.pathname + request.nextUrl.search;
  url.searchParams.set("next", current);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protect member-only pages
  if (path.startsWith("/groups") && !user) {
    return loginRedirect(request);
  }

  if (path.startsWith("/profile") && !user) {
    return loginRedirect(request);
  }

  // Protect admin pages
  if (path.startsWith("/admin")) {
    if (!user) {
      return loginRedirect(request);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile as { role?: string } | null)?.role;
    if (!hasStaffAccess(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/groups/:path*", "/admin/:path*", "/profile/:path*"],
};
