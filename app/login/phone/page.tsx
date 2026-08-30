import { AuthHeader } from "@/components/auth/auth-header";
import { RequestOtpForm } from "@/components/auth/request-otp-form";

export default function PhoneLoginPage() {
  return (
    <>
      <AuthHeader title="Enter your phone number" />
      <RequestOtpForm kind="phone" />
    </>
  );
}
