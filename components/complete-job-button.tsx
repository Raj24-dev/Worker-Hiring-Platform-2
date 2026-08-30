"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { completeJob } from "@/actions/jobs";
import { Button } from "@/components/ui/button";

/** "Job gets done" — the step that opens mutual reviews. */
export function CompleteJobButton({ jobId }: { jobId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        <CheckCheck className="size-4.5" />
        Mark work as finished
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">Is this work finished?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The job closes and you and the workers can review each other.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await completeJob(jobId);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setConfirming(false);
              router.refresh();
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Yes, it is finished
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
