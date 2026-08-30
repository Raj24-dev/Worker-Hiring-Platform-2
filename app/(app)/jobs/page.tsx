import { DiscoverJobs } from "@/components/discover-jobs";
import { PageHeader } from "@/components/page-bits";
import { appliedJobIds, listOpenJobs } from "@/lib/queries";
import { requireWorker } from "@/lib/session";

export default async function DiscoverJobsPage() {
  const { worker } = await requireWorker();
  const [jobs, applied] = await Promise.all([listOpenJobs(), appliedJobIds(worker.id)]);

  return (
    <>
      <PageHeader
        title="Discover Jobs"
        subtitle={
          worker.location ? `Work near ${worker.location}` : "Work posted by employers near you"
        }
      />
      <DiscoverJobs
        initial={{ jobs, applied: [...applied] }}
        workerLocation={worker.location}
      />
    </>
  );
}
