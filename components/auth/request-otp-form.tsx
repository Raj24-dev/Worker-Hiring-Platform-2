"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { sendOtp } from "@/actions/auth";
import { identifierSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function RequestOtpForm({ kind }: { kind: "phone" | "aadhaar" }) {
  const router = useRouter();
  const isPhone = kind === "phone";
  const max = isPhone ? 10 : 12;

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ value: string }>({
    resolver: zodResolver(identifierSchema(kind)),
    defaultValues: { value: "" },
  });

  // useWatch, not watch(): the latter cannot be memoized safely.
  const value = useWatch({ control, name: "value" });
  const display = isPhone ? value : value.replace(/(\d{4})(?=\d)/g, "$1 ");

  async function onSubmit(data: { value: string }) {
    const res = await sendOtp({ kind, value: data.value });
    if (!res.ok) {
      setError("value", { message: res.error });
      return;
    }
    router.push("/login/verify");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8">
      <Label htmlFor="value" className="text-sm font-medium">
        {isPhone ? "Mobile number" : "Aadhaar number"}
      </Label>

      <div
        className={cn(
          "mt-2 flex items-center overflow-hidden rounded-lg border bg-card shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          errors.value && "border-destructive focus-within:ring-destructive/20",
        )}
      >
        {isPhone && (
          <span className="shrink-0 border-r bg-secondary/60 px-3.5 py-3 text-base font-medium text-muted-foreground select-none">
            +91
          </span>
        )}
        <Input
          id="value"
          value={display}
          onChange={(e) =>
            setValue("value", e.target.value.replace(/\D/g, "").slice(0, max))
          }
          inputMode="numeric"
          autoComplete={isPhone ? "tel-national" : "off"}
          autoFocus
          placeholder={isPhone ? "98765 43210" : "1234 5678 9012"}
          aria-invalid={!!errors.value}
          aria-describedby={errors.value ? "value-error" : undefined}
          className="h-12 rounded-none border-0 bg-transparent px-3.5 text-base tracking-wider shadow-none focus-visible:ring-0 md:text-base"
        />
      </div>

      {errors.value ? (
        <p id="value-error" role="alert" className="mt-2 text-sm text-destructive">
          {errors.value.message}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {isPhone
            ? "We will send a one-time code to this number."
            : "Your Aadhaar number is never stored — only a secure code made from it."}
        </p>
      )}

      <Button
        type="submit"
        size="xl"
        className="mt-6 w-full"
        disabled={isSubmitting || value.length < max}
      >
        {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null}
        Send OTP
        {!isSubmitting && <ArrowRight className="size-5" />}
      </Button>
    </form>
  );
}
