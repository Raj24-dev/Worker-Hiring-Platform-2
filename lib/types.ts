/** Hand-written to mirror the live Supabase schema exactly. */

export type Role = "worker" | "employer";

/** open -> filled (all openings hired) -> completed (work done, reviews open) */
export type JobStatus = "open" | "filled" | "completed";

/**
 * applied  -> hired | rejected, or on_hold while the worker is busy elsewhere
 * on_hold  -> applied again when they are free, or rejected if the post went
 * hired    -> completed when the work is done, or withdrawn if they pull out
 */
export type ApplicationStatus =
  | "applied"
  | "on_hold"
  | "hired"
  | "rejected"
  | "withdrawn"
  | "completed";

/** A worker can only be committed to one job at a time. */
export const BLOCKING_STATUS: ApplicationStatus = "hired";

export type PaymentType = "per_day" | "per_hour" | "per_month" | "fixed";
export type JobType = "permanent" | "temporary";
export type EmployerType = "individual" | "company";

export type Profile = {
  id: string;
  name: string;
  role: Role;
  created_at: string | null;
  aadhaar_id: string | null;
};

export type Worker = {
  id: string;
  name: string | null;
  contact: string | null;
  location: string | null;
  domain: string | null;
  sub_domain: string | null;
  skills: string | null;
  experience_years: string | null;
  availability: string | null;
  has_tools: string | null;
  past_work: string | null;
  references_info: string | null;
  language: string | null;
  rating: number | null;
  llm_trust_score: number | null;
  interview_status: string | null;
  /** Written by Setu in the worker's own voice, editable by the worker. */
  remarks: string | null;
  created_at: string | null;
};

export type Employer = {
  id: number;
  profile_id: string;
  name: string | null;
  location: string | null;
  type: EmployerType | null;
  verified: boolean | null;
  rating: number | null;
};

export type Job = {
  id: number;
  employer_id: number | null;
  title: string;
  description: string | null;
  skill: string | null;
  location: string | null;
  salary: number | null;
  payment_type: PaymentType | null;
  job_type: JobType | null;
  openings: number;
  status: JobStatus | null;
  created_at: string | null;
};

export type Application = {
  id: number;
  job_id: number;
  worker_id: string;
  status: ApplicationStatus | null;
  answers: Record<string, string> | null;
  created_at: string | null;
};

export type Certificate = {
  id: number;
  worker_id: string;
  name: string | null;
  issuer: string | null;
  certificate_url: string | null;
  verification_status: string | null;
};

export type NotificationType =
  | "hired"
  | "rejected"
  | "on_hold"
  | "released"
  | "job_match"
  | "withdrawn"
  | "completed";

export type AppNotification = {
  id: number;
  profile_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type Review = {
  id: number;
  job_id: number;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export const PAYMENT_LABEL: Record<PaymentType, string> = {
  per_day: "per day",
  per_hour: "per hour",
  per_month: "per month",
  fixed: "total",
};

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  permanent: "Permanent",
  temporary: "Temporary",
};
