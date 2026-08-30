import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, Phone, Users } from "lucide-react";
import { CompleteJobButton } from "@/components/complete-job-button";
import { EmptyState, PageHeader, Stars } from "@/components/page-bits";
import { ReviewForm } from "@/components/review-form";
import { StatusBadge } from "@/components/status-badge";
import { domainByKey } from "@/lib/domains";
import { pay, timeAgo } from "@/lib/format";
import { getJob, listApplicants, myReviews, reviewKey } from "@/lib/queries";
import { requireEmployer } from "@/lib/session";
import { JOB_TYPE_LABEL } from "@/lib/types";

export default async function PostedJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) notFound();

  const { employer, profile } = await requireEmployer();
  const job = await getJob(jobId);
  if (!job || job.employer_id !== employer.id) notFound();

  const [applicants, reviews] = await Promise.all([
    listApplicants(jobId),
    myReviews(profile.id),
  ]);

  const hired = applicants.filter((a) => a.status === "hired" || a.status === "completed");
  const finished = job.status === "completed";

  return (
    <>
      <PageHeader title={job.title} back={{ href: "/posted", label: "Posted Jobs" }} />

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} kind="job" />
          <span className="text-xs text-muted-foreground">
            Posted {timeAgo(job.created_at)}
          </span>
        </div>

        <p className="mt-3 text-2xl font-semibold tracking-tight text-primary">{pay(job)}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {job.job_type && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {JOB_TYPE_LABEL[job.job_type]}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" />
            {hired.length} of {job.openings ?? 1} hired
          </span>
          {job.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {job.location}
            </span>
          )}
        </div>

        {job.description && (
          <p className="mt-4 border-t pt-4 leading-relaxed whitespace-pre-line">
            {job.description}
          </p>
        )}

        {!finished && hired.length > 0 && (
          <div className="mt-5 border-t pt-5">
            <CompleteJobButton jobId={job.id} />
          </div>
        )}
      </section>

      <h2 className="mt-7 mb-3 text-lg font-semibold">
        Applicants{applicants.length > 0 && ` (${applicants.length})`}
      </h2>

      {applicants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No one has applied yet"
          hint="Workers nearby can see this job. Applications will show up here."
        />
      ) : (
        <div className="grid gap-3">
          {applicants.map((a) => {
            const w = a.workers;
            const domain = domainByKey(w?.domain ?? null);
            const reviewed = reviews.get(reviewKey(job.id, a.worker_id));

            return (
              <div key={a.id} className="grid gap-2.5">
                <Link
                  href={`/posted/${job.id}/applicant/${a.worker_id}`}
                  className="flex items-center gap-3.5 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-primary">
                    {(w?.name ?? "?").slice(0, 1).toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{w?.name ?? "Worker"}</p>
                    {domain && (
                      <p className="text-sm text-muted-foreground">{domain.label}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={w?.rating ?? null} />
                      {w?.contact && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="size-3" />
                          {w.contact}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <StatusBadge status={a.status} />
                    </div>
                  </div>

                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>

                {finished && a.status === "completed" && (
                  <ReviewForm
                    jobId={job.id}
                    revieweeId={a.worker_id}
                    revieweeName={w?.name ?? "this worker"}
                    existingRating={reviewed?.rating}
                    existingComment={reviewed?.comment}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
