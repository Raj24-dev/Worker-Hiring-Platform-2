import { Stars } from "@/components/page-bits";
import { timeAgo } from "@/lib/format";
import type { ReviewWithAuthor } from "@/lib/queries";

/**
 * What makes a rating trustworthy is being able to see who said it and when.
 * Used on both sides: the employer reads these on an applicant, and the worker
 * reads the employer's before applying.
 */
export function ReviewList({
  reviews,
  empty,
}: {
  reviews: ReviewWithAuthor[];
  empty: string;
}) {
  if (!reviews.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="divide-y">
      {reviews.map((r) => (
        <li key={r.id} className="py-3.5 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.author}</p>
              <div className="mt-0.5">
                <Stars value={r.rating} />
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(r.created_at)}
            </span>
          </div>
          {r.comment && (
            <p className="mt-2 leading-relaxed text-pretty">{r.comment}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The headline number: average of real reviews, never a default. */
export function ratingFrom(reviews: { rating: number }[]) {
  if (!reviews.length) return null;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}
