import { AuthHeader } from "@/components/auth/auth-header";
import { RequestOtpForm } from "@/components/auth/request-otp-form";

export default function AadhaarLoginPage() {
  return (
    <>
      <AuthHeader title="Enter 12 digit UID number" />
      <RequestOtpForm kind="aadhaar" />
    </>
  );
}
