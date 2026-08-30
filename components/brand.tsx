import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Hammer style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-2xl font-semibold tracking-tight text-foreground", className)}>
      Karigaar
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Logo size={38} />
      <Wordmark className="text-xl" />
    </div>
  );
}
