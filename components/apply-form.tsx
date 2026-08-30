"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { applyToJob } from "@/actions/applications";
import { APPLICATION_QUESTIONS, applicationSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { z } from "zod";

type Values = z.input<typeof applicationSchema>;

export function ApplyForm({ jobId, jobTitle }: { jobId: number; jobTitle: string }) {
  const router = useRouter();
  const [sent, setSent] = useState<null | { onHold: boolean }>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { experience: "", availability: "", expected_pay: "", why: "" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await applyToJob(jobId, values);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSent({ onHold: !!res.onHold });
    setTimeout(() => router.replace("/applied"), res.onHold ? 2600 : 1200);
  }

  if (sent) {
    return (
      <div className="rounded-xl border bg-card px-6 py-14 text-center" role="status" aria-live="polite">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft">
          <Check className="size-8 text-success" strokeWidth={3} />
        </span>
        <p className="mt-5 text-lg font-semibold">Application sent</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          {sent.onHold
            ? "You are already hired for another job, so this one is on hold. It goes to the employer as soon as that work is finished."
            : "The employer will see your profile and reply."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <p className="mb-5 rounded-lg bg-secondary/70 px-4 py-3 text-sm">
        Applying for <span className="font-semibold">{jobTitle}</span>
      </p>

      <div className="grid gap-6">
        {APPLICATION_QUESTIONS.map((q, i) => {
          const fieldError = errors[q.key];
          return (
            <div key={q.key}>
              <Label htmlFor={q.key} className="items-start gap-2 text-base leading-snug">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                {q.label}
              </Label>
              <Textarea
                id={q.key}
                {...register(q.key)}
                rows={3}
                aria-invalid={!!fieldError}
                className="mt-2.5 text-base md:text-base"
              />
              {fieldError && (
                <p role="alert" className="mt-1.5 text-sm text-destructive">
                  {fieldError.message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="xl" className="mt-6 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-5 animate-spin" />}
        Send application
      </Button>
    </form>
  );
}
