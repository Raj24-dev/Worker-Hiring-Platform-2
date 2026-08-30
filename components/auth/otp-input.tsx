"use client";

import { cn } from "@/lib/utils";

/**
 * One real input behind styled boxes. Keeps paste, SMS autofill and the numeric
 * keyboard working, which six separate inputs with focus juggling do not.
 */
export function OtpInput({
  value,
  onChange,
  length,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  length: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        disabled={disabled}
        maxLength={length}
        aria-label="One-time code"
        aria-invalid={invalid}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 disabled:cursor-not-allowed"
      />
      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, i) => {
          const active = !disabled && i === Math.min(value.length, length - 1) && value.length < length;
          return (
            <div
              key={i}
              className={cn(
                "flex h-14 w-11 items-center justify-center rounded-lg border-2 bg-card text-2xl font-semibold tabular-nums transition-all",
                invalid ? "border-destructive" : active ? "border-primary ring-4 ring-ring/15" : "border-input",
                disabled && "opacity-60",
              )}
            >
              {value[i] ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
