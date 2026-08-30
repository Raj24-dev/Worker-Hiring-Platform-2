import Link from "next/link";
import { BadgeCheck, Briefcase, Building2, MapPin, PencilLine, User } from "lucide-react";
import { AccountActions } from "@/components/account-actions";
import { Button } from "@/components/ui/button";
import { DetailRow, PageHeader, Stars } from "@/components/page-bits";
import { ReviewList, ratingFrom } from "@/components/review-list";
import { WorkerProfileView } from "@/components/worker-profile-view";
import { getEmployerDetail, getWorkerDetail } from "@/lib/queries";
import { requireProfile } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import type { Employer } from "@/lib/types";

export default async function ProfilePage() {
  const profile = await requireProfile();

  if (profile.role === "worker") {
    const { worker, certificates, reviews, history } = await getWorkerDetail(profile.id);
    return (
      <>
        <PageHeader
          title="Profile"
          action={
            <Button asChild variant="outline">
              <Link href="/profile/edit">
                <PencilLine className="size-4" />
                Edit
              </Link>
            </Button>
          }
        />
        {worker && (
          <WorkerProfileView
            profile={profile}
            worker={worker}
            certificates={certificates}
            reviews={reviews}
            history={history}
            showContact
          />
        )}
        <div className="mt-4">
          <AccountActions />
        </div>
      </>
    );
  }

  const { data: employer } = await admin
    .from("employers")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle<Employer>();

  const detail = employer
    ? await getEmployerDetail(employer.id, profile.id)
    : { jobs: [], reviews: [] };

  const posted = detail.jobs.length;
  const completed = detail.jobs.filter((j) => j.status === "completed").length;
  const isCompany = employer?.type === "company";

  return (
    <>
      <PageHeader title="Profile" />

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
            {isCompany ? <Building2 className="size-7" /> : <User className="size-7" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {employer?.name ?? profile.name}
            </h2>
            <p className="text-muted-foreground capitalize">
              {employer?.type ?? "employer"}
            </p>
            <div className="mt-1.5">
              <Stars value={ratingFrom(detail.reviews)} count={detail.reviews.length} />
            </div>
          </div>
        </div>

        {employer?.verified && (
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
            <BadgeCheck className="size-3.5" />
            Verified employer
          </span>
        )}
      </section>

      <section className="mt-4 rounded-xl border bg-card px-5 py-2">
        <div className="divide-y">
          {employer?.location && (
            <DetailRow icon={MapPin} label="Location" value={employer.location} />
          )}
          <DetailRow
            icon={Briefcase}
            label="Jobs posted"
            value={`${posted} posted · ${completed} finished`}
          />
        </div>
      </section>

      <section className="mt-4 rounded-xl border bg-card p-5">
        <h3 className="mb-3 font-semibold">Reviews from workers</h3>
        <ReviewList
          reviews={detail.reviews}
          empty="No reviews yet. Workers can review you once a job is finished."
        />
      </section>

      <div className="mt-4">
        <AccountActions />
      </div>
    </>
  );
}
