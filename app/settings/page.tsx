import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/auth?next=/settings");

  const [profileResult, walletResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, graduation_year")
      .eq("user_id", authData.user.id)
      .single(),
    supabase.from("wallets").select("balance").eq("user_id", authData.user.id).single(),
  ]);

  if (profileResult.error || walletResult.error) {
    return (
      <main className="sync-state">
        <strong>We couldn’t load your account.</strong>
        <span>Please refresh the page or try again in a moment.</span>
      </main>
    );
  }

  const provider = authData.user.app_metadata.provider;

  return (
    <SettingsClient
      userId={authData.user.id}
      email={authData.user.email ?? ""}
      provider={typeof provider === "string" ? provider : "email"}
      displayName={profileResult.data.display_name}
      graduationYear={profileResult.data.graduation_year}
      balance={Number(walletResult.data.balance)}
    />
  );
}
