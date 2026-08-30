import { notFound, redirect } from "next/navigation";
import { ApplyForm } from "@/components/apply-form";
import { PageHeader } from "@/components/page-bits";
import { getApplication, getJob } from "@/lib/queries";
import { requireWorker } from "@/lib/session";

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) notFound();

  const { worker } = await requireWorker();
  const job = await getJob(jobId);
  if (!job) notFound();

  // Applying twice, or to a job that has closed, has no screen — send them back.
  const existing = await getApplication(jobId, worker.id);
  if (existing || job.status !== "open") redirect(`/jobs/${jobId}`);

  return (
    <>
      <PageHeader
        title="Application"
        subtitle="Answer these so the employer can pick the right person."
        back={{ href: `/jobs/${jobId}`, label: "Back to job" }}
      />
      <ApplyForm jobId={job.id} jobTitle={job.title} />
    </>
  );
}
