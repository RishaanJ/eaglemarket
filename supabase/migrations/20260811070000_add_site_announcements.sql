-- Site-wide announcement banner.
--
-- One admin-authored message shown at the top of the app. Signed-in users can
-- read only announcements that are currently live; writes are admin-only and go
-- exclusively through the security-definer RPCs below, so no client ever holds
-- direct write privileges on the table.

create table public.announcements (
  id bigint generated always as identity primary key,
  message text not null check (char_length(message) between 1 and 300),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'emergency', 'maintenance')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_window_order check (ends_at is null or starts_at < ends_at)
);

comment on table public.announcements is
  'Admin-authored banner messages. Only live rows are readable through RLS; writes go through admin_* RPCs.';

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function private.set_updated_at();

-- Serves the banner lookup: live rows, newest first.
create index announcements_live_idx
  on public.announcements (starts_at desc)
  where is_active;

-- Covers the created_by foreign key so admin deletions never seq-scan.
create index announcements_created_by_idx on public.announcements (created_by);

alter table public.announcements enable row level security;

-- Readable by any signed-in user, but only while the announcement is live. An
-- inactive or expired row is invisible to clients even if its id is known;
-- admins see the full list through admin_list_announcements() instead.
create policy announcements_public_read on public.announcements
  for select
  to authenticated
  using (
    is_active
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );

-- RLS decides which rows are visible; this grant decides whether the role may
-- read the table at all. Both are required.
grant select on public.announcements to authenticated;

-- No insert/update/delete policies: writes are RPC-only, by design.

-- ── Admin operations ────────────────────────────────────────────────────────

create or replace function public.admin_list_announcements()
returns table (
  id bigint,
  message text,
  severity text,
  is_active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  is_live boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Must be a statement, not a cross-joined CTE: the planner is free to drop an
  -- unreferenced CTE, which would silently skip the authorization check.
  perform private.require_admin();

  return query
  select
    a.id,
    a.message,
    a.severity,
    a.is_active,
    a.starts_at,
    a.ends_at,
    a.created_at,
    a.updated_at,
    (a.is_active and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())) as is_live
  from public.announcements a
  order by a.created_at desc;
end;
$$;

create or replace function public.admin_create_announcement(
  p_message text,
  p_severity text default 'info',
  p_ends_at timestamptz default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.require_admin();
  v_id bigint;
begin
  insert into public.announcements (message, severity, ends_at, created_by)
  values (trim(p_message), p_severity, p_ends_at, v_admin_id)
  returning announcements.id into v_id;

  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, details)
  values (
    v_admin_id,
    'announcement.created',
    'announcement',
    v_id::text,
    jsonb_build_object('severity', p_severity, 'message', trim(p_message))
  );

  return v_id;
end;
$$;

create or replace function public.admin_update_announcement(
  p_id bigint,
  p_message text,
  p_severity text,
  p_is_active boolean,
  p_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.require_admin();
begin
  update public.announcements
  set message = trim(p_message),
      severity = p_severity,
      is_active = p_is_active,
      ends_at = p_ends_at
  where announcements.id = p_id;

  if not found then
    raise exception 'Announcement % was not found', p_id using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, details)
  values (
    v_admin_id,
    'announcement.updated',
    'announcement',
    p_id::text,
    jsonb_build_object('severity', p_severity, 'is_active', p_is_active, 'message', trim(p_message))
  );
end;
$$;

create or replace function public.admin_delete_announcement(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.require_admin();
begin
  delete from public.announcements where announcements.id = p_id;

  if not found then
    raise exception 'Announcement % was not found', p_id using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, details)
  values (v_admin_id, 'announcement.deleted', 'announcement', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_list_announcements() from public, anon;
revoke all on function public.admin_create_announcement(text, text, timestamptz) from public, anon;
revoke all on function public.admin_update_announcement(bigint, text, text, boolean, timestamptz) from public, anon;
revoke all on function public.admin_delete_announcement(bigint) from public, anon;

grant execute on function public.admin_list_announcements() to authenticated;
grant execute on function public.admin_create_announcement(text, text, timestamptz) to authenticated;
grant execute on function public.admin_update_announcement(bigint, text, text, boolean, timestamptz) to authenticated;
grant execute on function public.admin_delete_announcement(bigint) to authenticated;
