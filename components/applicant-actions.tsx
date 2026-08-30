"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { hireApplicant, rejectApplicant } from "@/actions/applications";
import { Button } from "@/components/ui/button";

/** Accept / reject, straight from the hiring flow in the sketch. */
export function ApplicantActions({
  applicationId,
  status,
}: {
  applicationId: number;
  status: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (id: number) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn(applicationId);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });

  if (status === "completed") return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        <Button
          type="button"
          size="lg"
          className="flex-1"
          disabled={pending || status === "hired"}
          onClick={() => run(hireApplicant)}
        >
          {pending ? <Loader2 className="size-4.5 animate-spin" /> : <Check className="size-4.5" />}
          {status === "hired" ? "Hired" : "Hire this worker"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="flex-1 text-destructive hover:bg-danger-soft hover:text-destructive"
          disabled={pending || status === "rejected"}
          onClick={() => run(rejectApplicant)}
        >
          <X className="size-4.5" />
          {status === "rejected" ? "Rejected" : "Reject"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
