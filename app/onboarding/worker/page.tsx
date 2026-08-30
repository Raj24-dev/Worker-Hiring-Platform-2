import { redirect } from "next/navigation";
import { VoiceOnboarding } from "@/components/setu/voice-onboarding";
import { profileFromWorker } from "@/lib/setu/core";
import { getMe } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { Worker } from "@/lib/types";

/**
 * Voice is the default way in. Most workers here cannot fill a form comfortably,
 * so Setu asks and they answer; the typed form stays one tap away at /form.
 */
export default async function WorkerOnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.profile?.role === "employer") redirect("/posted");

  const { data: worker } = await admin
    .from("workers")
    .select("*")
    .eq("id", me.userId)
    .maybeSingle<Worker>();

  // Setu saves every turn, so a dropped call leaves a half-filled row. Only a
  // finished profile is sent away — the rest carry on where they left off.
  if (worker?.interview_status === "complete") redirect("/jobs");

  return (
    <VoiceOnboarding
      knownName={me.profile?.name ?? ""}
      initialProfile={worker ? profileFromWorker(worker) : {}}
    />
  );
}
