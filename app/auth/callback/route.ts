import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const AUTH_DESTINATIONS = new Set(["/markets", "/picks", "/rankings", "/settings", "/admin"]);

function safeNextPath(value: string | null) {
  if (!value || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return "/markets";

  try {
    const base = new URL("https://eaglemarket.invalid");
    const destination = new URL(value, base);
    return destination.origin === base.origin && AUTH_DESTINATIONS.has(destination.pathname)
      ? destination.pathname
      : "/markets";
  } catch {
    return "/markets";
  }
}

function redirectResponse(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: path,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const providerError = request.nextUrl.searchParams.get("error_description");

  if (providerError) {
    const providerCode = request.nextUrl.searchParams.get("error")?.slice(0, 40) ?? "provider_error";
    console.warn("OAuth provider rejected sign in", { providerCode });
    return redirectResponse("/auth?error=We%20couldn%27t%20complete%20sign%20in.%20Please%20try%20again.");
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectResponse(next);
    }

    console.error("OAuth code exchange failed", { code: error.code });
    return redirectResponse("/auth?error=We%20couldn%27t%20complete%20sign%20in.%20Please%20try%20again.");
  }

  return redirectResponse("/auth?error=Google%20did%20not%20return%20an%20authorization%20code.%20Please%20try%20again.");
}
