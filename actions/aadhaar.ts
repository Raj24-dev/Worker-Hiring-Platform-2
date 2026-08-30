"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { aadhaarHash, maskFor } from "@/lib/identity";
import { OTP_COOKIE, issueOtp, verifyOtp } from "@/lib/otp";
import { getMe } from "@/lib/session";
import { aadhaarField, otpSchema } from "@/lib/validation";

/**
 * Aadhaar verification for someone who is already signed in — during worker
 * onboarding, or later from the profile.
 *
 * It runs the same two steps as the phone login (number, then a one-time code)
 * on the same signed, expiring cookie, because that is what a real UIDAI e-KYC
 * looks like: the number alone proves nothing, the OTP to the linked mobile is
 * the check. Only the delivery is simulated. See lib/demo.ts.
 */

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 5 * 60,
};

export async function sendAadhaarOtp(input: { aadhaar: string }) {
  const me = await getMe();
  if (!me) return { ok: false as const, error: "Please sign in again." };

  const digits = String(input.aadhaar ?? "").replace(/\D/g, "");
  const parsed = aadhaarField.safeParse(digits);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  // Fail here rather than after the code, so nobody types an OTP for a number
  // that was never going to be accepted.
  const hash = aadhaarHash(digits);
  const { data: taken } = await admin
    .from("profiles")
    .select("id")
    .eq("aadhaar_id", hash)
    .maybeSingle<{ id: string }>();

  if (taken && taken.id !== me.userId) {
    return { ok: false as const, error: "That Aadhaar number is already linked to another account." };
  }

  const { code, token } = issueOtp("aadhaar", digits);
  (await cookies()).set(OTP_COOKIE, token, COOKIE);

  // Swap this line for a UIDAI e-KYC call to make the verification real.
  console.log(`[karigaar] Aadhaar OTP ${code} -> ending ${digits.slice(-4)}`);

  return { ok: true as const, masked: maskFor("aadhaar", digits) };
}

export async function confirmAadhaarOtp(input: { code: string }) {
  const me = await getMe();
  if (!me) return { ok: false as const, error: "Please sign in again." };

  const parsed = otpSchema.safeParse({
    code: String(input.code ?? "").replace(/\D/g, ""),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const jar = await cookies();
  const result = verifyOtp(jar.get(OTP_COOKIE)?.value, parsed.data.code);

  if (!result.ok) {
    if (result.token) jar.set(OTP_COOKIE, result.token, COOKIE);
    return { ok: false as const, error: result.error };
  }
  if (result.kind !== "aadhaar") {
    return { ok: false as const, error: "That code was not for an Aadhaar check." };
  }
  jar.delete(OTP_COOKIE);

  // identityKey already reduced the number to its hash; the digits are gone.
  const hash = result.key.slice("aadhaar:".length);

  // Remembered on the auth user so onboarding can finish without asking again,
  // and so a later sign-in knows the check is done.
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, aadhaar_id: hash },
    });
  }

  // A profile only exists here when verifying from the profile page; during
  // onboarding it is written when the profile is created.
  if (me.profile) {
    const { error } = await admin
      .from("profiles")
      .update({ aadhaar_id: hash })
      .eq("id", me.userId);

    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, error: "That Aadhaar number is already linked to another account." };
      }
      return { ok: false as const, error: "Could not save the verification. Please try again." };
    }
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { ok: true as const };
}
