# Karigaar

A hiring platform for India's skilled trades — masons, electricians, plumbers,
drivers, cooks. Workers find jobs near them and apply; employers post jobs, read
who applied, and hire. Both sides review each other afterwards.

The hard part is not the job board. It is that **many of the workers this is for
cannot comfortably fill in a form**. So the primary way to build a worker profile
is to talk to it: Setu, a voice assistant that asks questions in the worker's own
language and writes the profile from the answers.

**Next.js 16** (App Router) · **TypeScript** · **Tailwind v4** · **shadcn/ui** ·
**React Hook Form + Zod** · **TanStack Query** · **Server Actions** ·
**Supabase** (Postgres, Auth, Storage) · **Sarvam AI** (speech) ·
**Gemini** (conversation) · deploys to **Vercel**

---

## ⚠️ Read this before testing: the OTP is `9254`

**Identity verification is simulated.** There is no SMS gateway behind the phone
OTP and no UIDAI licence behind the Aadhaar check — neither is something an
application can simply call, and both need commercial agreements this project
does not have.

What that means in practice:

| | |
| --- | --- |
| **Every one-time code is `9254`** | Phone login, Aadhaar login, and Aadhaar verification |
| **The code is never shown on screen** | The UI only says "OTP sent successfully", exactly as it would with a real gateway |
| **Aadhaar accepts any 12 digits** | `1234 5678 9012` works |

Everything *around* the code is real and not faked: the code is HMAC'd into a
signed, `HttpOnly`, five-minute cookie, never stored in plaintext, limited to
five attempts, and re-issued on resend. Only the delivery is simulated. Swapping
in a real gateway is one function body — see
[`actions/auth.ts`](actions/auth.ts) and [`lib/demo.ts`](lib/demo.ts).

Set `NEXT_PUBLIC_DEMO_MODE=false` to restore random codes and Aadhaar's real
Verhoeff checksum. That does not add an SMS gateway, so sign-in would then only
work for whoever can read the server log.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### 1. Environment

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key — only carries the auth cookie |
| `SUPABASE_SECRET_KEY` | Secret key — all server-side data access |
| `AUTH_SECRET` | Signs the OTP cookie and derives each account's password. **Rotating it locks everyone out.** `openssl rand -hex 32` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` for the simulated verification described above |
| `SARVAM_API_KEY` | Setu's speech-to-text and text-to-speech |
| `GEMINI_API_KEY` | Setu's conversation and the profile remarks |

### 2. Database

Run both migrations in the Supabase SQL editor, in order. Both are **additive** —
no existing column is altered, renamed or dropped.

1. [`supabase/migrations/0001_karigaar_flow.sql`](supabase/migrations/0001_karigaar_flow.sql)
   — job facets, application answers, the `reviews` table
2. [`supabase/migrations/0002_notifications.sql`](supabase/migrations/0002_notifications.sql)
   — the `notifications` table

Then create one private Storage bucket named **`certificates`** (5 MB limit;
`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).

### 3. Commands

```bash
npm run dev      # development
npm test         # 23 logic tests, no network
npm run build    # production build
npm run lint     # eslint
```

---

## Walking through it

Two accounts, any phone numbers you like, `9254` at every code prompt.

**As an employer** — sign in → *I want to hire* → Individual or Company → post a
job. Workers whose trade and area match get a notification.

**As a worker** — sign in with a different number → *I want work* → **talk to
Setu** (or *fill the form myself*) → Discover Jobs → open a job → read the
employer's reviews → apply.

**Back as the employer** — open the job → read the applicant's profile, trust
score and reviews → hire → mark finished → review the worker.

**Back as the worker** — History → review the employer.

Worth trying deliberately, because it is where most of the logic lives: **apply
to two jobs, get hired for one**. The other application goes *on hold*, not
away. Cancel the job you accepted and it comes straight back.

---

## What it does

**For workers**
- Sign in by phone or Aadhaar — no email, no password
- Build a profile **by voice** in 11 Indian languages, or by form
- Jobs near you, with the pay and distance on the card
- Read an employer's reviews *before* applying
- One job at a time: being hired parks your other applications instead of
  ending them, and cancelling brings them back
- Aadhaar verification, certificates, editable profile and remarks

**For employers**
- Post a job in one screen
- See applicants with their reviews, trust score and answers
- Hire or reject; the job leaves Discover once its positions are filled
- Mark work finished, then review the worker

**Both**
- Star rating plus a written remark, tied to a finished job
- A notification bell for hires, rejections, holds, releases, cancellations,
  completions and matching new jobs

---

## Documentation

| | |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, request flow, security model, Setu |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, relationships, application lifecycle |
| [docs/API.md](docs/API.md) | Route handlers and every server action |

## Layout

```
app/login/…            phone / Aadhaar / OTP / verified
app/onboarding/…       worker: talk to Setu, or /form to type it
                       employer: individual or company → questions
app/(app)/jobs         Discover Jobs → job page → application
app/(app)/applied      Applied Jobs, with holds and cancelling
app/(app)/history      Finished work + review the employer
app/(app)/posted       Posted Jobs → post → applicants → hire → complete
app/(app)/profile      Profile, edit, certificates, sign out, delete account
app/api/…              jobs search, notifications, Setu chat/stt/tts
actions/               every mutation
lib/                   queries, auth, lifecycle, Setu, validation
supabase/migrations/   additive SQL
```

## Notes on a few decisions

- **RLS is on with no policies**, so the browser cannot touch any table. Every
  read and write goes through server code holding the secret key, and
  authorisation lives in [`lib/session.ts`](lib/session.ts). Detail in
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Aadhaar numbers are never stored.** Only a SHA-256 hash reaches
  `profiles.aadhaar_id` — holding raw Aadhaar is a legal problem in India.
- **"Distance from the worker"** compares the location text both sides already
  have. Neither table stores coordinates, and adding geo would have meant
  changing a schema that was already in use.
- **A new account has no rating.** `workers.rating` defaults to `5` in the
  database, which would show an unrated worker as perfect, so onboarding writes
  `null` and the headline rating is computed from real reviews.
- **The applicant card shows a phone number, not a chat.** A messaging system
  appears nowhere in the product this was built from.
- **Light theme only** — the wireframes show one theme.

The original standalone Setu prototype this ports from is not in the repository:
it carries its own `.env` with live keys. Its logic now lives in
[`lib/setu/`](lib/setu) and [`app/api/setu/`](app/api/setu).
