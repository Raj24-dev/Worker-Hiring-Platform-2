"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { submitReview } from "@/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Stars } from "@/components/page-bits";
import { cn } from "@/lib/utils";

export function ReviewForm({
  jobId,
  revieweeId,
  revieweeName,
  existingRating,
  existingComment,
}: {
  jobId: number;
  revieweeId: string;
  revieweeName: string;
  existingRating?: number | null;
  existingComment?: string | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingRating ?? 0);
  const [comment, setComment] = useState(existingComment ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingRating && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-4 py-3">
        <span className="text-sm text-muted-foreground">You rated {revieweeName}</span>
        <div className="flex items-center gap-3">
          <Stars value={existingRating} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
        </div>
      </div>
    );
  }

  async function onSubmit() {
    setError(null);
    if (rating < 1) {
      setError("Please pick a rating.");
      return;
    }
    setBusy(true);
    const res = await submitReview(jobId, revieweeId, { rating, comment });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="font-medium">How was working with {revieweeName}?</p>

      <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            className="rounded-md p-1 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "size-8",
                n <= rating ? "fill-warning text-warning" : "fill-transparent text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label htmlFor={`remark-${jobId}-${revieweeId}`} className="text-sm font-medium">
          Remark
        </label>
        <Textarea
          id={`remark-${jobId}-${revieweeId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="What was it like working with them? (optional)"
          className="mt-2 text-base md:text-base"
        />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="button" onClick={onSubmit} disabled={busy} className="mt-3 w-full sm:w-auto">
        {busy && <Loader2 className="size-4 animate-spin" />}
        Save review
      </Button>
    </div>
  );
}
