import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CONFIRMATION_TYPES = new Set<EmailOtpType>(["email", "signup"]);

function isConfirmationType(value: string | null): value is EmailOtpType {
  return value !== null && CONFIRMATION_TYPES.has(value as EmailOtpType);
}

function redirectResponse(request: NextRequest, path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: new URL(path, request.url).toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  if (tokenHash && isConfirmationType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return redirectResponse(request, "/markets");
    }

    console.error("Email confirmation failed", { code: error.code });
  } else if (code) {
    // Supports Supabase's standard PKCE confirmation link as a fallback.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectResponse(request, "/markets");
    }

    console.error("Email confirmation code exchange failed", { code: error.code });
  }

  return redirectResponse(
    request,
    "/auth?error=This%20confirmation%20link%20is%20invalid%20or%20has%20expired.%20Please%20try%20signing%20up%20again.",
  );
}
