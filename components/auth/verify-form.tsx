"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { confirmOtp, resendOtp } from "@/actions/auth";
import { OTP_LENGTH } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { OtpInput } from "./otp-input";

export function VerifyForm({ masked }: { masked: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  /** Mirrors a real send: confirm it went out, then get out of the way. */
  const [sentNotice, setSentNotice] = useState(true);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!sentNotice) return;
    const t = setTimeout(() => setSentNotice(false), 4000);
    return () => clearTimeout(t);
  }, [sentNotice]);

  /** Fired from the input's own change event once the last digit lands, rather
   *  than from an effect watching the value. */
  async function submit(value: string) {
    if (busy || verified) return;
    setBusy(true);
    setError(null);

    const res = await confirmOtp({ code: value });
    if (!res.ok) {
      setError(res.error);
      setCode("");
      setBusy(false);
      return;
    }
    setVerified(true);
    setTimeout(() => router.replace(res.next), 1100);
  }

  async function onResend() {
    setBusy(true);
    setError(null);
    const res = await resendOtp();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCode("");
    setCooldown(30);
    setSentNotice(true);
  }

  if (verified) {
    return (
      <div className="flex flex-col items-center py-10 text-center" role="status" aria-live="polite">
        <span className="flex size-20 items-center justify-center rounded-full bg-success-soft">
          <Check className="size-10 text-success" strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Account verified</h1>
        <p className="mt-1.5 text-muted-foreground">Taking you in…</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Enter the OTP</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sent to <span className="font-medium text-foreground">{masked}</span>
      </p>

      <div className="mt-4 flex min-h-9 items-center justify-center">
        {sentNotice && (
          <p
            role="status"
            className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3.5 py-2 text-sm font-medium text-success"
          >
            <Check className="size-4" strokeWidth={3} />
            OTP sent successfully
          </p>
        )}
      </div>

      <div className="mt-8">
        <OtpInput
          value={code}
          onChange={(v) => {
            setError(null);
            setCode(v);
            if (v.length === OTP_LENGTH) void submit(v);
          }}
          length={OTP_LENGTH}
          disabled={busy}
          invalid={!!error}
        />
      </div>

      <div className="mt-3 flex min-h-6 items-center justify-center gap-2 text-sm">
        {busy && !error ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking…
          </span>
        ) : error ? (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onResend}
        disabled={busy || cooldown > 0}
        className="mt-5"
      >
        <RotateCcw className="size-4" />
        {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
      </Button>
    </div>
  );
}
