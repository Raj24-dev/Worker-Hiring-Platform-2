import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthHeader } from "@/components/auth/auth-header";
import { VerifyForm } from "@/components/auth/verify-form";
import { OTP_COOKIE, peekOtp } from "@/lib/otp";

export default async function VerifyPage() {
  const challenge = peekOtp((await cookies()).get(OTP_COOKIE)?.value);
  if (!challenge) redirect("/login");

  return (
    <>
      <AuthHeader back={challenge.kind === "phone" ? "/login/phone" : "/login/aadhaar"} />
      <VerifyForm masked={challenge.masked} />
    </>
  );
}
