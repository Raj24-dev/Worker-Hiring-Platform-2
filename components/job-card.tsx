import Link from "next/link";
import { BadgeCheck, MapPin, Users } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { JobWithEmployer } from "@/lib/queries";
import { pay, proximity, timeAgo } from "@/lib/format";
import { JOB_TYPE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The card from the sketch: time of posting, title, who is hiring, the money,
 * permanent/temp, the address and how close it is to the worker.
 */
export function JobCard({
  job,
  href,
  workerLocation,
  applicationStatus,
  applicantCount,
  showJobStatus,
}: {
  job: JobWithEmployer;
  href: string;
  workerLocation?: string | null;
  applicationStatus?: string | null;
  applicantCount?: number;
  showJobStatus?: boolean;
}) {
  const near = proximity(job.location, workerLocation ?? null);

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border bg-card p-4 transition-all",
        "hover:border-primary/40 hover:shadow-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{timeAgo(job.created_at)}</span>
        {near && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
            <MapPin className="size-3" />
            {near}
          </span>
        )}
      </div>

      <h3 className="mt-1.5 text-lg leading-snug font-semibold text-balance">{job.title}</h3>

      {job.employers?.name && (
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="truncate">{job.employers.name}</span>
          {job.employers.verified && (
            <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified employer" />
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-base font-semibold text-primary">{pay(job)}</span>
        {job.job_type && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {JOB_TYPE_LABEL[job.job_type]}
          </span>
        )}
        {job.skill && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {job.skill}
          </span>
        )}
      </div>

      {job.location && (
        <p className="mt-2.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          <span className="line-clamp-1">{job.location}</span>
        </p>
      )}

      {(applicationStatus || showJobStatus || applicantCount !== undefined) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          {applicationStatus && <StatusBadge status={applicationStatus} />}
          {showJobStatus && <StatusBadge status={job.status} kind="job" />}
          {applicantCount !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" />
              {applicantCount === 0
                ? "No applicants yet"
                : `${applicantCount} applicant${applicantCount === 1 ? "" : "s"}`}
            </span>
          )}
          {job.openings > 1 && (
            <span className="text-xs text-muted-foreground">{job.openings} workers needed</span>
          )}
        </div>
      )}
    </Link>
  );
}
