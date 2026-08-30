"use server";

import type { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getMe } from "@/lib/session";
import { employerProfileSchema, workerProfileSchema } from "@/lib/validation";

const FAILED = "Could not create your profile. Please try again.";

/** Worker: Aadhaar verification -> questions -> profile created -> Discover Jobs. */
export async function createWorkerProfile(input: z.input<typeof workerProfileSchema>) {
  const me = await getMe();
  if (!me) return { ok: false as const, error: "Please sign in again." };
  if (me.profile?.role === "employer") return { ok: true as const, next: "/posted" };

  const parsed = workerProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  // The raw Aadhaar never reaches this action. Signing in with Aadhaar, or
  // verifying it during onboarding, records the hash on the auth user; this
  // just copies it across.
  const aadhaar_id = (user?.user_metadata?.aadhaar_id as string | null) ?? null;

  // Upsert, not insert: the profile may already exist from a signup whose
  // worker row never landed. Re-running onboarding must repair it, not fail.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: me.userId, name: d.name, role: "worker", aadhaar_id }, { onConflict: "id" });

  if (profileError) {
    // profiles.aadhaar_id is unique — one Aadhaar belongs to one account.
    if (profileError.code === "23505") return { ok: false as const, error: "That Aadhaar number is already linked to another account." };
    return { ok: false as const, error: FAILED };
  }

  const { error: workerError } = await admin.from("workers").upsert({
    id: me.userId,
    name: d.name,
    location: d.location,
    contact: d.contact || (user?.user_metadata?.phone as string | null) || null,
    domain: d.domain,
    sub_domain: d.positions[0],
    skills: d.positions.join(", "),
    experience_years: d.experience_years,
    availability: d.availability,
    has_tools: d.has_tools,
    interview_status: "complete",
    // Not 5 by default: an unrated worker must not look like a perfect one.
    rating: null,
  });

  if (workerError) {
    // Leave the profile alone: it may predate this attempt, and /onboarding
    // now routes an incomplete signup back here to try again.
    return { ok: false as const, error: FAILED };
  }

  return { ok: true as const, next: "/jobs" };
}

/** Employer: individual or company -> questions -> profile created. */
export async function createEmployerProfile(input: z.input<typeof employerProfileSchema>) {
  const me = await getMe();
  if (!me) return { ok: false as const, error: "Please sign in again." };
  if (me.profile?.role === "worker") return { ok: true as const, next: "/jobs" };

  const parsed = employerProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: me.userId,
      name: d.name,
      role: "employer",
      aadhaar_id: (user?.user_metadata?.aadhaar_id as string | null) ?? null,
    },
    { onConflict: "id" },
  );
  if (profileError) return { ok: false as const, error: FAILED };

  const { error: employerError } = await admin.from("employers").upsert({
    profile_id: me.userId,
    name: d.name,
    location: d.location,
    type: d.type,
    verified: false,
    rating: null,
  });

  if (employerError) return { ok: false as const, error: FAILED };

  return { ok: true as const, next: "/posted" };
}
