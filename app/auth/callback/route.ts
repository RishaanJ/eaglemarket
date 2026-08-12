import { NextResponse, type NextRequest } from "next/server";
import { LEGAL_POLICY_VERSION } from "@/lib/legal";
import { safeNextPath } from "@/lib/security/next-path";
import { REFERRAL_QUERY_PARAM, safeReferralCode } from "@/lib/security/referral-code";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/school-domain";


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
      // Google sign-in carries no user metadata at account creation, so the
      // referral code is written here, after the exchange. The auth.users
      // UPDATE trigger picks it up and creates the pending referral row.
      const referralCode = safeReferralCode(
        request.nextUrl.searchParams.get(REFERRAL_QUERY_PARAM),
      );

      if (data.user && referralCode) {
        const { error: referralError } = await supabase.auth.updateUser({
          data: { referral_code: referralCode },
        });

        // A referral is a bonus, never a reason to fail sign-in.
        if (referralError) {
          console.warn("Referral code not recorded", { code: referralError.code });
        }
      }

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

    // A Google account outside the school domain is refused by the database
    // trigger, which surfaces here as a generic exchange failure. Say what
    // actually happened instead of "please try again", which would send
    // someone into a loop that cannot succeed.
    if (/school email|fusdk12/i.test(error.message ?? "")) {
      return redirectResponse(
        `/auth?error=${encodeURIComponent(
          `Use your @${SCHOOL_EMAIL_DOMAIN} school account. Other Google accounts can't be used to sign in.`,
        )}`,
      );
    }

    return redirectResponse("/auth?error=We%20couldn%27t%20complete%20sign%20in.%20Please%20try%20again.");
  }

  return redirectResponse("/auth?error=Google%20did%20not%20return%20an%20authorization%20code.%20Please%20try%20again.");
}
