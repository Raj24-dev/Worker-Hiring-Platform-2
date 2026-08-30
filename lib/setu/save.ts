import "server-only";
import { admin } from "@/lib/supabase/admin";
import { writeRemarks } from "./ai";
import {
  computeTrustScore,
  domainForPosition,
  isComplete,
  normaliseTools,
  skillChips,
  type SetuLanguage,
  type SetuProfile,
  type SetuTurnLog,
} from "./core";

/**
 * Writes what Setu heard into the signed-in worker's own row.
 *
 * The original Setu minted a throwaway auth user per conversation, which is
 * where the stray candidate_*@setu.local accounts came from. Here the worker is
 * already signed in, so the conversation updates their row and nothing else.
 */

export async function saveSetuProfile({
  userId,
  phone,
  profile,
  language,
  turns,
}: {
  userId: string;
  phone: string | null;
  profile: SetuProfile;
  language: SetuLanguage;
  turns: SetuTurnLog[];
}) {
  const match = domainForPosition(profile.position);
  const complete = isComplete(profile);
  const trust = computeTrustScore(profile);
  const trade = match?.position ?? profile.position ?? "Skilled worker";

  // Remarks read as the worker's own words, so they only make sense once
  // there is enough to say. Writing them costs a model call, so gate on it.
  const remarks = complete ? await writeRemarks(profile, trade) : null;

  const name = profile.name?.trim() || null;

  if (name) {
    await admin
      .from("profiles")
      .upsert({ id: userId, name, role: "worker" }, { onConflict: "id" });
  }

  const { error } = await admin.from("workers").upsert(
    {
      id: userId,
      session_id: `setu_${userId}`,
      name,
      contact: phone,
      domain: match?.domain ?? null,
      sub_domain: match?.position ?? profile.position ?? null,
      skills: skillChips(match?.position ?? null, profile.skills),
      experience_years: profile.experience_years ?? null,
      has_tools: normaliseTools(profile.has_tools),
      availability: profile.availability ?? null,
      location: profile.location ?? null,
      past_work: profile.past_work ?? null,
      references_info: profile.references_info ?? null,
      language,
      interview_status: complete ? "complete" : "in_progress",
      llm_trust_score: trust.score,
      ...(remarks ? { remarks } : {}),
      raw_profile: { source: "setu", spoken: profile, trust, turns },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
  return { complete, trust, remarks };
}
