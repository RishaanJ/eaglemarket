import { NextResponse, type NextRequest } from "next/server";
import { LEGAL_POLICY_VERSION } from "@/lib/legal";
import { safeNextPath } from "@/lib/security/next-path";
import { createClient } from "@/lib/supabase/server";


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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const legalVersion = request.nextUrl.searchParams.get("legal");

      if (data.user && legalVersion === LEGAL_POLICY_VERSION) {
        const acceptedAt = new Date().toISOString();
        const { error: consentError } = await supabase.auth.updateUser({
          data: {
            terms_accepted_at: acceptedAt,
            privacy_accepted_at: acceptedAt,
            age_13_confirmed_at: acceptedAt,
            legal_policy_version: LEGAL_POLICY_VERSION,
          },
        });

        if (consentError) {
          console.error("OAuth consent recording failed", { code: consentError.code });
          return redirectResponse("/auth?error=We%20couldn%27t%20record%20your%20account%20agreements.%20Please%20try%20again.");
        }
      }

      return redirectResponse(next);
    }

    console.error("OAuth code exchange failed", { code: error.code });
    return redirectResponse("/auth?error=We%20couldn%27t%20complete%20sign%20in.%20Please%20try%20again.");
  }

  return redirectResponse("/auth?error=Google%20did%20not%20return%20an%20authorization%20code.%20Please%20try%20again.");
}
