# Karigaar

A work marketplace for skilled trades. Workers find jobs near them and apply;
employers post jobs, look at who applied, and hire.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · lucide ·
React Hook Form + Zod · TanStack Query · Server Actions · Supabase · Vercel.

## Setup

```bash
npm install
```

`.env.local` is already filled in. It needs:

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key — used only to carry the auth cookie |
| `SUPABASE_SECRET_KEY` | Secret key — server-side data access |
| `AUTH_SECRET` | Signs the OTP cookie and derives each account's password. **Rotating it locks everyone out.** |
| `DEMO_OTP` | Fixed OTP for demos. **Delete for real use** — see below. |
| `SARVAM_API_KEY` | Setu's speech-to-text and text-to-speech |
| `GEMINI_API_KEY` | Setu's conversation and the profile remarks |

### One-time database step

Run both migrations in the Supabase SQL editor, in order. Both are additive —
nothing existing is altered, renamed or dropped.

1. [`0001_karigaar_flow.sql`](supabase/migrations/0001_karigaar_flow.sql) — job
   facets, application answers, reviews.
2. [`0002_notifications.sql`](supabase/migrations/0002_notifications.sql) — the
   notification bell.

```bash
npm run dev     # http://localhost:3000
npm test        # logic tests
npm run build
```

## How the pieces fit

**RLS is on with no policies**, so the browser cannot read or write any table
directly. Everything goes through Server Actions and route handlers that use the
secret key, and **authorisation lives in `lib/session.ts`** — `requireWorker()`
and `requireEmployer()` are what actually decide who may see and do what. Every
query is then scoped to the id they return. No table was given a policy, so the
database is untouched.

**Login does not use Supabase phone auth**, because the project reports
`"phone": false` and has no SMS credentials — and Aadhaar OTP needs licensed
UIDAI access no app can simply call. The screens from the flow are kept exactly
(phone / Aadhaar → OTP → "Account verified"), backed by:

- a 6-digit code signed into an HttpOnly cookie (`lib/otp.ts`) — the code itself
  is never stored, only its HMAC, and there is a 5-try limit;
- an account on Supabase email auth behind a synthetic address
  (`p<phone>@karigaar.app`), matching the pattern already in this database.

To send real SMS, replace the `console.log` in `sendOtp` (`actions/auth.ts`)
with a gateway call. Nothing else changes.

**`DEMO_OTP` is a demo switch, not a feature.** With it set, every code is that
fixed value and the screen just says "OTP sent successfully" — which is what a
walkthrough needs, since there is no SMS to receive. It also means anyone who
knows a phone number can sign in as its owner. Delete the line before this goes
anywhere real; without it the code is random and the rest of the flow is
identical. `lib/karigaar.test.ts` guards that the unset case stays random.

**Aadhaar numbers are never stored.** `lib/identity.ts` hashes them on the way
in; only the SHA-256 lands in `profiles.aadhaar_id`. The raw number never
reaches the database or the OTP cookie.

## Layout

```
app/login/…            phone / Aadhaar / OTP / verified
app/onboarding/…       worker: talk to Setu (default) or /form to type it
                       employer: individual or company → questions → created
app/(app)/jobs         Discover Jobs  ─ job page ─ application
app/(app)/applied      Applied Jobs
app/(app)/history      History + review the employer
app/(app)/posted       Posted Jobs ─ post a job ─ applicants ─ hire / reject
app/(app)/profile      worker or employer profile, sign out, delete account
app/(app)/profile/edit fix anything, verify Aadhaar, add certificates
app/api/setu/…         chat / stt / tts
lib/setu/              Setu's prompt, trust score, audio, persistence
components/setu/       the voice interface and its orb
actions/               every mutation
lib/queries.ts         every read
```

## Setu — onboarding by voice

Most workers here cannot fill in a form, so `/onboarding/worker` opens a
conversation instead. They pick a language, tap the orb, and answer out loud;
Setu asks one thing at a time and builds the profile as they talk. Typing and
the original step-by-step form are both one tap away.

- **Speech** is Sarvam (`saarika:v2.5` in, `bulbul:v3` out). The browser records
  whatever container it likes and `lib/setu/audio.ts` re-renders it to 16 kHz
  mono WAV, so Chrome and Safari both work. Sarvam also **detects the language**,
  and if someone answers in a different one than they picked, Setu follows them.
- **The conversation** is Gemini with a JSON response schema. It returns what it
  *learned* each turn rather than a script position, so the worker can answer out
  of order, say two things at once, or ask a question back. The trade it picks
  must come from the app's own position list, or a voice-built profile would
  never match a posted job.
- **It writes to the signed-in worker's row.** The standalone Setu minted a
  throwaway auth user per conversation, which is where the stray
  `candidate_*@setu.local` accounts in this project came from.
- **Every turn is saved**, so a dropped call resumes where it left off instead of
  starting again.
- **Remarks are first person** — "I am an electrician with 9 years…" — because
  the profile should read as the worker's own words. They can rewrite them.
- **Certificates are never invented.** The worker uploads those by hand on
  `/profile/edit`, into a private Storage bucket read through signed links.

The orb is driven by a real `AnalyserNode`: `--amp` is written every frame from
the actual microphone or playback level, so it moves with the voice in the room
rather than on a timer. It respects `prefers-reduced-motion`.

`setu/` holds the original standalone Express app, kept for reference. It is
excluded from lint and typecheck and nothing imports it.

## Decisions worth knowing

- **"Distance from the worker"** on the job card is derived from the `location`
  text both sides already have (`proximity()` in `lib/format.ts`). Neither table
  stores coordinates and adding geo would have meant changing your schema.
- **Filled jobs are never deleted.** Hiring the last opening flips
  `jobs.status` to `filled`, which drops it out of Discover while the employer
  keeps every record. Rejecting a hired worker re-opens it.
- **A new account has no rating.** `workers.rating` defaults to 5 in the
  database, which would show an unrated worker as perfect, so onboarding writes
  `null` and the stars stay empty until a real review lands.
- **The applicant card shows a phone number, not a chat.** The sketch lists
  "Contact" and "Message" as fields; a messaging system appears nowhere else in
  the flow, so this calls the worker instead of inventing one.
- **Light theme only** and **no dark mode toggle** — the wireframes show one
  theme and nothing asks for a switch.

## Trust, and one job at a time

Ratings only mean something if you can see them when you are deciding. So the
employer reads a worker's reviews on the applicant page, and the worker reads
that employer's reviews on the job page **before** applying — same component,
both directions, each review showing who wrote it and when.

A worker can only turn up to one job at a time, so being hired parks their other
applications instead of ending them. `lib/applications.ts` holds the whole rule:

```
applied --hired elsewhere--> on_hold --free again--> applied
                                     \--post taken--> rejected
```

- Hired somewhere: every other live application goes **on hold**, never deleted.
- The job finishes, the employer lets them go, or **they cancel it themselves**:
  the held applications come back. Anything whose post was taken meanwhile is
  closed with the reason spelled out.
- Someone else is hired into a job you were holding: that one is rejected, and
  the notification says exactly why.

Deleting held applications would be the worst possible outcome for a worker who
changes their mind, so nothing in this file ever deletes a row.

**The bell** sits beside the account in both layouts and covers hires,
rejections, holds and releases, cancellations, completions, and new jobs that
match a worker's trade *and* are close enough to reach — both halves required,
or it is not worth interrupting anyone for.
