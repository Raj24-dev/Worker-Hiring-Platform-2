import { notFound } from "next/navigation";
import { ApplicantActions } from "@/components/applicant-actions";
import { PageHeader } from "@/components/page-bits";
import { StatusBadge } from "@/components/status-badge";
import { WorkerProfileView } from "@/components/worker-profile-view";
import { timeAgo } from "@/lib/format";
import { getJob, getProfile, getWorkerDetail } from "@/lib/queries";
import { requireEmployer } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { APPLICATION_QUESTIONS } from "@/lib/validation";
import type { Application } from "@/lib/types";

export default async function ApplicantPage({
  params,
}: {
  params: Promise<{ id: string; workerId: string }>;
}) {
  const { id, workerId } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) notFound();

  const { employer } = await requireEmployer();
  const job = await getJob(jobId);
  if (!job || job.employer_id !== employer.id) notFound();

  const { data: application } = await admin
    .from("applications")
    .select("*")
    .eq("job_id", jobId)
    .eq("worker_id", workerId)
    .maybeSingle<Application>();
  if (!application) notFound();

  const [profile, detail] = await Promise.all([
    getProfile(workerId),
    getWorkerDetail(workerId),
  ]);
  if (!profile || !detail.worker) notFound();

  const answers = application.answers ?? {};

  return (
    <>
      <PageHeader title="Applicant" back={{ href: `/posted/${jobId}`, label: job.title }} />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <StatusBadge status={application.status} />
        <span className="text-sm text-muted-foreground">
          Applied {timeAgo(application.created_at)}
        </span>
      </div>

      <WorkerProfileView
        profile={profile}
        worker={detail.worker}
        certificates={detail.certificates}
        reviews={detail.reviews}
        history={detail.history}
        showContact
      />

      {Object.keys(answers).length > 0 && (
        <section className="mt-4 rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">Their answers</h3>
          <dl className="grid gap-4">
            {APPLICATION_QUESTIONS.map((q) =>
              answers[q.key] ? (
                <div key={q.key}>
                  <dt className="text-sm text-muted-foreground">{q.label}</dt>
                  <dd className="mt-1 leading-relaxed whitespace-pre-line">{answers[q.key]}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </section>
      )}

      <div className="sticky bottom-20 mt-5 rounded-xl border bg-background/95 p-3 backdrop-blur lg:bottom-4">
        <ApplicantActions applicationId={application.id} status={application.status} />
      </div>
    </>
  );
}
