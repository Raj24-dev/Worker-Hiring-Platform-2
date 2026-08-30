"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { createJob } from "@/actions/jobs";
import { DOMAINS } from "@/lib/domains";
import { jobSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = z.input<typeof jobSchema>;

export function PostJobForm({ defaultLocation }: { defaultLocation: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      skill: "",
      salary: undefined,
      payment_type: "per_day",
      job_type: "temporary",
      openings: 1,
      location: defaultLocation,
      description: "",
    },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await createJob(values);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.replace(`/posted/${res.jobId}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <Field label="Job title" htmlFor="title" error={errors.title?.message}>
        <Input
          id="title"
          {...register("title")}
          autoFocus
          placeholder="Mason needed for house work"
          className="h-12 text-base md:text-base"
        />
      </Field>

      <Field label="Type of work" htmlFor="skill" error={errors.skill?.message}>
        {/* A native select gives the OS picker on a phone, which is far easier
            to use than a custom dropdown. */}
        <select id="skill" {...register("skill")} className="field-select" defaultValue="">
          <option value="" disabled>
            Choose the work
          </option>
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Amount you will pay" htmlFor="salary" error={errors.salary?.message}>
          <div className="flex items-center overflow-hidden rounded-md border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="border-r bg-secondary/60 px-3.5 py-3 text-base font-medium text-muted-foreground">
              ₹
            </span>
            <Input
              id="salary"
              type="number"
              inputMode="numeric"
              min={1}
              {...register("salary", { valueAsNumber: true })}
              placeholder="800"
              className="h-11 rounded-none border-0 text-base shadow-none focus-visible:ring-0 md:text-base"
            />
          </div>
        </Field>

        <Field label="Paid" htmlFor="payment_type" error={errors.payment_type?.message}>
          <select id="payment_type" {...register("payment_type")} className="field-select">
            <option value="per_day">Per day</option>
            <option value="per_hour">Per hour</option>
            <option value="per_month">Per month</option>
            <option value="fixed">Fixed total</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Job type" htmlFor="job_type" error={errors.job_type?.message}>
          <select id="job_type" {...register("job_type")} className="field-select">
            <option value="temporary">Temporary</option>
            <option value="permanent">Permanent</option>
          </select>
        </Field>

        <Field label="How many workers?" htmlFor="openings" error={errors.openings?.message}>
          <Input
            id="openings"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            {...register("openings", { valueAsNumber: true })}
            className="h-11 text-base md:text-base"
          />
        </Field>
      </div>

      <Field label="Address" htmlFor="location" error={errors.location?.message}>
        <Input
          id="location"
          {...register("location")}
          placeholder="Andheri, Mumbai"
          className="h-12 text-base md:text-base"
        />
      </Field>

      <Field
        label="Anything else workers should know?"
        htmlFor="description"
        error={errors.description?.message}
        optional
      >
        <Textarea
          id="description"
          {...register("description")}
          rows={3}
          placeholder="Work timing, what to bring, how many days…"
          className="text-base md:text-base"
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="size-5 animate-spin" />}
        Post this job
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      <div className="mt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
