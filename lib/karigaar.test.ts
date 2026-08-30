/**
 * The logic that would silently do the wrong thing if it broke: the Aadhaar
 * checksum, the signed OTP challenge, and the money/proximity formatting.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "vitest";

import { verhoeff, otpSchema, OTP_LENGTH } from "@/lib/validation";
import { issueOtp, verifyOtp, peekOtp, reissueOtp } from "@/lib/otp";
import { DEMO_CODE } from "@/lib/demo";
import { identityKey, emailForKey, aadhaarIdFromKey, maskFor } from "@/lib/identity";
import { pay, proximity, timeAgo } from "@/lib/format";

test("verhoeff accepts valid Aadhaar and rejects typos", () => {
  assert.equal(verhoeff("222333444555"), true);
  assert.equal(verhoeff("987654321012"), true);
  // A single transposed digit must fail — that is the whole point of the check.
  assert.equal(verhoeff("222333444556"), false);
  assert.equal(verhoeff("223233444555"), false);
  assert.equal(verhoeff("12345"), false);
  assert.equal(verhoeff(""), false);
});

test("otpSchema demands exactly OTP_LENGTH digits", () => {
  assert.equal(otpSchema.safeParse({ code: "1".repeat(OTP_LENGTH) }).success, true);
  assert.equal(otpSchema.safeParse({ code: "1".repeat(OTP_LENGTH - 1) }).success, false);
  // Regression: the regex was once built from a template literal, so `\d`
  // collapsed to "d" and letters passed.
  assert.equal(otpSchema.safeParse({ code: "d".repeat(OTP_LENGTH) }).success, false);
  assert.equal(otpSchema.safeParse({ code: "abcd" }).success, false);
});

test("a correct OTP verifies and a wrong one does not", () => {
  const { code, token } = issueOtp("phone", "9876543210");
  assert.equal(code.length, OTP_LENGTH);

  const decoy = "0".repeat(OTP_LENGTH);
  const wrong = verifyOtp(token, code === decoy ? "1".repeat(OTP_LENGTH) : decoy);
  assert.equal(wrong.ok, false);

  const right = verifyOtp(token, code);
  assert.equal(right.ok, true);
  if (right.ok) assert.equal(right.key, "phone:9876543210");
});

test("demo mode fixes the code; turning it off makes it unpredictable", () => {
  // On — the default for this build, because there is no SMS to receive.
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
  const demo = issueOtp("phone", "9876543210");
  assert.equal(demo.code, DEMO_CODE, "the documented demo code");
  assert.equal(demo.code.length, OTP_LENGTH);
  assert.equal(verifyOtp(demo.token, DEMO_CODE).ok, true);

  // Off — random, which is the only thing standing between "sign in with a
  // phone number" and "sign in as anyone".
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  const codes = new Set(
    Array.from({ length: 30 }, () => issueOtp("phone", "9876543210").code),
  );
  assert.ok(codes.size > 1, "codes must vary with demo mode off");
  for (const c of codes) {
    assert.match(c, /^\d+$/);
    assert.equal(c.length, OTP_LENGTH);
  }
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
});

test("the OTP cookie is tamper-evident and never carries the code", () => {
  const { code, token } = issueOtp("phone", "9876543210");
  const [body] = token.split(".");
  const decoded = Buffer.from(body, "base64url").toString();

  assert.equal(decoded.includes(code), false, "the code itself must not be in the cookie");

  // Flipping the payload invalidates the signature.
  const forged = `${Buffer.from(decoded.replace("9876543210", "9999999999")).toString("base64url")}.${token.split(".")[1]}`;
  assert.equal(verifyOtp(forged, code).ok, false);
});

test("wrong attempts run out", () => {
  let token = issueOtp("phone", "9876543210").token;
  for (let i = 0; i < 5; i++) {
    const res = verifyOtp(token, "0".repeat(OTP_LENGTH));
    assert.equal(res.ok, false);
    if (!res.ok && res.token) token = res.token;
  }
  const burnt = verifyOtp(token, "0".repeat(OTP_LENGTH));
  assert.equal(burnt.ok, false);
  if (!burnt.ok) assert.match(burnt.error, /Too many/);
});

test("resend keeps the account but retires the previous code", () => {
  // Checked with demo mode off, where consecutive codes actually differ.
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  const first = issueOtp("aadhaar", "222333444555");
  const again = reissueOtp(first.token);
  assert.ok(again);
  assert.equal(verifyOtp(again.token, first.code).ok, false, "the old code must stop working");
  assert.equal(verifyOtp(again.token, again.code).ok, true);
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
});

test("raw Aadhaar never survives into the key, email or mask", () => {
  const raw = "222333444555";
  const key = identityKey("aadhaar", raw);
  assert.equal(key.includes(raw), false);
  assert.equal(emailForKey(key).includes(raw), false);
  assert.equal(aadhaarIdFromKey(key)?.length, 64, "stored value is a sha-256 hash");
  // The mask shows only the last four, which the user just typed anyway.
  assert.equal(maskFor("aadhaar", raw), "•••• •••• 4555");

  const peeked = peekOtp(issueOtp("aadhaar", raw).token);
  assert.equal(peeked?.masked.includes(raw), false);
});

test("phone and Aadhaar logins are different accounts", () => {
  assert.notEqual(
    identityKey("phone", "9876543210"),
    identityKey("aadhaar", "222333444555"),
  );
  // With or without the country code must be the same account, never two.
  assert.equal(identityKey("phone", "+91 98765 43210"), "phone:9876543210");
  assert.equal(identityKey("phone", "9876543210"), "phone:9876543210");
  assert.equal(identityKey("phone", "919876543210"), "phone:9876543210");
});

test("pay reads the way the card should", () => {
  assert.equal(pay({ salary: 800, payment_type: "per_day" }), "₹800 per day");
  assert.equal(pay({ salary: 25000, payment_type: "per_month" }), "₹25,000 per month");
  assert.equal(pay({ salary: null, payment_type: "per_day" }), "—");
});

test("proximity only claims nearness it can justify", () => {
  assert.equal(proximity("Andheri, Mumbai", "Andheri"), "Near you");
  assert.equal(proximity("Andheri", "Andheri, Mumbai"), "Near you");

  // A worker who works two neighbouring areas still matches either of them.
  // Substring matching missed this, which silently killed job alerts.
  assert.equal(proximity("Andheri, Mumbai", "Andheri and Jogeshwari, Mumbai"), "Near you");
  assert.equal(proximity("Jogeshwari West", "Andheri and Jogeshwari, Mumbai"), "Near you");

  assert.equal(proximity("Andheri, Mumbai", "Jaipur"), null);
  // "and" must not be what makes two unrelated places match.
  assert.equal(proximity("Chand Nagar", "Jaipur and Ajmer"), null);
  assert.equal(proximity(null, "Andheri"), null);
  assert.equal(proximity("Andheri", null), null);
  assert.equal(proximity("", "Andheri"), null);
});

test("timeAgo treats a naive timestamp as UTC", () => {
  const now = new Date();
  const tenMinsAgo = new Date(now.getTime() - 10 * 60_000)
    .toISOString()
    .replace("Z", "");
  assert.equal(timeAgo(tenMinsAgo), "10 min ago");
  assert.equal(timeAgo(null), "");
});
