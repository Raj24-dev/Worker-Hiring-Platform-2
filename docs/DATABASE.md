# Database

Supabase Postgres. **Row Level Security is on for every table with no policies**,
so nothing is reachable from the browser — see
[ARCHITECTURE.md](ARCHITECTURE.md#security-model).

`profiles`, `workers`, `employers`, `jobs`, `applications` and `certificates`
already existed. The two migrations in [`supabase/migrations/`](../supabase/migrations)
are **additive only** — they add columns and two tables, and alter, rename or
drop nothing.

## Relationships

```
auth.users
    │ 1:1
    ▼
profiles ────────┬──────────────────┐
  id (uuid, PK)  │                  │
  name           │ 1:1              │ 1:1
  role           ▼                  ▼
  aadhaar_id   workers          employers
  (sha-256,    id (uuid, PK/FK)  id (bigint, PK)
   unique)     name              profile_id (uuid FK)
               domain            name
               sub_domain        location
               skills            type (individual|company)
               rating            verified
               llm_trust_score   rating
               remarks              │
               …                    │ 1:N
                 │                  ▼
                 │                jobs
                 │                  id (bigint, PK)
                 │                  employer_id (FK)
                 │                  title, description, skill
                 │                  salary, payment_type, job_type
                 │                  openings, location, status
                 │                     │
                 │  1:N                │ 1:N
                 ▼                     ▼
              certificates        applications
                worker_id (FK)      job_id (FK) ─┐
                name, issuer        worker_id (FK)│ unique together
                certificate_url     status        │
                verification_status answers (jsonb)

reviews                      notifications
  job_id (FK)                  profile_id (FK)
  reviewer_id (profiles FK)    type, title, body, href
  reviewee_id (profiles FK)    read_at, created_at
  rating (1–5), comment
  unique (job_id, reviewer_id, reviewee_id)
```

Note the asymmetry that shapes a lot of the query code: **`workers.id` *is* the
profile id**, but **`employers.id` is a separate bigint** with `profile_id`
pointing back. So an employer lookup is
`profile → employers.profile_id → employers.id → jobs.employer_id`.

## What the migrations add

### 0001 — the flow the wireframes describe

| Change | Why |
| --- | --- |
| `jobs.payment_type` | The card shows "₹800 **per day**" |
| `jobs.job_type` | The card shows Permanent / Temporary |
| `jobs.openings` | "positions filled → remove from Discover" needs a target count |
| `applications.answers` (jsonb) | The four application questions |
| unique `(job_id, worker_id)` | A worker cannot apply to the same job twice |
| `employers.type` | Individual or Company |
| `reviews` table | Mutual review after a job is finished |

`reviews` is unique on `(job_id, reviewer_id, reviewee_id)` rather than
`(job_id, reviewer_id)`, because a job with several openings means the employer
writes one review per hired worker.

### 0002 — notifications

| Change | Why |
| --- | --- |
| `notifications` table | The bell. Read state has to be durable, or "unread" would be per-device and the bell would lie on a second phone |
| index `(profile_id, created_at desc)` | The inbox query |
| index `applications (worker_id, status)` | Holding and releasing reads applications by worker |

## Status values

Both are `text` — no enum, because the columns already existed.

### `jobs.status`

| Value | Meaning |
| --- | --- |
| `open` | Visible in Discover Jobs, accepting applications |
| `filled` | Every opening hired. Leaves Discover; **the row is never deleted** |
| `completed` | Work finished. Reviews open |

`filled` reverts to `open` if a hired worker is rejected or withdraws.

### `applications.status`

| Value | Meaning |
| --- | --- |
| `applied` | Waiting for the employer |
| `on_hold` | The worker is hired elsewhere; parked, not cancelled |
| `hired` | Accepted for this job |
| `rejected` | Not selected, or the post was taken while parked |
| `withdrawn` | The worker accepted and then pulled out |
| `completed` | Work finished; moves to History |

```
                  ┌──────────────── withdrawn (worker pulls out)
                  │
applied ──────▶ hired ──────▶ completed
   │              ▲
   │              │ employer hires
   ▼              │
on_hold ──────────┘  (released when the worker is free again)
   │
   └──▶ rejected  (the post was filled by someone else meanwhile)
```

The invariant worth stating: **no transition ever deletes a row.** A worker who
changes their mind about a job must find their other applications waiting.

## Privacy

- **Aadhaar is never stored.** `profiles.aadhaar_id` holds a SHA-256 hash. The
  raw number does not reach the database, the OTP cookie, or any server action —
  `lib/identity.ts` hashes it at the boundary. The column is unique, so one
  Aadhaar means one account.
- **Certificates live in a private Storage bucket**, keyed by worker id, served
  through 60-second signed URLs.
- **A worker's phone number** is shown to an employer only on an application to
  that employer's own job.
- **Deleting an account** removes reviews, applications, certificates, jobs,
  the role row, the profile and the auth user, in dependency order
  (`actions/auth.ts`).
