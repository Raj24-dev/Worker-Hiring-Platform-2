"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { admin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import {
  aadhaarIdFromKey,
  emailForKey,
  localPhone,
  passwordForKey,
  phoneFromKey,
  type LoginKind,
} from "@/lib/identity";
import { OTP_COOKIE, issueOtp, reissueOtp, verifyOtp } from "@/lib/otp";
import { aadhaarField, otpSchema, phoneField } from "@/lib/validation";
import { getMe, landingFor } from "@/lib/session";
import type { Profile } from "@/lib/types";

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 5 * 60,
};


export async function sendOtp(input: { kind: LoginKind; value: string }) {
  // Normalise the same way identityKey will, so "+91…" and a bare number are
  // one account. The UI caps input at 10 digits; this action is public.
  const raw = String(input.value ?? "");
  const value = input.kind === "phone" ? localPhone(raw) : raw.replace(/\D/g, "");
  const parsed = (input.kind === "phone" ? phoneField : aadhaarField).safeParse(value);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { code, token } = issueOtp(input.kind, value);
  (await cookies()).set(OTP_COOKIE, token, COOKIE);

  // No SMS gateway is wired up. Replace this one line with a gateway call and
  // the rest of the flow is unchanged. The code is never returned to the
  // browser, so the screen behaves exactly as it will in production.
  console.log(`[karigaar] OTP ${code} -> ${input.kind} ending ${value.slice(-4)}`);

  return { ok: true as const };
}

export async function resendOtp() {
  const jar = await cookies();
  const next = reissueOtp(jar.get(OTP_COOKIE)?.value);
  if (!next) return { ok: false as const, error: "That request expired. Please start again." };

  jar.set(OTP_COOKIE, next.token, COOKIE);
  console.log(`[karigaar] OTP resent: ${next.code}`);

  return { ok: true as const };
}

export async function confirmOtp(input: { code: string }) {
  const parsed = otpSchema.safeParse({ code: String(input.code ?? "").replace(/\D/g, "") });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const jar = await cookies();
  const result = verifyOtp(jar.get(OTP_COOKIE)?.value, parsed.data.code);

  if (!result.ok) {
    if (result.token) jar.set(OTP_COOKIE, result.token, COOKIE);
    return { ok: false as const, error: result.error };
  }
  jar.delete(OTP_COOKIE);

  const email = emailForKey(result.key);
  const password = passwordForKey(result.key);
  const aadhaar = aadhaarIdFromKey(result.key);
  const phone = phoneFromKey(result.key);
  const sb = await supabaseServer();

  let { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    // First time through this door: mint the account, then sign in.
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { login_kind: result.kind, aadhaar_id: aadhaar, phone },
    });
    if (createErr && !/already|registered/i.test(createErr.message)) {
      return { ok: false as const, error: "Could not sign you in. Please try again." };
    }
    ({ error } = await sb.auth.signInWithPassword({ email, password }));
  }
  if (error) return { ok: false as const, error: "Could not sign you in. Please try again." };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false as const, error: "Could not sign you in. Please try again." };

  // Signing in with Aadhaar is itself the Aadhaar verification step, so the
  // worker is not asked for the number a second time during onboarding.
  if (aadhaar && user.user_metadata?.aadhaar_id !== aadhaar) {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, aadhaar_id: aadhaar },
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { ok: true as const, next: await landingFor(user.id, profile) };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

/** "delete acc" on the profile sketch. Explicit, in dependency order. */
export async function deleteAccount() {
  const me = await getMe();
  if (!me) redirect("/login");
  const id = me.userId;

  await admin.from("reviews").delete().or(`reviewer_id.eq.${id},reviewee_id.eq.${id}`);

  if (me.profile?.role === "employer") {
    const { data: employer } = await admin
      .from("employers")
      .select("id")
      .eq("profile_id", id)
      .maybeSingle<{ id: number }>();
    if (employer) {
      const { data: jobs } = await admin
        .from("jobs")
        .select("id")
        .eq("employer_id", employer.id);
      const jobIds = (jobs ?? []).map((j) => j.id);
      if (jobIds.length) await admin.from("applications").delete().in("job_id", jobIds);
      await admin.from("jobs").delete().eq("employer_id", employer.id);
      await admin.from("employers").delete().eq("id", employer.id);
    }
  } else {
    await admin.from("applications").delete().eq("worker_id", id);
    await admin.from("certificates").delete().eq("worker_id", id);
    await admin.from("workers").delete().eq("id", id);
  }

  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);

  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
