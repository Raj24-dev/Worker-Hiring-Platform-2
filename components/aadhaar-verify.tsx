"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { confirmAadhaarOtp, sendAadhaarOtp } from "@/actions/aadhaar";
import { OTP_LENGTH } from "@/lib/validation";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Aadhaar verification, in the same two steps as the phone login: the number,
 * then the one-time code sent to the mobile linked to it. Used by worker
 * onboarding and by the profile page, so both behave identically.
 */
export function AadhaarVerify({
  onVerified,
  autoFocus = true,
}: {
  onVerified: () => void;
  autoFocus?: boolean;
}) {
  const [stage, setStage] = useState<"number" | "code" | "done">("number");
  const [aadhaar, setAadhaar] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState(false);

  useEffect(() => {
    if (!sentNotice) return;
    const t = setTimeout(() => setSentNotice(false), 4000);
    return () => clearTimeout(t);
  }, [sentNotice]);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await sendAadhaarOtp({ aadhaar });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMasked(res.masked);
    setCode("");
    setStage("code");
    setSentNotice(true);
  }

  async function confirm(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await confirmAadhaarOtp({ code: value });
    if (!res.ok) {
      setError(res.error);
      setCode("");
      setBusy(false);
      return;
    }
    setStage("done");
    onVerified();
  }

  if (stage === "done") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft px-4 py-3.5"
        role="status"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-5" strokeWidth={3} />
        </span>
        <div>
          <p className="font-medium text-success">Aadhaar verified</p>
          <p className="text-sm text-muted-foreground">
            Employers will see that your identity is confirmed.
          </p>
        </div>
      </div>
    );
  }

  if (stage === "code") {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Enter the code sent to the mobile linked with{" "}
          <span className="font-medium text-foreground">{masked}</span>
        </p>

        <div className="mt-3 flex min-h-9 items-center justify-center">
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

        <div className="mt-4">
          <OtpInput
            value={code}
            onChange={(v) => {
              setError(null);
              setCode(v);
              if (v.length === OTP_LENGTH) void confirm(v);
            }}
            length={OTP_LENGTH}
            disabled={busy}
            invalid={!!error}
          />
        </div>

        <div className="mt-3 flex min-h-6 items-center justify-center text-sm">
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
          size="sm"
          className="mt-2"
          disabled={busy}
          onClick={() => {
            setStage("number");
            setError(null);
          }}
        >
          <RotateCcw className="size-4" />
          Use a different number
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor="aadhaar">Aadhaar number</Label>
      <Input
        id="aadhaar"
        value={aadhaar.replace(/(\d{4})(?=\d)/g, "$1 ")}
        onChange={(e) => {
          setError(null);
          setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12));
        }}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder="1234 5678 9012"
        aria-invalid={!!error}
        className="mt-2 h-12 text-base tracking-wider md:text-base"
      />

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          Your number is never saved. We keep only a secure code made from it, so
          employers can see you are verified.
        </p>
      )}

      <Button
        type="button"
        className="mt-4 w-full"
        size="lg"
        disabled={aadhaar.length !== 12 || busy}
        onClick={() => void send()}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : null}
        Send OTP
        {!busy && <ArrowRight className="size-5" />}
      </Button>
    </div>
  );
}
