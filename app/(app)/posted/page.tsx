import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { JobCard } from "@/components/job-card";
import { EmptyState, PageHeader } from "@/components/page-bits";
import { Button } from "@/components/ui/button";
import { applicantCounts, listEmployerJobs } from "@/lib/queries";
import { requireEmployer } from "@/lib/session";

export default async function PostedJobsPage() {
  const { employer } = await requireEmployer();
  const jobs = await listEmployerJobs(employer.id);
  const counts = await applicantCounts(jobs.map((j) => j.id));

  return (
    <>
      <PageHeader
        title="Posted Jobs"
        subtitle="The work you have posted, and who applied."
        action={
          jobs.length > 0 ? (
            <Button asChild size="lg">
              <Link href="/posted/new">
                <Plus className="size-4.5" />
                Post a job
              </Link>
            </Button>
          ) : undefined
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="You have not posted any job yet"
          hint="Post a job and workers nearby will start applying."
          action={
            <Button asChild size="lg">
              <Link href="/posted/new">
                <Plus className="size-4.5" />
                Post a job
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              href={`/posted/${job.id}`}
              applicantCount={counts.get(job.id) ?? 0}
              showJobStatus
            />
          ))}
        </div>
      )}
    </>
  );
}
