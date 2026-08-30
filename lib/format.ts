import { PAYMENT_LABEL, type Job } from "./types";

/** "5 min ago" — the job card's "TIME of posting" field. */
export function timeAgo(iso: string | null) {
  if (!iso) return "";
  const then = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const rupees = (n: number | null) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN")}`;

/** "₹800 per day" */
export function pay(job: Pick<Job, "salary" | "payment_type">) {
  if (job.salary == null) return "—";
  return `${rupees(job.salary)}${job.payment_type ? ` ${PAYMENT_LABEL[job.payment_type]}` : ""}`;
}

/**
 * The job card asks for "distance from the worker", but neither table stores
 * coordinates. Rather than bolt geo onto the schema, compare the location text
 * both sides already have.
 */
export function proximity(jobLocation: string | null, workerLocation: string | null) {
  if (!jobLocation || !workerLocation) return null;

  // Compared as place names, not as one long string. "Andheri, Mumbai" and
  // "Andheri and Jogeshwari, Mumbai" are plainly the same area to a person,
  // but neither contains the other once the punctuation is stripped out.
  const places = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
    );

  const job = places(jobLocation);
  const worker = places(workerLocation);
  if (!job.size || !worker.size) return null;

  for (const place of job) if (worker.has(place)) return "Near you";
  return null;
}

/** Words that carry no location, so they must not make two places "match". */
const STOP_WORDS = new Set(["and", "the", "near", "opp", "road", "street", "area"]);
