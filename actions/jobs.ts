"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { releaseHeldApplications } from "@/lib/applications";
import { notify, type NewNotification } from "@/lib/notify";
import { proximity } from "@/lib/format";
import { requireEmployer } from "@/lib/session";
import { jobSchema } from "@/lib/validation";
import type { Worker } from "@/lib/types";

export async function createJob(input: z.input<typeof jobSchema>) {
  const { employer } = await requireEmployer();

  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { data, error } = await admin
    .from("jobs")
    .insert({
      employer_id: employer.id,
      title: d.title,
      skill: d.skill,
      salary: d.salary,
      payment_type: d.payment_type,
      job_type: d.job_type,
      openings: d.openings,
      location: d.location,
      description: d.description || null,
      status: "open",
    })
    .select("id")
    .single<{ id: number }>();

  if (error) return { ok: false as const, error: "Could not post the job. Please try again." };

  await notifyMatchingWorkers(data.id, d.title, d.skill, d.location, employer.name);

  revalidatePath("/posted");
  revalidatePath("/jobs");
  return { ok: true as const, jobId: data.id };
}

/**
 * "A job posted that matches the worker's profile and is feasible for them."
 * Both halves are required: it has to be work they actually do, and close
 * enough to reach. A near-miss on either is not worth a notification.
 */
async function notifyMatchingWorkers(
  jobId: number,
  title: string,
  skill: string,
  location: string,
  employerName: string | null,
) {
  const { data: workers } = await admin
    .from("workers")
    .select("id, sub_domain, skills, location")
    .eq("interview_status", "complete")
    .returns<Pick<Worker, "id" | "sub_domain" | "skills" | "location">[]>();

  const wanted = skill.trim().toLowerCase();
  const matches = (workers ?? []).filter((w) => {
    const does =
      w.sub_domain?.trim().toLowerCase() === wanted ||
      (w.skills ?? "")
        .split(",")
        .some((s) => s.trim().toLowerCase() === wanted);
    return does && proximity(location, w.location) !== null;
  });

  if (!matches.length) return;

  const rows: NewNotification[] = matches.map((w) => ({
    profile_id: w.id,
    type: "job_match" as const,
    title: `New ${skill} work near you`,
    body: `${employerName ?? "An employer"} posted "${title}" in ${location}.`,
    href: `/jobs/${jobId}`,
  }));

  await notify(rows);
}

/**
 * "Job gets done -> worker and employer review each other." Completing the job
 * is what opens reviews, so it is a deliberate action, not a guess.
 */
export async function completeJob(jobId: number) {
  const { employer } = await requireEmployer();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, employer_id")
    .eq("id", jobId)
    .maybeSingle<{ id: number; title: string; employer_id: number | null }>();

  if (!job || job.employer_id !== employer.id) {
    return { ok: false as const, error: "You cannot change this job." };
  }

  const { data: hired } = await admin
    .from("applications")
    .select("worker_id")
    .eq("job_id", jobId)
    .eq("status", "hired")
    .returns<{ worker_id: string }[]>();

  const { error } = await admin.from("jobs").update({ status: "completed" }).eq("id", jobId);
  if (error) return { ok: false as const, error: "Could not update this job." };

  // Everyone who worked it moves to their History and can now leave a review.
  await admin
    .from("applications")
    .update({ status: "completed" })
    .eq("job_id", jobId)
    .eq("status", "hired");

  // They are free again, so whatever was parked comes back.
  for (const w of hired ?? []) {
    await releaseHeldApplications(w.worker_id);
    await notify({
      profile_id: w.worker_id,
      type: "completed",
      title: `${job.title} is finished`,
      body: "You can now leave a review for this employer from your History.",
      href: "/history",
    });
  }

  revalidatePath("/posted");
  revalidatePath(`/posted/${jobId}`);
  revalidatePath("/history");
  revalidatePath("/applied");
  return { ok: true as const };
}
