import { redirect } from "next/navigation";
import { EmployerOnboarding } from "@/components/onboarding/employer-onboarding";
import { getMe } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export default async function EmployerOnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.profile?.role === "worker") redirect("/jobs");

  const { data: employer } = await admin
    .from("employers")
    .select("id")
    .eq("profile_id", me.userId)
    .maybeSingle();
  if (employer) redirect("/posted");

  return <EmployerOnboarding knownName={me.profile?.name ?? ""} />;
}
