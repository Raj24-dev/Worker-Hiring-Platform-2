import { z } from "zod";
import { demoMode } from "./demo";

/** Four boxes, as the sketch draws them. The OTP screen renders exactly this many. */
export const OTP_LENGTH = 4;

// prettier-ignore
const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
];
// prettier-ignore
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

/** Aadhaar's real checksum. Catches mistyped digits before we mint an account. */
export function verhoeff(num: string) {
  const digits = num.replace(/\D/g, "");
  if (digits.length !== 12) return false;
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][Number(rev[i])]];
  return c === 0;
}

/* Inputs strip non-digits as the user types, and the server strips again
   before parsing, so these stay plain string schemas — no transforms, which
   keeps the react-hook-form input and output types identical. */
export const phoneField = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

/**
 * Verhoeff is Aadhaar's real checksum and only ~11% of 12-digit numbers pass
 * it, so every number a person types into a demo ("1234 5678 9012") is
 * rejected. While the whole verification is simulated, checking the length is
 * the honest bar; the real check comes back with demo mode off.
 */
export const aadhaarField = demoMode()
  ? z.string().length(12, "Aadhaar is 12 digits")
  : z
      .string()
      .length(12, "Aadhaar is 12 digits")
      .refine(verhoeff, "That Aadhaar number is not valid. Please check the digits.");

export const phoneSchema = z.object({ phone: phoneField });
export const aadhaarSchema = z.object({ aadhaar: aadhaarField });

/** Both login doors share one form, so they share one field name. */
export const identifierSchema = (kind: "phone" | "aadhaar") =>
  z.object({ value: kind === "phone" ? phoneField : aadhaarField });

export const otpSchema = z.object({
  // A regex literal, not a RegExp built from a template string: `\d` inside a
  // template literal silently collapses to a plain "d".
  code: z
    .string()
    .regex(/^\d+$/, "Numbers only")
    .length(OTP_LENGTH, `Enter all ${OTP_LENGTH} digits`),
});

export const roleSchema = z.object({ role: z.enum(["worker", "employer"]) });

export const workerProfileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  location: z.string().trim().min(2, "Please enter your city or area"),
  contact: z.string().trim().optional().or(z.literal("")),
  domain: z.string().min(1, "Pick the work you do"),
  positions: z.array(z.string()).min(1, "Pick at least one job"),
  experience_years: z.string().min(1, "Pick your experience"),
  availability: z.string().min(1, "Pick your availability"),
  has_tools: z.enum(["yes", "no"]),
});

export const employerProfileSchema = z.object({
  type: z.enum(["individual", "company"]),
  name: z.string().trim().min(2, "Please enter a name"),
  location: z.string().trim().min(2, "Please enter your city or area"),
});

export const jobSchema = z.object({
  title: z.string().trim().min(3, "Give the job a clear title"),
  skill: z.string().trim().min(1, "Pick the type of work"),
  salary: z.number("Enter the amount you will pay").int().positive("Enter the amount you will pay"),
  payment_type: z.enum(["per_day", "per_hour", "per_month", "fixed"]),
  job_type: z.enum(["permanent", "temporary"]),
  openings: z.number("How many workers?").int().min(1, "At least 1 worker").max(99),
  location: z.string().trim().min(2, "Where is the work?"),
  description: z.string().trim().optional().or(z.literal("")),
});

/** The four questions on the application screen (Q1..Q4 in the sketch). */
export const APPLICATION_QUESTIONS = [
  { key: "experience", label: "How much experience do you have in this work?" },
  { key: "availability", label: "When can you start?" },
  { key: "expected_pay", label: "What pay do you expect?" },
  { key: "why", label: "Why should the employer pick you?" },
] as const;

export const applicationSchema = z.object({
  experience: z.string().trim().min(1, "Please answer this"),
  availability: z.string().trim().min(1, "Please answer this"),
  expected_pay: z.string().trim().min(1, "Please answer this"),
  why: z.string().trim().min(1, "Please answer this"),
});

export const reviewSchema = z.object({
  rating: z.number("Pick a rating").int().min(1, "Pick a rating").max(5),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
});
