import Link from "next/link";
import { ArrowLeft, Star, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  back?: { href: string; label?: string };
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link
          href={back.href}
          className="mb-3 -ml-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.label ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-7" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stars({
  value,
  count,
  className,
}: {
  value: number | null;
  count?: number;
  className?: string;
}) {
  if (value == null) {
    return <span className={cn("text-sm text-muted-foreground", className)}>No ratings yet</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-4",
              i <= Math.round(value)
                ? "fill-warning text-warning"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      <span className="text-sm font-medium">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-sm text-muted-foreground">
          ({count} review{count === 1 ? "" : "s"})
        </span>
      )}
      <span className="sr-only">{value.toFixed(1)} out of 5</span>
    </span>
  );
}

export function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-0.5 font-medium break-words">{value}</div>
      </div>
    </div>
  );
}
