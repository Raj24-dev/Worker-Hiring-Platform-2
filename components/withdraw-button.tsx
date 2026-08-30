"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { withdrawFromJob } from "@/actions/applications";
import { Button } from "@/components/ui/button";

/**
 * Cancelling a job you accepted. This is the reason held applications are
 * parked instead of deleted, so the copy says so plainly.
 */
export function WithdrawButton({
  applicationId,
  heldCount,
}: {
  applicationId: number;
  heldCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Undo2 className="size-4" />
        Cancel this job
      </Button>
    );
  }

  return (
    <div className="rounded-lg bg-danger-soft p-4">
      <p className="text-sm font-medium text-destructive">Cancel this job?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The employer will be told and the position opens again.
        {heldCount > 0 &&
          ` Your ${heldCount} paused ${heldCount === 1 ? "application" : "applications"} will go back to the ${heldCount === 1 ? "employer" : "employers"}.`}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await withdrawFromJob(applicationId);
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
          Yes, cancel it
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep the job
        </Button>
      </div>
    </div>
  );
}
