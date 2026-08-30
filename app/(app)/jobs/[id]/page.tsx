import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  Briefcase,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import { DetailRow, PageHeader, Stars } from "@/components/page-bits";
import { ReviewList, ratingFrom } from "@/components/review-list";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { pay, proximity, timeAgo } from "@/lib/format";
import { getApplication, getJob, listReviewsAbout } from "@/lib/queries";
import { requireWorker } from "@/lib/session";
import { JOB_TYPE_LABEL } from "@/lib/types";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) notFound();

  const { worker } = await requireWorker();
  const job = await getJob(jobId);
  if (!job) notFound();

  const application = await getApplication(jobId, worker.id);
  // What previous workers said about this employer — the worker deserves the
  // same evidence the employer gets about them.
  const employerReviews = job.employers?.profile_id
    ? await listReviewsAbout(job.employers.profile_id)
    : [];
  const near = proximity(job.location, worker.location);
  const canApply = !application && job.status === "open";

  return (
    <>
      <PageHeader title={job.title} back={{ href: "/jobs", label: "Discover Jobs" }} />

      <div className="rounded-xl border bg-card p-5">
        {job.employers?.name && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{job.employers.name}</span>
            {job.employers.verified && (
              <BadgeCheck className="size-4.5 text-primary" aria-label="Verified employer" />
            )}
            <span className="text-sm text-muted-foreground capitalize">
              · {job.employers.type ?? "employer"}
            </span>
          </div>
        )}
        {job.employers && (
          <div className="mt-1.5">
            <Stars value={ratingFrom(employerReviews)} count={employerReviews.length} />
          </div>
        )}

        <p className="mt-4 text-3xl font-semibold tracking-tight text-primary">{pay(job)}</p>

        <div className="mt-4 divide-y">
          {job.job_type && (
            <DetailRow
              icon={Briefcase}
              label="Job type"
              value={JOB_TYPE_LABEL[job.job_type]}
            />
          )}
          {job.skill && <DetailRow icon={Banknote} label="Work" value={job.skill} />}
          {job.location && (
            <DetailRow
              icon={MapPin}
              label="Address"
              value={
                <>
                  {job.location}
                  {near && <span className="ml-2 text-sm font-medium text-success">{near}</span>}
                </>
              }
            />
          )}
          <DetailRow
            icon={Users}
            label="Workers needed"
            value={`${job.openings ?? 1} ${(job.openings ?? 1) === 1 ? "worker" : "workers"}`}
          />
          <DetailRow icon={Clock} label="Posted" value={timeAgo(job.created_at)} />
        </div>

        {job.description && (
          <div className="mt-5 border-t pt-5">
            <p className="text-sm font-medium text-muted-foreground">About this work</p>
            <p className="mt-1.5 leading-relaxed whitespace-pre-line">{job.description}</p>
          </div>
        )}
      </div>

      <section className="mt-4 rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">
          What workers say about {job.employers?.name ?? "this employer"}
        </h2>
        <ReviewList
          reviews={employerReviews}
          empty="No reviews yet. This employer has not finished a job on Karigaar."
        />
      </section>

      <div className="mt-5">
        {application ? (
          <div className="rounded-xl border bg-card p-5 text-center">
            <StatusBadge status={application.status} />
            <p className="mt-3 text-sm text-muted-foreground">
              You applied {timeAgo(application.created_at)}.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/applied">See all applied jobs</Link>
            </Button>
          </div>
        ) : canApply ? (
          <Button asChild size="xl" className="w-full">
            <Link href={`/jobs/${job.id}/apply`}>Apply for job</Link>
          </Button>
        ) : (
          <div className="rounded-xl border border-dashed bg-card/60 p-5 text-center">
            <StatusBadge status={job.status} kind="job" />
            <p className="mt-3 text-sm text-muted-foreground">
              This job is not taking new applications.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
