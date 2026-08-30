"use client";

import {
  ArrowLeft,
  Car,
  Check,
  Factory,
  HardHat,
  Home,
  Loader2,
  ShieldCheck,
  Sprout,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DOMAIN_ICONS: Record<string, LucideIcon> = {
  HardHat,
  Car,
  Home,
  Wrench,
  Factory,
  UtensilsCrossed,
  Sprout,
  ShieldCheck,
};

export function StepShell({
  step,
  total,
  title,
  subtitle,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
  busy,
  error,
  children,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  busy?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-background/90 px-5 pt-5 pb-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            aria-label="Go back"
            className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:invisible"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={total}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${(step / total) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {step}/{total}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-5 pb-40">
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-lg">
          {error && (
            <p role="alert" className="mb-2.5 text-center text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="button"
            size="xl"
            className="w-full"
            onClick={onNext}
            disabled={nextDisabled || busy}
          >
            {busy && <Loader2 className="size-5 animate-spin" />}
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChoiceCard({
  selected,
  onClick,
  title,
  hint,
  icon: Icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-xl border-2 bg-card p-4 text-left transition-all",
        selected
          ? "border-primary bg-brand-soft ring-4 ring-ring/10"
          : "border-border hover:border-primary/40",
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors",
            selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className="size-5.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {selected && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-all",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/40",
      )}
    >
      {selected && <Check className="size-3.5" strokeWidth={3.5} />}
      {children}
    </button>
  );
}
