"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User } from "lucide-react";
import { createEmployerProfile } from "@/actions/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceCard, StepShell } from "./ui";
import { ProfileCreated } from "./worker-onboarding";

type EmployerType = "individual" | "company" | "";

export function EmployerOnboarding({ knownName = "" }: { knownName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [type, setType] = useState<EmployerType>("");
  const [name, setName] = useState(knownName);
  const [location, setLocation] = useState("");

  const isCompany = type === "company";
  const gates = [!!type, name.trim().length >= 2 && location.trim().length >= 2];

  async function onNext() {
    setError(null);
    if (step === 0) {
      setStep(1);
      return;
    }

    setBusy(true);
    const res = await createEmployerProfile({
      type: type as "individual" | "company",
      name,
      location,
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
      total={2}
      title={step === 0 ? "Who is hiring?" : isCompany ? "About your company" : "About you"}
      subtitle={
        step === 0
          ? "This is shown on every job you post."
          : "Workers will see this on your jobs."
      }
      onBack={step > 0 ? () => setStep(0) : undefined}
      onNext={onNext}
      nextDisabled={!gates[step]}
      nextLabel={step === 0 ? "Continue" : "Create my profile"}
      busy={busy}
      error={error}
    >
      {step === 0 ? (
        <div className="grid gap-2.5">
          <ChoiceCard
            selected={type === "individual"}
            onClick={() => setType("individual")}
            title="Individual"
            hint="Hiring for my home or my own work"
            icon={User}
          />
          <ChoiceCard
            selected={type === "company"}
            onClick={() => setType("company")}
            title="Company"
            hint="Hiring for a business or site"
            icon={Building2}
          />
        </div>
      ) : (
        <div className="grid gap-5">
          <div>
            <Label htmlFor="name">{isCompany ? "Company name" : "Your name"}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder={isCompany ? "Sharma Constructions" : "Ramesh Kumar"}
              className="mt-2 h-12 text-base md:text-base"
            />
          </div>
          <div>
            <Label htmlFor="location">City or area</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Andheri, Mumbai"
              className="mt-2 h-12 text-base md:text-base"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Workers nearby will see your jobs first.
            </p>
          </div>
        </div>
      )}
    </StepShell>
  );
}
