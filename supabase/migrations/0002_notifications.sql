-- Karigaar 0002 — additive only. Nothing existing is altered or dropped.

-- The bell beside the account menu. Read state has to live somewhere durable,
-- or "unread" would be per-device and the bell would lie on a second phone.
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- hired | rejected | on_hold | released | job_match | withdrawn | completed
  type       text not null,
  title      text not null,
  body       text,
  -- Where tapping it should go, e.g. /applied or /posted/12.
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on public.notifications (profile_id, created_at desc);

-- Match the other tables: RLS on, no public policies. Everything is reached
-- through Server Actions using the secret key.
alter table public.notifications enable row level security;

-- Holding and releasing a worker's other applications reads them by worker.
create index if not exists applications_worker_idx
  on public.applications (worker_id, status);
