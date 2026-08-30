import "server-only";
import { admin } from "./supabase/admin";
import type {
  Application,
  Certificate,
  Employer,
  Job,
  Profile,
  Review,
  Worker,
} from "./types";

/** A job card always shows who is hiring, so employers ride along. */
export type JobWithEmployer = Job & { employers: Employer | null };

export type ApplicationWithJob = Application & { jobs: JobWithEmployer | null };

export type ApplicantRow = Application & { workers: Worker | null };

/** A review is only trustworthy if you can see who wrote it. */
export type ReviewWithAuthor = Review & { author: string };

/**
 * Attaches reviewer names in one extra round trip, rather than guessing at the
 * foreign-key alias PostgREST would need for an embed.
 */
async function withAuthors(reviews: Review[]): Promise<ReviewWithAuthor[]> {
  if (!reviews.length) return [];
  const ids = [...new Set(reviews.map((r) => r.reviewer_id))];
  const { data } = await admin.from("profiles").select("id, name").in("id", ids);
  const names = new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
  return reviews.map((r) => ({ ...r, author: names.get(r.reviewer_id) ?? "A user" }));
}

/** Everything written about this person, newest first. */
export async function listReviewsAbout(profileId: string) {
  const { data, error } = await admin
    .from("reviews")
    .select("*")
    .eq("reviewee_id", profileId)
    .order("created_at", { ascending: false });
  // The reviews table may not exist until the migration runs; treat that as none.
  return error ? [] : withAuthors((data ?? []) as Review[]);
}

const JOB_SELECT = "*, employers(*)";

/**
 * Discover Jobs. Only open jobs appear — once every position is filled the job
 * drops out of discovery but is never deleted, exactly as the flow requires.
 */
export async function listOpenJobs(search?: string) {
  let q = admin
    .from("jobs")
    .select(JOB_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`title.ilike.${term},skill.ilike.${term},location.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as JobWithEmployer[];
}

export async function getJob(id: number) {
  const { data } = await admin.from("jobs").select(JOB_SELECT).eq("id", id).maybeSingle();
  return (data as JobWithEmployer | null) ?? null;
}

/** Which of these jobs has this worker already applied to. */
export async function appliedJobIds(workerId: string) {
  const { data } = await admin.from("applications").select("job_id").eq("worker_id", workerId);
  return new Set((data ?? []).map((r) => r.job_id as number));
}

export async function getApplication(jobId: number, workerId: string) {
  const { data } = await admin
    .from("applications")
    .select("*")
    .eq("job_id", jobId)
    .eq("worker_id", workerId)
    .maybeSingle();
  return (data as Application | null) ?? null;
}

/**
 * Applied Jobs holds everything still in play; History holds finished work.
 * Same table, split on status so neither screen repeats the other.
 */
export async function listWorkerApplications(workerId: string, done: boolean) {
  const { data } = await admin
    .from("applications")
    .select(`*, jobs(${JOB_SELECT})`)
    .eq("worker_id", workerId)
    [done ? "eq" : "neq"]("status", "completed")
    .order("created_at", { ascending: false });
  return (data ?? []) as ApplicationWithJob[];
}

export async function listEmployerJobs(employerId: number) {
  const { data } = await admin
    .from("jobs")
    .select(JOB_SELECT)
    .eq("employer_id", employerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as JobWithEmployer[];
}

/** How many applicants each job has, for the Posted Jobs list. */
export async function applicantCounts(jobIds: number[]) {
  if (!jobIds.length) return new Map<number, number>();
  const { data } = await admin.from("applications").select("job_id").in("job_id", jobIds);
  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.job_id as number, (counts.get(row.job_id as number) ?? 0) + 1);
  }
  return counts;
}

export async function listApplicants(jobId: number) {
  const { data } = await admin
    .from("applications")
    .select("*, workers(*)")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ApplicantRow[];
}

/** Everything the worker profile page shows, in one round trip each. */
export async function getWorkerDetail(workerId: string) {
  const [worker, certificates, reviews, history] = await Promise.all([
    admin.from("workers").select("*").eq("id", workerId).maybeSingle(),
    admin.from("certificates").select("*").eq("worker_id", workerId),
    listReviewsAbout(workerId),
    admin
      .from("applications")
      .select(`*, jobs(${JOB_SELECT})`)
      .eq("worker_id", workerId)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
  ]);

  return {
    worker: (worker.data as Worker | null) ?? null,
    certificates: (certificates.data ?? []) as Certificate[],
    reviews,
    history: (history.data ?? []) as ApplicationWithJob[],
  };
}

export async function getEmployerDetail(employerId: number, profileId: string) {
  const [jobs, reviews] = await Promise.all([
    admin.from("jobs").select("id, status").eq("employer_id", employerId),
    listReviewsAbout(profileId),
  ]);
  return { jobs: (jobs.data ?? []) as Pick<Job, "id" | "status">[], reviews };
}

export async function getProfile(id: string) {
  const { data } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  return (data as Profile | null) ?? null;
}

/**
 * Reviews this person has written, keyed `jobId:revieweeId`. A job with several
 * openings means one review per hired worker, so the job alone is not a key.
 */
export const reviewKey = (jobId: number, revieweeId: string) => `${jobId}:${revieweeId}`;

export async function myReviews(reviewerId: string) {
  const { data, error } = await admin
    .from("reviews")
    .select("*")
    .eq("reviewer_id", reviewerId);
  if (error) return new Map<string, Review>();
  return new Map((data as Review[]).map((r) => [reviewKey(r.job_id, r.reviewee_id), r]));
}
