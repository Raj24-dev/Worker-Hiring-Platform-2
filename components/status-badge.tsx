import {
  CheckCircle2,
  Circle,
  Clock,
  PauseCircle,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = { label: string; icon: LucideIcon; className: string };

/** Plain words, not jargon — "Not selected" reads better than "rejected". */
const APPLICATION: Record<string, Tone> = {
  applied: {
    label: "Waiting for reply",
    icon: Clock,
    className: "bg-warning-soft text-accent-foreground",
  },
  on_hold: {
    label: "On hold",
    icon: PauseCircle,
    className: "bg-brand-soft text-primary",
  },
  hired: {
    label: "Hired",
    icon: CheckCircle2,
    className: "bg-success-soft text-success",
  },
  withdrawn: {
    label: "You cancelled",
    icon: Undo2,
    className: "bg-secondary text-secondary-foreground",
  },
  rejected: {
    label: "Not selected",
    icon: XCircle,
    className: "bg-danger-soft text-destructive",
  },
  completed: {
    label: "Work finished",
    icon: CheckCircle2,
    className: "bg-secondary text-secondary-foreground",
  },
};

const JOB: Record<string, Tone> = {
  open: { label: "Open", icon: Circle, className: "bg-success-soft text-success" },
  filled: { label: "All positions filled", icon: CheckCircle2, className: "bg-brand-soft text-primary" },
  completed: { label: "Work finished", icon: CheckCircle2, className: "bg-secondary text-secondary-foreground" },
};

export function StatusBadge({
  status,
  kind = "application",
  className,
}: {
  status: string | null;
  kind?: "application" | "job";
  className?: string;
}) {
  const tone = (kind === "job" ? JOB : APPLICATION)[status ?? ""];
  if (!tone) return null;
  const Icon = tone.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone.className,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {tone.label}
    </span>
  );
}
