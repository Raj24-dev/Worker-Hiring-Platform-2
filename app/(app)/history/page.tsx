import { History } from "lucide-react";
import { JobCard } from "@/components/job-card";
import { EmptyState, PageHeader } from "@/components/page-bits";
import { ReviewForm } from "@/components/review-form";
import { listWorkerApplications, myReviews, reviewKey } from "@/lib/queries";
import { requireWorker } from "@/lib/session";

export default async function HistoryPage() {
  const { worker } = await requireWorker();
  const [finished, reviews] = await Promise.all([
    listWorkerApplications(worker.id, true),
    myReviews(worker.id),
  ]);

  return (
    <>
      <PageHeader title="History" subtitle="Work you have finished." />

      {finished.length === 0 ? (
        <EmptyState
          icon={History}
          title="No finished work yet"
          hint="Once an employer marks a job as finished, it will show up here."
        />
      ) : (
        <div className="grid gap-4">
          {finished.map((application) => {
            const job = application.jobs;
            if (!job) return null;
            const employerProfileId = job.employers?.profile_id;
            const mine = employerProfileId
              ? reviews.get(reviewKey(job.id, employerProfileId))
              : undefined;

            return (
              <div key={application.id} className="grid gap-2.5">
                <JobCard
                  job={job}
                  href={`/jobs/${job.id}`}
                  workerLocation={worker.location}
                  applicationStatus={application.status}
                />
                {employerProfileId && (
                  <ReviewForm
                    jobId={job.id}
                    revieweeId={employerProfileId}
                    revieweeName={job.employers?.name ?? "the employer"}
                    existingRating={mine?.rating}
                    existingComment={mine?.comment}
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
