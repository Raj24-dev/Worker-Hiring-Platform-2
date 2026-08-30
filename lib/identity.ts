import "server-only";
import { createHash, createHmac } from "crypto";

export type LoginKind = "phone" | "aadhaar";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/**
 * Aadhaar numbers are never stored raw — not in the database, not in the OTP
 * cookie, nowhere. Only this hash survives the request that typed the number,
 * because holding raw Aadhaar is a legal problem in India.
 */
export const aadhaarHash = (uid: string) =>
  createHash("sha256").update(`karigaar:${uid.replace(/\D/g, "")}`).digest("hex");

/**
 * Indian mobile numbers arrive with or without the country code. Keying on the
 * last ten digits means "+91 98765 43210" and "9876543210" are one account,
 * not two.
 */
export const localPhone = (raw: string) => raw.replace(/\D/g, "").slice(-10);

/**
 * The single stable identifier for an account, whichever door it came in
 * through. Everything downstream keys off this string, so the raw input can be
 * discarded the moment it is built.
 */
export function identityKey(kind: LoginKind, rawValue: string) {
  return kind === "phone"
    ? `phone:${localPhone(rawValue)}`
    : `aadhaar:${aadhaarHash(rawValue)}`;
}

/** What the user sees on the OTP screen, so they know where it went. */
export function maskFor(kind: LoginKind, rawValue: string) {
  return kind === "phone"
    ? `+91 •••••${localPhone(rawValue).slice(-5)}`
    : `•••• •••• ${rawValue.replace(/\D/g, "").slice(-4)}`;
}

/**
 * Supabase reports phone auth disabled and has no SMS credentials, so accounts
 * live on email auth behind a synthetic address — the pattern already present
 * in this database. Nothing is ever mailed to it.
 */
export function emailForKey(key: string) {
  const [kind, v] = key.split(":");
  return kind === "phone" ? `p${v}@karigaar.app` : `a${v.slice(0, 32)}@karigaar.app`;
}

/** Derived server-side, never shown to the user, never sent to the client. */
export const passwordForKey = (key: string) =>
  createHmac("sha256", secret()).update(key).digest("hex");

/** The phone behind a phone-login key, so onboarding can prefill contact. */
export const phoneFromKey = (key: string) =>
  key.startsWith("phone:") ? key.slice("phone:".length) : null;

/** What goes in profiles.aadhaar_id — the hash, never the number. */
export const aadhaarIdFromKey = (key: string) =>
  key.startsWith("aadhaar:") ? key.slice("aadhaar:".length) : null;
