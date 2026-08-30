/**
 * Identity verification in this build is simulated.
 *
 * There is no SMS gateway behind the phone OTP and no UIDAI licence behind the
 * Aadhaar check — neither is something an application can simply call. Every
 * screen, cookie, expiry and attempt limit around them is real; only the
 * delivery of the code is not. So the flow behaves exactly as it will in
 * production, and swapping in a gateway is one function body.
 *
 * While this is on:
 *   - every one-time code is DEMO_CODE, and it is never shown on screen
 *   - an Aadhaar number is accepted on its length, not its checksum, because
 *     the obvious numbers people type in a demo (1234 5678 9012) fail the real
 *     one — only about 11% of 12-digit numbers pass Verhoeff
 *
 * Set NEXT_PUBLIC_DEMO_MODE=false to restore random codes and the real Aadhaar
 * checksum. That does not add an SMS gateway, so sign-in would then only work
 * for someone reading the server log.
 *
 * Read through a function, not a constant, so it can be exercised both ways in
 * tests rather than being frozen at import time.
 */
export const demoMode = () => process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

/** The one-time code accepted everywhere while demo mode is on. */
export const DEMO_CODE = "9254";
