import { PageHeader } from "@/components/page-bits";
import { ProfileEditor } from "@/components/profile-editor";
import { getWorkerDetail } from "@/lib/queries";
import { requireWorker } from "@/lib/session";

export default async function EditProfilePage() {
  const { profile, worker } = await requireWorker();
  const { certificates } = await getWorkerDetail(worker.id);

  return (
    <>
      <PageHeader
        title="Edit profile"
        subtitle="Change anything that is not right."
        back={{ href: "/profile", label: "Profile" }}
      />
      <ProfileEditor
        worker={worker}
        certificates={certificates}
        aadhaarVerified={!!profile.aadhaar_id}
      />
    </>
  );
}
