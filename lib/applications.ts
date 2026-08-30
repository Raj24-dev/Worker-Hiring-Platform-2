import "server-only";
import { admin } from "./supabase/admin";
import { notify, type NewNotification } from "./notify";

/**
 * A worker can only actually turn up to one job at a time, so being hired parks
 * their other applications rather than deleting them. Nothing here ever removes
 * a row: a worker who changes their mind and pulls out of a job must find their
 * other applications waiting, not gone.
 *
 * applied --hired elsewhere--> on_hold --they are free again--> applied
 *                                      \--post already taken--> rejected
 */

type HeldRow = {
  id: number;
  job_id: number;
  jobs: { id: number; title: string; status: string | null } | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The rule that decides what happens to parked applications when the worker is
 * free again: anything still open goes back to the employer, anything whose
 * post was taken meanwhile is closed. Pure, so it can be tested on its own.
 */
export function planHoldRelease<T extends { jobs: { status: string | null } | null }>(
  held: T[],
) {
  return {
    restore: held.filter((h) => h.jobs?.status === "open"),
    close: held.filter((h) => h.jobs?.status !== "open"),
  };
}

/** Park every other live application while this worker is committed. */
export async function holdOtherApplications(workerId: string, keepJobId: number) {
  const { data } = await admin
    .from("applications")
    .select("id, job_id, jobs(id, title, status)")
    .eq("worker_id", workerId)
    .eq("status", "applied")
    .neq("job_id", keepJobId)
    .returns<HeldRow[]>();

  const held = data ?? [];
  if (!held.length) return 0;

  await admin
    .from("applications")
    .update({ status: "on_hold" })
    .in(
      "id",
      held.map((h) => h.id),
    );

  await notify({
    profile_id: workerId,
    type: "on_hold",
    title: `${plural(held.length, "application is", "applications are")} on hold`,
    body: `You are hired for another job, so we paused ${plural(held.length, "application", "applications")} until that work is finished. Nothing is cancelled.`,
    href: "/applied",
  });

  return held.length;
}

/**
 * The worker is free again — their hired job finished, or they pulled out, or
 * the employer let them go. Anything still open comes back; anything whose post
 * was taken meanwhile is closed off with the reason spelled out.
 */
export async function releaseHeldApplications(workerId: string) {
  const { data } = await admin
    .from("applications")
    .select("id, job_id, jobs(id, title, status)")
    .eq("worker_id", workerId)
    .eq("status", "on_hold")
    .returns<HeldRow[]>();

  const held = data ?? [];
  if (!held.length) return { restored: 0, closed: 0 };

  const { restore: stillOpen, close: gone } = planHoldRelease(held);
  const messages: NewNotification[] = [];

  if (stillOpen.length) {
    await admin
      .from("applications")
      .update({ status: "applied" })
      .in(
        "id",
        stillOpen.map((h) => h.id),
      );
    messages.push({
      profile_id: workerId,
      type: "released",
      title: `${plural(stillOpen.length, "application is", "applications are")} active again`,
      body: "You are free to take new work, so we sent your paused applications back to the employers.",
      href: "/applied",
    });
  }

  if (gone.length) {
    await admin
      .from("applications")
      .update({ status: "rejected" })
      .in(
        "id",
        gone.map((h) => h.id),
      );
    for (const h of gone) {
      messages.push({
        profile_id: workerId,
        type: "rejected",
        title: `${h.jobs?.title ?? "A job"} is no longer available`,
        body: "That position was filled by someone else while you were working on another job.",
        href: "/applied",
      });
    }
  }

  await notify(messages);
  return { restored: stillOpen.length, closed: gone.length };
}

/**
 * "If a holding application's vacant post has been captured by another worker,
 * the holding application also gets rejected, with clear context."
 */
export async function rejectHoldsOnFilledJob(jobId: number, jobTitle: string) {
  const { data } = await admin
    .from("applications")
    .select("id, worker_id")
    .eq("job_id", jobId)
    .eq("status", "on_hold")
    .returns<{ id: number; worker_id: string }[]>();

  const stranded = data ?? [];
  if (!stranded.length) return 0;

  await admin
    .from("applications")
    .update({ status: "rejected" })
    .in(
      "id",
      stranded.map((s) => s.id),
    );

  await notify(
    stranded.map((s) => ({
      profile_id: s.worker_id,
      type: "rejected" as const,
      title: `${jobTitle} has been filled`,
      body: "Your application was on hold while you were working elsewhere, and the employer has now taken another worker for this job.",
      href: "/applied",
    })),
  );

  return stranded.length;
}

/** Is this worker already committed somewhere? Used to gate applying. */
export async function activeHire(workerId: string) {
  const { data } = await admin
    .from("applications")
    .select("job_id, jobs(title)")
    .eq("worker_id", workerId)
    .eq("status", "hired")
    .maybeSingle<{ job_id: number; jobs: { title: string } | null }>();
  return data ?? null;
}
