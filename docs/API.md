# API

Two kinds of server entry point.

**Server Actions** carry every mutation. They are typed function calls from a
client component, not URLs — no hand-written fetch, no serialisation, and the
same Zod schema validates on both sides.

**Route handlers** exist only where the browser genuinely needs to fetch on its
own: search-as-you-type, the notification bell, and the Setu conversation.

Every one of them starts by resolving the caller through
[`lib/session.ts`](../lib/session.ts). Nothing trusts an id sent from the client.

---

## Route handlers

### `GET /api/jobs?q=`
Backs the Discover Jobs search box. Workers only.

```jsonc
// 200
{ "jobs": [ /* open jobs, newest first, max 50, employer joined */ ],
  "applied": [12, 15] }        // job ids this worker already applied to
```
`401` not signed in · `403` employers

### `GET /api/notifications`
```jsonc
{ "items": [ { "id": 1, "type": "hired", "title": "…", "body": "…",
               "href": "/applied", "read_at": null, "created_at": "…" } ],
  "unread": 3 }
```
Returns an empty inbox rather than an error if migration 0002 has not run.

### `POST /api/notifications`
Marks everything unread as read. Opening the bell calls it.

### `POST /api/setu/chat`
One turn of the voice onboarding. Stateless — the transcript and profile travel
with the request.

```jsonc
// request
{ "message": "I am an electrician, I do AC repair",
  "language": "hi-IN",
  "profile": { "name": "Suresh" },
  "history": [ { "role": "model", "text": "…" } ] }

// 200
{ "reply": "…",              // what Setu says next, in the worker's language
  "audio": "<base64 wav>",   // Sarvam bulbul:v3
  "profile": { /* merged */ },
  "done": false,
  "complete": false,
  "trustScore": 85,
  "remarks": null }
```
`400` empty message · `401` not signed in · `403` employers · `502` model failed

Saves on **every** turn, so a dropped call resumes where it left off.

### `POST /api/setu/stt`
`multipart/form-data`: `audio` (WAV ≤ 10 MB), optional `language`.

```jsonc
{ "transcript": "मैं नौ साल से बिजली का काम करता हूँ",
  "language": "hi-IN", "confidence": 0.999 }
```
The language is **detected**, not assumed — if someone answers in a different
language than they picked, the conversation follows them.

### `POST /api/setu/tts`
`{ "text": "…", "language": "hi-IN" }` → `{ "audio": "<base64 wav>" }`

Both Setu endpoints are proxies so the Sarvam key never reaches the browser.

---

## Server Actions

### Auth — [`actions/auth.ts`](../actions/auth.ts)

| Action | Does |
| --- | --- |
| `sendOtp({ kind, value })` | Validates a phone or Aadhaar, issues the signed OTP cookie. **Never returns the code.** |
| `resendOtp()` | New code against the same sealed identity |
| `confirmOtp({ code })` | Verifies, creates the account on first use, signs in, returns where to go next |
| `signOut()` | |
| `deleteAccount()` | Removes everything in dependency order, then the auth user |

### Aadhaar — [`actions/aadhaar.ts`](../actions/aadhaar.ts)

For someone already signed in — during onboarding, or later from the profile.
Same two steps as the phone login, because that is what a real UIDAI e-KYC looks
like: the number alone proves nothing.

| Action | Does |
| --- | --- |
| `sendAadhaarOtp({ aadhaar })` | Rejects a number already linked to another account *before* asking for a code |
| `confirmAadhaarOtp({ code })` | Stores the SHA-256 hash on the auth user and, if a profile exists, on it |

### Onboarding — [`actions/onboarding.ts`](../actions/onboarding.ts)

| Action | Does |
| --- | --- |
| `createWorkerProfile(input)` | Upserts `profiles` + `workers`. Upsert, not insert, so a signup whose worker row never landed can be repaired |
| `createEmployerProfile(input)` | Upserts `profiles` + `employers` |

### Jobs — [`actions/jobs.ts`](../actions/jobs.ts)

| Action | Does |
| --- | --- |
| `createJob(input)` | Posts, then notifies workers whose trade **and** area both match |
| `completeJob(jobId)` | Marks finished, moves hired applications to `completed`, releases those workers' held applications, opens reviews |

### Applications — [`actions/applications.ts`](../actions/applications.ts)

| Action | Does |
| --- | --- |
| `applyToJob(jobId, answers)` | Starts `on_hold` if the worker is already hired elsewhere, and says so |
| `hireApplicant(id)` | Hires, parks the worker's other applications, fills the job when its openings run out, rejects anyone still parked on it |
| `rejectApplicant(id)` | Rejects; if they were hired, re-opens the job and frees the worker |
| `withdrawFromJob(id)` | The worker pulls out: re-opens the job, brings their parked applications back, tells the employer |

### Profile — [`actions/profile.ts`](../actions/profile.ts)

| Action | Does |
| --- | --- |
| `updateWorkerProfile(input)` | Everything Setu heard, including the remarks it wrote |
| `addCertificate(formData)` | Uploads to the private bucket (≤ 5 MB; JPEG/PNG/WebP/PDF) |
| `deleteCertificate(id)` | Row and file, after proving ownership |
| `certificateLink(id)` | 60-second signed URL |

### Reviews — [`actions/reviews.ts`](../actions/reviews.ts)

`submitReview(jobId, revieweeId, { rating, comment })`

Who may review whom is derived from the job, never from the client: the employer
may review a worker they hired, and a hired worker may review the employer, only
once the job is `completed`. One review per pair per job; re-submitting updates
it. The reviewee's stored rating is recomputed afterwards.

---

## Errors

Actions return a discriminated union rather than throwing, so the UI can show
the message next to the field that caused it:

```ts
{ ok: true,  ...data }
{ ok: false, error: "That Aadhaar number is already linked to another account." }
```

Messages are written for the person reading them, not the developer. Route
handlers use normal HTTP status codes.
