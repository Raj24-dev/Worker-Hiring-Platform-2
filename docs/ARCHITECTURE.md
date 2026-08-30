# Architecture

## The shape of it

One Next.js 16 application, no separate backend. Every page is a React Server
Component that reads from Postgres directly; every mutation is a Server Action.
There is no REST layer between the UI and the data except where the browser
genuinely needs to fetch on its own.

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  Server Components (pages)   Client Components (forms,  │
│                              voice, notification bell)  │
└───────────────┬─────────────────────────┬───────────────┘
                │ Server Actions          │ fetch()
                │ (mutations)             │ (search, bell, Setu)
┌───────────────▼─────────────────────────▼───────────────┐
│  Next.js server                                         │
│                                                         │
│  lib/session.ts   ← authorisation happens HERE          │
│  lib/queries.ts   ← every read                          │
│  actions/*.ts     ← every write                         │
│  lib/applications.ts ← the hold/release state machine   │
│  lib/setu/*       ← voice onboarding                    │
└───────┬──────────────────────┬──────────────────────────┘
        │ secret key           │
┌───────▼───────────┐  ┌───────▼─────────────────────────┐
│ Supabase          │  │ Sarvam AI (speech in/out)       │
│ Postgres, Auth,   │  │ Gemini  (conversation, remarks) │
│ Storage           │  └─────────────────────────────────┘
└───────────────────┘
```

`proxy.ts` (Next 16's renamed middleware) runs on every request for one reason:
refreshing the Supabase session cookie. A Server Component cannot write cookies,
so without that pass the access token would expire and quietly sign people out.

## Security model

**Row Level Security is enabled on every table with no policies.** That was the
state of the database this was built against, and it is left that way
deliberately. The consequence drives the whole design:

- The publishable key can read and write **nothing**. It exists only to carry
  the auth cookie.
- All data access uses the secret key, server-side only
  ([`lib/supabase/admin.ts`](../lib/supabase/admin.ts) is `import "server-only"`).
- Because the database cannot authorise anyone, **the application must**.
  [`lib/session.ts`](../lib/session.ts) is that layer: `requireWorker()` and
  `requireEmployer()` resolve the caller, and every query is then scoped to the
  id they return.

Ownership is proved before every mutation, never trusted from the client. For
example, an employer acting on an application goes through `ownedApplication()`,
which re-reads the row and checks the job belongs to that employer before
anything changes.

### Identity

Supabase reports `"phone": false` — the phone provider is disabled and there are
no SMS credentials. Aadhaar OTP needs licensed UIDAI access. So accounts live on
Supabase email auth behind a **synthetic address** derived from the identifier
(`p9876543210@karigaar.app`), with a password derived server-side via
`HMAC-SHA256(AUTH_SECRET, identityKey)`. That password never leaves the server
and is never shown to anyone.

The one-time code is HMAC'd into a signed `HttpOnly` cookie
([`lib/otp.ts`](../lib/otp.ts)) — the code itself is never stored, the cookie is
tamper-evident, it expires in five minutes, and there is a five-attempt limit.
Only the *delivery* of the code is simulated. See
[`lib/demo.ts`](../lib/demo.ts) and the warning at the top of the README.

Phone numbers are normalised to their last ten digits, so `+91 98765 43210` and
`9876543210` are one account rather than two.

**Aadhaar is hashed on the way in.** `lib/identity.ts` reduces the number to
SHA-256 immediately; the raw digits never reach the database, the OTP cookie, or
any server action. `profiles.aadhaar_id` is unique, so one Aadhaar means one
account.

## Data flow

**Reads.** Pages call [`lib/queries.ts`](../lib/queries.ts) and render on the
server. No loading spinners, no client-side fetch waterfall.

**Writes.** Forms are React Hook Form + Zod on the client, calling a Server
Action that re-validates with the *same* Zod schema before touching Postgres.
Client validation is for the person; server validation is the one that counts.

**Client fetching** is used in exactly three places, where the browser really
does need to drive: the Discover Jobs search box, the notification bell, and the
Setu conversation. Those go through route handlers under `app/api/`. TanStack
Query handles caching and refetching for the first two.

## The application lifecycle

A worker can only turn up to one job at a time, so being hired parks their other
applications rather than ending them. The whole rule lives in
[`lib/applications.ts`](../lib/applications.ts):

```
applied ──hired elsewhere──▶ on_hold ──they are free again──▶ applied
                                     └─post already taken───▶ rejected
```

Nothing in that file ever deletes a row. A worker who accepts a job and then
changes their mind must find their other applications waiting, not gone — that
is the point of the whole mechanism.

The transitions are driven from four events: hire, reject, the worker
withdrawing, and the employer marking the job finished. Each one recomputes the
job's status (a job whose positions are filled leaves Discover but is never
deleted) and notifies whoever is affected, with the reason spelled out.

`planHoldRelease()` is pulled out as a pure function so the "restore or close"
decision can be tested directly ([`lib/lifecycle.test.ts`](../lib/lifecycle.test.ts)).

## Setu — onboarding by voice

Most workers this is for cannot fill in a form comfortably, so
`/onboarding/worker` opens a conversation instead.

- **Speech** is Sarvam: `saarika:v2.5` in, `bulbul:v3` out. The browser records
  in whatever container it likes (webm in Chrome, mp4 in Safari) and
  [`lib/setu/audio.ts`](../lib/setu/audio.ts) decodes and re-renders it to
  16 kHz mono WAV, which is what the speech model wants and a fraction of the
  upload. Sarvam also **detects the language**, so if someone answers in a
  different one than they picked, Setu follows them.
- **The conversation** is Gemini with a JSON response schema. It returns what it
  *learned* each turn rather than a position in a script, so the worker can
  answer out of order, say two things at once, or ask a question back. The trade
  it picks must come from the application's own position list, or a voice-built
  profile would never match a posted job.
- **It is stateless.** The transcript and the profile so far travel with each
  request. Serverless instances share no memory, so holding the conversation in
  a module-level map would lose the thread the moment a second instance answered.
- **Every turn is saved**, so a dropped call resumes where it left off.
- **Remarks are written in the first person** — the profile should read as the
  worker's own words — and the worker can rewrite them.
- **Certificates are never invented.** Those are uploaded by hand into a private
  Storage bucket and read back through short-lived signed URLs.

The orb is driven by a real `AnalyserNode`: the `--amp` custom property is
written every frame from the actual microphone or playback level, so it moves
with the voice in the room rather than on a timer. It respects
`prefers-reduced-motion`.

## Scaling notes

Honest about where the seams are:

- **The hold/release engine issues a few sequential statements per event.** Fine
  at this size; it belongs in a Postgres function or a transaction if hiring
  ever becomes hot, since a crash midway could leave a job `filled` with a
  release half-applied.
- **Job-match notifications scan the worker table on every post.** Correct and
  simple now; it wants an index on `(interview_status, sub_domain)` and batching
  before the worker count gets large.
- **The OTP attempt counter rides in the signed cookie.** A captured older
  cookie could reset it. With a real SMS gateway this belongs in Redis or
  Postgres, and it is marked as such in the code.
- **Reads are not cached.** Every page is dynamic because every page is
  session-scoped. Discover Jobs is the one that would benefit from caching.
