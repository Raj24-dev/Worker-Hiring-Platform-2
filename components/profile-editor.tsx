"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Eye, Loader2, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import {
  addCertificate,
  certificateLink,
  deleteCertificate,
  updateWorkerProfile,
  verifyAadhaarNumber,
} from "@/actions/profile";
import { AVAILABILITY, DOMAINS, EXPERIENCE } from "@/lib/domains";
import { verhoeff } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Certificate, Worker } from "@/lib/types";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProfileEditor({
  worker,
  certificates,
  aadhaarVerified,
}: {
  worker: Worker;
  certificates: Certificate[];
  aadhaarVerified: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: worker.name ?? "",
    location: worker.location ?? "",
    contact: worker.contact ?? "",
    position: worker.sub_domain ?? "",
    skills: worker.skills ?? "",
    experience_years: worker.experience_years ?? "",
    availability: worker.availability ?? "",
    has_tools: (worker.has_tools === "no" ? "no" : "yes") as "yes" | "no",
    remarks: worker.remarks ?? "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateWorkerProfile(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {!aadhaarVerified && <AadhaarCard />}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Your details</h2>
        <div className="mt-4 grid gap-5">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="h-12 text-base md:text-base"
            />
          </Field>

          <Field label="What work do you do?" htmlFor="position">
            <select
              id="position"
              value={form.position}
              onChange={(e) => set("position", e.target.value)}
              className="field-select"
            >
              <option value="">Choose your work</option>
              {DOMAINS.map((d) => (
                <optgroup key={d.key} label={d.label}>
                  {d.positions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>

          <Field
            label="Skills"
            htmlFor="skills"
            hint="Separate them with commas, like: house wiring, MCB boards"
          >
            <Input
              id="skills"
              value={form.skills}
              onChange={(e) => set("skills", e.target.value)}
              className="h-12 text-base md:text-base"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Experience" htmlFor="experience_years">
              <select
                id="experience_years"
                value={form.experience_years}
                onChange={(e) => set("experience_years", e.target.value)}
                className="field-select"
              >
                <option value="">Not set</option>
                {EXPERIENCE.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
                {form.experience_years &&
                  !EXPERIENCE.includes(form.experience_years as never) && (
                    <option value={form.experience_years}>{form.experience_years}</option>
                  )}
              </select>
            </Field>

            <Field label="When can you work?" htmlFor="availability">
              <select
                id="availability"
                value={form.availability}
                onChange={(e) => set("availability", e.target.value)}
                className="field-select"
              >
                <option value="">Not set</option>
                {AVAILABILITY.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                {form.availability && !AVAILABILITY.includes(form.availability as never) && (
                  <option value={form.availability}>{form.availability}</option>
                )}
              </select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your city or area" htmlFor="location">
              <Input
                id="location"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className="h-12 text-base md:text-base"
              />
            </Field>
            <Field label="Contact number" htmlFor="contact">
              <Input
                id="contact"
                value={form.contact}
                onChange={(e) => set("contact", e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                className="h-12 text-base md:text-base"
              />
            </Field>
          </div>

          <Field label="Do you have your own tools?" htmlFor="has_tools">
            <select
              id="has_tools"
              value={form.has_tools}
              onChange={(e) => set("has_tools", e.target.value as "yes" | "no")}
              className="field-select"
            >
              <option value="yes">Yes, I have my own tools</option>
              <option value="no">No</option>
            </select>
          </Field>

          <Field
            label="About you"
            htmlFor="remarks"
            hint="Setu wrote this from what you said. Change anything that is not right."
          >
            <Textarea
              id="remarks"
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              rows={4}
              maxLength={600}
              className="text-base md:text-base"
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button size="xl" className="mt-5 w-full" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : saved ? <Check className="size-5" /> : null}
          {saved ? "Saved" : "Save changes"}
        </Button>
      </section>

      <CertificatesCard certificates={certificates} />
    </div>
  );
}

function AadhaarCard() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ready = value.length === 12 && verhoeff(value);

  return (
    <section className="rounded-xl border-2 border-primary/30 bg-brand-soft/50 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-5 text-primary" />
        Verify with Aadhaar
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Verified workers get picked more often. Your number is never saved — only a
        secure code made from it.
      </p>
      <Input
        value={value.replace(/(\d{4})(?=\d)/g, "$1 ")}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 12))}
        inputMode="numeric"
        placeholder="1234 5678 9012"
        aria-label="Aadhaar number"
        className="mt-4 h-12 bg-card text-base tracking-wider md:text-base"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        className="mt-3 w-full"
        disabled={!ready || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await verifyAadhaarNumber({ aadhaar: value });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Verify
      </Button>
    </section>
  );
}

function CertificatesCard({ certificates }: { certificates: Certificate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Certificates & documents</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Add these yourself — a training certificate, licence or ID helps employers trust you.
      </p>

      {certificates.length > 0 && (
        <ul className="mt-4 grid gap-2.5">
          {certificates.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3"
            >
              <BadgeCheck className="size-4.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                {c.issuer && (
                  <p className="truncate text-sm text-muted-foreground">{c.issuer}</p>
                )}
              </div>
              {c.certificate_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      // The bucket is private, so open a short-lived signed link.
                      const res = await certificateLink(c.id);
                      if (res.ok) window.open(res.url, "_blank", "noopener");
                    })
                  }
                >
                  <Eye className="size-4" />
                  View
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${c.name}`}
                className="text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deleteCertificate(c.id);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          className="mt-4 grid gap-4 rounded-lg border bg-background p-4"
          action={(formData) =>
            start(async () => {
              setError(null);
              const res = await addCertificate(formData);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              router.refresh();
            })
          }
        >
          <Field label="What is it?" htmlFor="cert-name">
            <Input
              id="cert-name"
              name="name"
              required
              placeholder="ITI Electrician certificate"
              className="h-12 text-base md:text-base"
            />
          </Field>
          <Field label="Who gave it?" htmlFor="cert-issuer">
            <Input
              id="cert-issuer"
              name="issuer"
              placeholder="Government ITI, Mumbai"
              className="h-12 text-base md:text-base"
            />
          </Field>
          <Field
            label="Photo or PDF"
            htmlFor="cert-file"
            hint="A clear photo of the paper is fine. Up to 5 MB."
          >
            <Input
              id="cert-file"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="h-12 py-2.5 text-base file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm md:text-base"
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Add
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Add a certificate
        </Button>
      )}
    </section>
  );
}
