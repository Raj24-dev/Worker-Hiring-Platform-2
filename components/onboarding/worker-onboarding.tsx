"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createWorkerProfile } from "@/actions/onboarding";
import { AVAILABILITY, DOMAINS, EXPERIENCE, domainByKey } from "@/lib/domains";
import { AadhaarVerify } from "@/components/aadhaar-verify";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceCard, Chip, DOMAIN_ICONS, StepShell } from "./ui";

type Draft = {
  name: string;
  location: string;
  contact: string;
  domain: string;
  positions: string[];
  experience_years: string;
  availability: string;
  has_tools: "yes" | "no" | "";
};

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  aadhaar: {
    title: "Verify with Aadhaar",
    subtitle: "Verified workers get picked more often.",
  },
  about: { title: "Tell us about you", subtitle: "This is what employers will see." },
  domain: { title: "What work do you do?", subtitle: "Pick one." },
  positions: { title: "Which jobs do you want?", subtitle: "Pick as many as you like." },
  details: { title: "A few last things" },
};

export function WorkerOnboarding({
  aadhaarAlreadyVerified,
  phone,
  knownName = "",
}: {
  aadhaarAlreadyVerified: boolean;
  phone: string;
  /** Prefilled when a profile already exists but its worker row does not. */
  knownName?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [aadhaarDone, setAadhaarDone] = useState(false);
  const [d, setD] = useState<Draft>({
    name: knownName,
    location: "",
    contact: phone,
    domain: "",
    positions: [],
    experience_years: "",
    availability: "",
    has_tools: "",
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  // Derived from `prev`, not from the render closure: two quick taps would
  // otherwise both read the same stale array and the second would win.
  const togglePosition = (p: string) =>
    setD((prev) => ({
      ...prev,
      positions: prev.positions.includes(p)
        ? prev.positions.filter((x) => x !== p)
        : [...prev.positions, p],
    }));

  // The Aadhaar step is skipped when the account already signed in with Aadhaar.
  const steps = useMemo(
    () =>
      aadhaarAlreadyVerified
        ? (["about", "domain", "positions", "details"] as const)
        : (["aadhaar", "about", "domain", "positions", "details"] as const),
    [aadhaarAlreadyVerified],
  );

  const current: string = steps[step];
  const domain = domainByKey(d.domain);

  const gates: Record<string, boolean> = {
    // Continue only opens once the code has actually been confirmed.
    aadhaar: aadhaarDone,
    about: d.name.trim().length >= 2 && d.location.trim().length >= 2,
    domain: !!d.domain,
    positions: d.positions.length > 0,
    details: !!d.experience_years && !!d.availability && !!d.has_tools,
  };

  async function onNext() {
    setError(null);
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    setBusy(true);
    const res = await createWorkerProfile({
      name: d.name,
      location: d.location,
      contact: d.contact,
      domain: d.domain,
      positions: d.positions,
      experience_years: d.experience_years,
      availability: d.availability,
      has_tools: d.has_tools as "yes" | "no",
    });

    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace(res.next), 1200);
  }

  if (done) return <ProfileCreated />;

  return (
    <StepShell
      step={step + 1}
      total={steps.length}
      title={TITLES[current].title}
      subtitle={TITLES[current].subtitle}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      onNext={onNext}
      nextDisabled={!gates[current]}
      nextLabel={step === steps.length - 1 ? "Create my profile" : "Continue"}
      busy={busy}
      error={error}
    >
      {current === "aadhaar" && <AadhaarVerify onVerified={() => setAadhaarDone(true)} />}

      {current === "about" && (
        <div className="grid gap-5">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
              placeholder="Ramesh Kumar"
              className="mt-2 h-12 text-base md:text-base"
            />
          </div>
          <div>
            <Label htmlFor="location">Your city or area</Label>
            <Input
              id="location"
              value={d.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Andheri, Mumbai"
              className="mt-2 h-12 text-base md:text-base"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              We use this to show you work close by.
            </p>
          </div>
          <div>
            <Label htmlFor="contact">Contact number</Label>
            <Input
              id="contact"
              value={d.contact}
              onChange={(e) => set("contact", e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              placeholder="98765 43210"
              className="mt-2 h-12 text-base md:text-base"
            />
          </div>
        </div>
      )}

      {current === "domain" && (
        <div className="grid gap-2.5">
          {DOMAINS.map((item) => (
            <ChoiceCard
              key={item.key}
              selected={d.domain === item.key}
              onClick={() => {
                set("domain", item.key);
                set("positions", []);
              }}
              title={item.label}
              hint={item.hint}
              icon={DOMAIN_ICONS[item.icon]}
            />
          ))}
        </div>
      )}

      {current === "positions" && (
        <div className="flex flex-wrap gap-2.5">
          {domain?.positions.map((p) => (
            <Chip
              key={p}
              selected={d.positions.includes(p)}
              onClick={() => togglePosition(p)}
            >
              {p}
            </Chip>
          ))}
        </div>
      )}

      {current === "details" && (
        <div className="grid gap-7">
          <Group label="How much experience do you have?">
            {EXPERIENCE.map((e) => (
              <Chip
                key={e}
                selected={d.experience_years === e}
                onClick={() => set("experience_years", e)}
              >
                {e}
              </Chip>
            ))}
          </Group>
          <Group label="When can you work?">
            {AVAILABILITY.map((a) => (
              <Chip
                key={a}
                selected={d.availability === a}
                onClick={() => set("availability", a)}
              >
                {a}
              </Chip>
            ))}
          </Group>
          <Group label="Do you have your own tools?">
            <Chip selected={d.has_tools === "yes"} onClick={() => set("has_tools", "yes")}>
              Yes
            </Chip>
            <Chip selected={d.has_tools === "no"} onClick={() => set("has_tools", "no")}>
              No
            </Chip>
          </Group>
        </div>
      )}
    </StepShell>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 font-medium">{label}</p>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  );
}

export function ProfileCreated() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-5 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="flex size-20 items-center justify-center rounded-full bg-success-soft">
        <Check className="size-10 text-success" strokeWidth={3} />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Profile created</h1>
      <p className="mt-1.5 text-muted-foreground">Setting things up…</p>
    </main>
  );
}
