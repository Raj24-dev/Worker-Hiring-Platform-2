import Link from "next/link";
import { ClipboardList, PauseCircle } from "lucide-react";
import { JobCard } from "@/components/job-card";
import { EmptyState, PageHeader } from "@/components/page-bits";
import { WithdrawButton } from "@/components/withdraw-button";
import { Button } from "@/components/ui/button";
import { listWorkerApplications } from "@/lib/queries";
import { requireWorker } from "@/lib/session";

export default async function AppliedJobsPage() {
  const { worker } = await requireWorker();
  const applications = await listWorkerApplications(worker.id, false);

  const hired = applications.find((a) => a.status === "hired");
  const heldCount = applications.filter((a) => a.status === "on_hold").length;

  return (
    <>
      <PageHeader
        title="Applied Jobs"
        subtitle="Every job you applied for, and what happened to it."
      />

      {hired && heldCount > 0 && (
        <p className="mb-4 flex items-start gap-2.5 rounded-xl border bg-brand-soft/60 px-4 py-3 text-sm">
          <PauseCircle className="mt-0.5 size-4.5 shrink-0 text-primary" />
          <span>
            You are working on{" "}
            <span className="font-medium">{hired.jobs?.title ?? "a job"}</span>, so{" "}
            {heldCount === 1 ? "one application is" : `${heldCount} applications are`} on
            hold. Nothing is cancelled — they go back to the employers when this work is
            finished.
          </span>
        </p>
      )}

      {applications.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="You have not applied to any job yet"
          hint="Find work you like in Discover Jobs and send an application."
          action={
            <Button asChild size="lg">
              <Link href="/jobs">Discover Jobs</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {applications.map((application) =>
            application.jobs ? (
              <div key={application.id} className="grid gap-2.5">
                <JobCard
                  job={application.jobs}
                  href={`/jobs/${application.job_id}`}
                  workerLocation={worker.location}
                  applicationStatus={application.status}
                />
                {application.status === "hired" && (
                  <div className="flex justify-end">
                    <WithdrawButton applicationId={application.id} heldCount={heldCount} />
                  </div>
                )}
              </div>
            ) : null,
          )}
        </div>
      )}
    </>
  );
}
