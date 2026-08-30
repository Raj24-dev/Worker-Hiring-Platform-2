-- Karigaar — additive only. Nothing existing is altered, renamed or dropped.
-- Every change below maps to a screen that exists in the wireframes / FLOW.svg.

-- 1. Job facets printed on every job card: "Amount(salary)" + "job type (Permanent/temp)"
--    and the payment period ("per day"). jobs.salary already exists.
alter table public.jobs add column if not exists payment_type text;  -- per_day | per_hour | per_month | fixed
alter table public.jobs add column if not exists job_type     text;  -- permanent | temporary

-- 2. "Job position/quota filled -> remove job from Discover Jobs".
--    Needs a target count; jobs.status alone cannot express it.
alter table public.jobs add column if not exists openings integer not null default 1;

-- 3. Worker application screen: "Application  Q1) Q2) Q3) Q4)".
alter table public.applications add column if not exists answers jsonb;

-- 4. A worker must not be able to apply to the same job twice.
create unique index if not exists applications_job_worker_uniq
  on public.applications (job_id, worker_id);

-- 5. Employer onboarding: "Individual OR Company".
alter table public.employers add column if not exists type text;  -- individual | company

-- 6. "Job gets done -> worker and employer review each other".
--    workers.rating / employers.rating already exist but nothing writes them.
create table if not exists public.reviews (
  id          bigint generated always as identity primary key,
  job_id      bigint   not null references public.jobs(id)     on delete cascade,
  reviewer_id uuid     not null references public.profiles(id) on delete cascade,
  reviewee_id uuid     not null references public.profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (job_id, reviewer_id, reviewee_id)
);

-- Match the other tables: RLS on, no public policies. All access is server-side
-- through Server Actions using the secret key, which bypasses RLS by design.
alter table public.reviews enable row level security;
