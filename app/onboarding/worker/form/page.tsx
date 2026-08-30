import { redirect } from "next/navigation";
import { WorkerOnboarding } from "@/components/onboarding/worker-onboarding";
import { getMe } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/** The typed alternative to talking to Setu. Same destination, same columns. */
export default async function WorkerFormOnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.profile?.role === "employer") redirect("/posted");

  const { data: worker } = await admin
    .from("workers")
    .select("id")
    .eq("id", me.userId)
    .maybeSingle();
  if (worker) redirect("/jobs");

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  return (
    <WorkerOnboarding
      aadhaarAlreadyVerified={!!user?.user_metadata?.aadhaar_id}
      phone={(user?.user_metadata?.phone as string | null) ?? ""}
      knownName={me.profile?.name ?? ""}
    />
  );
}
