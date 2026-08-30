"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getMe } from "@/lib/session";
import { reviewSchema } from "@/lib/validation";

/**
 * Mutual review on a finished job. Who may review whom is derived from the
 * job itself, never from the client: the employer reviews a worker they hired,
 * and a hired worker reviews the employer.
 */
export async function submitReview(
  jobId: number,
  revieweeId: string,
  input: z.input<typeof reviewSchema>,
) {
  const me = await getMe();
  if (!me?.profile) return { ok: false as const, error: "Please sign in again." };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { data: job } = await admin
    .from("jobs")
    .select("id, status, employer_id, employers(profile_id)")
    .eq("id", jobId)
    .maybeSingle<{
      id: number;
      status: string | null;
      employer_id: number | null;
      employers: { profile_id: string } | null;
    }>();

  if (!job) return { ok: false as const, error: "That job no longer exists." };
  if (job.status !== "completed") {
    return { ok: false as const, error: "You can review once the work is finished." };
  }

  const employerProfileId = job.employers?.profile_id ?? null;
  const { data: hired } = await admin
    .from("applications")
    .select("worker_id")
    .eq("job_id", jobId)
    .eq("status", "completed");
  const workerIds = new Set((hired ?? []).map((r) => r.worker_id as string));

  const iAmEmployer = me.userId === employerProfileId;
  const iAmWorker = workerIds.has(me.userId);

  const allowed = iAmEmployer
    ? workerIds.has(revieweeId)
    : iAmWorker && revieweeId === employerProfileId;

  if (!allowed) return { ok: false as const, error: "You cannot review this person." };

  const { error } = await admin.from("reviews").upsert(
    {
      job_id: jobId,
      reviewer_id: me.userId,
      reviewee_id: revieweeId,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
    { onConflict: "job_id,reviewer_id,reviewee_id" },
  );

  if (error) return { ok: false as const, error: "Could not save your review. Please try again." };

  await refreshRating(revieweeId, iAmEmployer ? "worker" : "employer");

  revalidatePath("/history");
  revalidatePath("/profile");
  revalidatePath(`/posted/${jobId}`);
  return { ok: true as const };
}

/** Keep the existing workers.rating / employers.rating columns meaningful. */
async function refreshRating(revieweeId: string, kind: "worker" | "employer") {
  const { data } = await admin.from("reviews").select("rating").eq("reviewee_id", revieweeId);
  if (!data?.length) return;

  const average = data.reduce((sum, r) => sum + (r.rating as number), 0) / data.length;
  const rounded = Math.round(average);

  if (kind === "worker") {
    await admin.from("workers").update({ rating: rounded }).eq("id", revieweeId);
  } else {
    await admin.from("employers").update({ rating: rounded }).eq("profile_id", revieweeId);
  }
}
