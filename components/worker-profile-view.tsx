import {
  Award,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  MapPin,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { DetailRow, Stars } from "@/components/page-bits";
import { ReviewList, ratingFrom } from "@/components/review-list";
import { timeAgo } from "@/lib/format";
import { domainByKey } from "@/lib/domains";
import type { ApplicationWithJob, ReviewWithAuthor } from "@/lib/queries";
import type { Certificate, Profile, Worker } from "@/lib/types";

/**
 * The worker profile from the sketch: name, location, history, certifications
 * and credentials. Used both by the worker themself and by an employer sizing
 * up an applicant, so it takes no actions of its own.
 */
export function WorkerProfileView({
  profile,
  worker,
  certificates,
  reviews,
  history,
  showContact,
}: {
  profile: Profile;
  worker: Worker;
  certificates: Certificate[];
  reviews: ReviewWithAuthor[];
  history: ApplicationWithJob[];
  showContact: boolean;
}) {
  const domain = domainByKey(worker.domain);
  const skills = (worker.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl font-semibold text-primary">
            {(worker.name ?? profile.name).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {worker.name ?? profile.name}
            </h2>
            {domain && <p className="text-muted-foreground">{domain.label}</p>}
            <div className="mt-1.5">
              <Stars value={ratingFrom(reviews)} count={reviews.length} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {profile.aadhaar_id && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
              <BadgeCheck className="size-3.5" />
              Aadhaar verified
            </span>
          )}
          {worker.llm_trust_score != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-primary">
              <ShieldCheck className="size-3.5" />
              Trust score {worker.llm_trust_score}
            </span>
          )}
          {worker.has_tools === "yes" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
              <Wrench className="size-3.5" />
              Has own tools
            </span>
          )}
        </div>

        {/* The worker's own words. Setu writes the first draft from what they
            said out loud; they can rewrite it from Edit profile. */}
        {worker.remarks && (
          <blockquote className="mt-4 border-l-2 border-primary/30 pl-4 leading-relaxed text-pretty">
            {worker.remarks}
          </blockquote>
        )}
      </section>

      <section className="rounded-xl border bg-card px-5 py-2">
        <div className="divide-y">
          {worker.location && <DetailRow icon={MapPin} label="Location" value={worker.location} />}
          {worker.experience_years && (
            <DetailRow icon={Briefcase} label="Experience" value={worker.experience_years} />
          )}
          {worker.availability && (
            <DetailRow icon={CalendarClock} label="Available" value={worker.availability} />
          )}
          {showContact && worker.contact && (
            <DetailRow
              icon={Phone}
              label="Contact"
              value={
                <a href={`tel:${worker.contact}`} className="text-primary underline-offset-4 hover:underline">
                  {worker.contact}
                </a>
              }
            />
          )}
        </div>
      </section>

      {skills.length > 0 && (
        <Panel title="Skills">
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Certifications">
        {certificates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certificates added yet.</p>
        ) : (
          <ul className="grid gap-2.5">
            {certificates.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3">
                <Award className="mt-0.5 size-4.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium">{c.name ?? "Certificate"}</p>
                  {c.issuer && <p className="text-sm text-muted-foreground">{c.issuer}</p>}
                  {c.verification_status && (
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {c.verification_status}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Work history">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finished jobs yet.</p>
        ) : (
          <ul className="divide-y">
            {history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">{h.jobs?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {h.jobs?.employers?.name ?? "Employer"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Reviews from employers">
        <ReviewList
          reviews={reviews}
          empty="No reviews yet. This worker has not finished a job on Karigaar."
        />
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  );
}
