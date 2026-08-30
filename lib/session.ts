import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { admin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";
import type { Employer, Profile, Worker } from "./types";

/**
 * RLS is enabled with no policies, so the database cannot authorise anyone.
 * These helpers are the authorisation layer: every server action and page
 * starts here, and every query is then scoped to the id they return.
 */

export const getMe = cache(async () => {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { userId: user.id, profile: profile ?? null };
});

/** Signed in and past onboarding. */
export async function requireProfile() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.profile) redirect("/onboarding");
  return me.profile;
}

export async function requireWorker() {
  const profile = await requireProfile();
  if (profile.role !== "worker") redirect("/posted");

  const { data: worker } = await admin
    .from("workers")
    .select("*")
    .eq("id", profile.id)
    .maybeSingle<Worker>();

  if (!worker) redirect("/onboarding/worker");
  return { profile, worker };
}

export async function requireEmployer() {
  const profile = await requireProfile();
  if (profile.role !== "employer") redirect("/jobs");

  const { data: employer } = await admin
    .from("employers")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle<Employer>();

  if (!employer) redirect("/onboarding/employer");
  return { profile, employer };
}

/**
 * Where a signed-in account belongs right now.
 *
 * A profile alone is not enough: signup writes `profiles` and then the role
 * row, so a failed or cleaned-up second step leaves a profile with no worker /
 * employer row. Routing on the profile alone sends those accounts to a
 * dashboard that bounces them straight back to onboarding, forever. Checking
 * the role row is what breaks that loop.
 */
export async function landingFor(userId: string, profile: Profile | null) {
  if (!profile) return "/onboarding";

  if (profile.role === "employer") {
    const { data } = await admin
      .from("employers")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    return data ? "/posted" : "/onboarding/employer";
  }

  const { data } = await admin.from("workers").select("id").eq("id", userId).maybeSingle();
  return data ? "/jobs" : "/onboarding/worker";
}

/** Same question, for the account currently signed in. */
export async function myLanding() {
  const me = await getMe();
  if (!me) return "/login";
  return landingFor(me.userId, me.profile);
}
