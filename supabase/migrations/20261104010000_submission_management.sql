-- Apply before deploying the new create/manage functions. This migration does
-- not grant ownership of historical rows to anyone with a public submission ID.
begin;
alter table public.dummy_submissions add column if not exists weapons text[] not null default array[null,null,null,null]::text[];

create table public.submission_management (
  submission_id uuid primary key references public.dummy_submissions(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now()
);
alter table public.submission_management enable row level security;
revoke all on public.submission_management from public, anon, authenticated;
grant all on public.submission_management to service_role;

create or replace function public.assign_daily_puzzle(p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_submission_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_date::text)::bigint);

  select submission_id into v_submission_id
  from public.daily_guesser
  where date = p_date;
  if found then
    update public.dummy_submissions
    set featured_date = p_date
    where id = v_submission_id and featured_date is null;
    return v_submission_id;
  end if;

  select id into v_submission_id
  from public.dummy_submissions s
  where s.image_path is not null
    and s.image_path <> 'pending'
    and s.featured_date is null
    and s.puzzle_pool = 'Daily'
    and not exists (
      select 1 from public.daily_guesser d where d.submission_id = s.id
    )
  order by random()
  limit 1
  for update skip locked;

  if not found then
    select id into v_submission_id
    from public.dummy_submissions s
    where s.image_path is not null
      and s.image_path <> 'pending'
      and s.featured_date is null
      and s.puzzle_pool is null
      and not exists (
        select 1 from public.daily_guesser d where d.submission_id = s.id
      )
    order by random()
    limit 1
    for update skip locked;
  end if;

  if not found then
    return null;
  end if;

  insert into public.daily_guesser (date, submission_id)
  values (p_date, v_submission_id);
  update public.dummy_submissions
  set featured_date = p_date
  where id = v_submission_id;

  return v_submission_id;
end;
$$;
revoke all on function public.assign_daily_puzzle(date) from public,anon,authenticated;
grant execute on function public.assign_daily_puzzle(date) to service_role;

create or replace function public.manage_dummy_submission(
  p_id uuid, p_token_hash text, p_action text, p_expected_revision bigint, p_payload jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_revision bigint;
  v_image text;
  v_featured text;
  v_payload public.dummy_submissions;
begin
  select revision into v_revision from public.submission_management
    where submission_id=p_id and token_hash=p_token_hash for update;
  if not found then raise exception 'Invalid management code' using errcode='28000'; end if;
  if p_expected_revision is null or v_revision <> p_expected_revision then raise exception 'Submission changed. Reload it before trying again.' using errcode='40001'; end if;
  select image_path, featured_date::text into v_image,v_featured from public.dummy_submissions where id=p_id for update;
  if not found then raise exception 'Submission not found' using errcode='28000'; end if;
  if v_featured is not null or exists(select 1 from public.daily_guesser where submission_id=p_id) then
    raise exception 'This submission has already appeared as a Daily puzzle and cannot be changed.' using errcode='55000';
  end if;
  if p_action='delete' then
    delete from public.dummy_submissions where id=p_id;
    return jsonb_build_object('deleted',true,'old_image_path',v_image);
  elsif p_action='update' and p_payload is not null then
    select * into v_payload from jsonb_populate_record(null::public.dummy_submissions,p_payload);
    update public.dummy_submissions set
      team=v_payload.team, elements=v_payload.elements,
      constellations=v_payload.constellations, refinements=v_payload.refinements,
      weapons=v_payload.weapons, strongest_hit=v_payload.strongest_hit,
      total_dps=v_payload.total_dps, genshin_uid=v_payload.genshin_uid,
      puzzle_pool=v_payload.puzzle_pool,
      image_path=coalesce(v_payload.image_path,v_image)
    where id=p_id;
    update public.submission_management set revision=revision+1 where submission_id=p_id;
    return jsonb_build_object('revision',v_revision+1,'old_image_path',v_image);
  end if;
  raise exception 'Unsupported action' using errcode='22023';
end;
$$;
revoke all on function public.manage_dummy_submission(uuid,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.manage_dummy_submission(uuid,text,text,bigint,jsonb) to service_role;
commit;
