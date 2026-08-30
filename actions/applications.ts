"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import {
  holdOtherApplications,
  rejectHoldsOnFilledJob,
  releaseHeldApplications,
} from "@/lib/applications";
import { notify } from "@/lib/notify";
import { requireEmployer, requireWorker } from "@/lib/session";
import { applicationSchema } from "@/lib/validation";

/** Worker applies. The four questions from the sketch land in applications.answers. */
export async function applyToJob(
  jobId: number,
  answers: z.input<typeof applicationSchema>,
) {
  const { worker } = await requireWorker();

  const parsed = applicationSchema.safeParse(answers);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { data: job } = await admin
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle<{ id: number; status: string | null }>();

  if (!job) return { ok: false as const, error: "That job no longer exists." };
  if (job.status !== "open") {
    return { ok: false as const, error: "This job is no longer taking applications." };
  }

  // Applying while already hired somewhere would only create an application
  // that is immediately parked, so it starts on hold and says so.
  const { data: busy } = await admin
    .from("applications")
    .select("id")
    .eq("worker_id", worker.id)
    .eq("status", "hired")
    .maybeSingle();

  const { error } = await admin.from("applications").insert({
    job_id: jobId,
    worker_id: worker.id,
    status: busy ? "on_hold" : "applied",
    answers: parsed.data,
  });

  if (error) {
    // The unique index on (job_id, worker_id) is what actually stops double-applying.
    if (error.code === "23505") {
      return { ok: false as const, error: "You have already applied to this job." };
    }
    return { ok: false as const, error: "Could not send your application. Please try again." };
  }

  revalidatePath("/jobs");
  revalidatePath("/applied");
  return { ok: true as const, onHold: !!busy };
}

/**
 * Loads an application and proves it belongs to a job this employer owns.
 * Everything the employer can do to an application goes through here first.
 */
async function ownedApplication(applicationId: number) {
  const { employer } = await requireEmployer();

  const { data } = await admin
    .from("applications")
    .select("id, job_id, worker_id, status, jobs(id, title, employer_id, openings, status)")
    .eq("id", applicationId)
    .maybeSingle<{
      id: number;
      job_id: number;
      worker_id: string;
      status: string | null;
      jobs: {
        id: number;
        title: string;
        employer_id: number | null;
        openings: number;
        status: string | null;
      } | null;
    }>();

  if (!data?.jobs || data.jobs.employer_id !== employer.id) return null;
  return data;
}

export async function hireApplicant(applicationId: number) {
  const app = await ownedApplication(applicationId);
  if (!app) return { ok: false as const, error: "You cannot change this application." };
  if (app.status === "hired") return { ok: true as const };

  const title = app.jobs?.title ?? "a job";

  const { error } = await admin
    .from("applications")
    .update({ status: "hired" })
    .eq("id", applicationId);
  if (error) return { ok: false as const, error: "Could not hire this worker. Please try again." };

  const held = await holdOtherApplications(app.worker_id, app.job_id);

  await notify({
    profile_id: app.worker_id,
    type: "hired",
    title: `You are hired for ${title}`,
    body: held
      ? "Your other applications are on hold until this work is finished."
      : "The employer has accepted your application.",
    href: "/applied",
  });

  // "Job position/quota filled -> remove job from Discover Jobs." The job row
  // stays; only its status changes, so the employer keeps every record.
  const { count } = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", app.job_id)
    .eq("status", "hired");

  if ((count ?? 0) >= (app.jobs?.openings ?? 1)) {
    await admin.from("jobs").update({ status: "filled" }).eq("id", app.job_id);
    // Anyone parked on this job has now lost it to someone else.
    await rejectHoldsOnFilledJob(app.job_id, title);
  }

  revalidatePath("/posted");
  revalidatePath(`/posted/${app.job_id}`);
  revalidatePath("/applied");
  return { ok: true as const };
}

export async function rejectApplicant(applicationId: number) {
  const app = await ownedApplication(applicationId);
  if (!app) return { ok: false as const, error: "You cannot change this application." };

  const { error } = await admin
    .from("applications")
    .update({ status: "rejected" })
    .eq("id", applicationId);
  if (error) return { ok: false as const, error: "Could not update this application." };

  // Letting a hired worker go frees both the position and the worker.
  if (app.status === "hired") {
    if (app.jobs?.status === "filled") {
      await admin.from("jobs").update({ status: "open" }).eq("id", app.job_id);
    }
    await releaseHeldApplications(app.worker_id);
  }

  await notify({
    profile_id: app.worker_id,
    type: "rejected",
    title: `Not selected for ${app.jobs?.title ?? "a job"}`,
    body: "The employer has chosen someone else for this job.",
    href: "/applied",
  });

  revalidatePath("/posted");
  revalidatePath(`/posted/${app.job_id}`);
  revalidatePath("/applied");
  return { ok: true as const };
}

/**
 * The worker changes their mind about a job they accepted. This is exactly why
 * held applications are parked rather than deleted — they all come back.
 */
export async function withdrawFromJob(applicationId: number) {
  const { worker, profile } = await requireWorker();

  const { data: app } = await admin
    .from("applications")
    .select("id, job_id, worker_id, status, jobs(id, title, status, employer_id, employers(profile_id))")
    .eq("id", applicationId)
    .maybeSingle<{
      id: number;
      job_id: number;
      worker_id: string;
      status: string | null;
      jobs: {
        id: number;
        title: string;
        status: string | null;
        employer_id: number | null;
        employers: { profile_id: string } | null;
      } | null;
    }>();

  if (!app || app.worker_id !== worker.id) {
    return { ok: false as const, error: "That is not your application." };
  }
  if (app.status !== "hired") {
    return { ok: false as const, error: "You can only cancel a job you have accepted." };
  }

  const { error } = await admin
    .from("applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId);
  if (error) return { ok: false as const, error: "Could not cancel. Please try again." };

  if (app.jobs?.status === "filled") {
    await admin.from("jobs").update({ status: "open" }).eq("id", app.job_id);
  }

  const released = await releaseHeldApplications(worker.id);

  const employerProfile = app.jobs?.employers?.profile_id;
  if (employerProfile) {
    await notify({
      profile_id: employerProfile,
      type: "withdrawn",
      title: `${profile.name} has cancelled`,
      body: `They can no longer do ${app.jobs?.title ?? "this job"}. The position is open again.`,
      href: `/posted/${app.job_id}`,
    });
  }

  revalidatePath("/applied");
  revalidatePath("/jobs");
  revalidatePath(`/posted/${app.job_id}`);
  return { ok: true as const, ...released };
}
