import { PageHeader } from "@/components/page-bits";
import { PostJobForm } from "@/components/post-job-form";
import { requireEmployer } from "@/lib/session";

export default async function PostJobPage() {
  const { employer } = await requireEmployer();

  return (
    <>
      <PageHeader
        title="Post a job"
        subtitle="Workers nearby will see this straight away."
        back={{ href: "/posted", label: "Posted Jobs" }}
      />
      <PostJobForm defaultLocation={employer.location ?? ""} />
    </>
  );
}
