import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { identityKey, maskFor, type LoginKind } from "./identity";
import { OTP_LENGTH } from "./validation";
import { DEMO_CODE, demoMode } from "./demo";

export const OTP_COOKIE = "karigaar_otp";
const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

/** See lib/demo.ts: the code is fixed while the delivery of it is simulated. */
function nextCode() {
  if (demoMode() && DEMO_CODE.length === OTP_LENGTH) return DEMO_CODE;
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** k = how they signed in, key = stable account id, m = masked display,
 *  h = HMAC of the code (the code itself is never stored), n = attempts. */
type Sealed = { k: LoginKind; key: string; m: string; h: string; exp: number; n: number };

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
};

const mac = (body: string) =>
  createHmac("sha256", secret()).update(body).digest("base64url");

const codeHash = (key: string, code: string) =>
  createHmac("sha256", secret()).update(`${key}:${code}`).digest("base64url");

const eq = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function seal(p: Sealed) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${mac(body)}`;
}

function unseal(token: string | undefined): Sealed | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !eq(sig, mac(body))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as Sealed;
  } catch {
    return null;
  }
}

export function issueOtp(kind: LoginKind, rawValue: string) {
  const key = identityKey(kind, rawValue);
  const code = nextCode();
  const token = seal({
    k: kind,
    key,
    m: maskFor(kind, rawValue),
    h: codeHash(key, code),
    exp: Date.now() + TTL_MS,
    n: 0,
  });
  return { code, token };
}

/**
 * "Resend OTP". The raw phone/Aadhaar is long gone by now — only the sealed
 * key remains — so a fresh code is minted against the same key. A short grace
 * window past expiry keeps the button working on a slow screen.
 */
export function reissueOtp(token: string | undefined) {
  const p = unseal(token);
  if (!p || Date.now() > p.exp + 15 * 60_000) return null;
  const code = nextCode();
  return {
    code,
    token: seal({ ...p, h: codeHash(p.key, code), exp: Date.now() + TTL_MS, n: 0 }),
  };
}

/** For the OTP screen's "we sent a code to ..." line. */
export function peekOtp(token: string | undefined) {
  const p = unseal(token);
  if (!p || Date.now() > p.exp) return null;
  return { kind: p.k, masked: p.m };
}

export type OtpResult =
  | { ok: true; kind: LoginKind; key: string }
  | { ok: false; error: string; token?: string };

const EXPIRED = "That code has expired. Please request a new one.";
const BURNT = "Too many wrong attempts. Please request a new code.";

export function verifyOtp(token: string | undefined, code: string): OtpResult {
  const p = unseal(token);
  if (!p || Date.now() > p.exp) return { ok: false, error: EXPIRED };
  if (p.n >= MAX_ATTEMPTS) return { ok: false, error: BURNT };

  if (eq(codeHash(p.key, code.trim()), p.h)) return { ok: true, kind: p.k, key: p.key };

  const left = MAX_ATTEMPTS - (p.n + 1);
  return {
    ok: false,
    error: left > 0 ? `Incorrect code. ${left} ${left === 1 ? "try" : "tries"} left.` : BURNT,
    // ponytail: the attempt counter rides in the signed cookie, so a captured
    // older cookie could reset it. Move the counter to Postgres/Redis if this
    // ever faces real traffic behind a real SMS gateway.
    token: seal({ ...p, n: p.n + 1 }),
  };
}
