-- Admin console support for bit. Safe to run more than once.
--
-- The admin app only has the public anon key. Reads go through RLS as the
-- signed-in superadmin; writes go through the admin_* SECURITY DEFINER RPCs.
-- Nothing here grants a write path.
--
-- Run in the Supabase SQL editor (it runs as the project owner).

-- ===== 1. Close a privilege escalation =====
-- "Users can update own profile" has no column list, so any signed-in user
-- could PATCH their own is_superadmin to true through the API and walk into
-- the admin console. Limit API updates to the columns bit actually edits.
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, avatar_url, updated_at)
  on public.profiles to authenticated;

-- ===== 2. Remove direct image writes from an earlier draft of this file =====
-- Admin writes go through RPCs only.
drop policy if exists "admin update images" on public.images;
drop policy if exists "admin delete images" on public.images;

-- ===== 3. Superadmin SELECT (no-ops if equivalent policies already exist) =====
drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles" on public.profiles
  for select to authenticated using ((select public.is_superadmin()));

drop policy if exists "admin read all captions" on public.captions;
create policy "admin read all captions" on public.captions
  for select to authenticated using ((select public.is_superadmin()));

drop policy if exists "admin read all caption votes" on public.caption_votes;
create policy "admin read all caption votes" on public.caption_votes
  for select to authenticated using ((select public.is_superadmin()));

drop policy if exists "admin read all caption requests" on public.caption_requests;
create policy "admin read all caption requests" on public.caption_requests
  for select to authenticated using ((select public.is_superadmin()));

drop policy if exists "admin read all caption request steps" on public.caption_request_steps;
create policy "admin read all caption request steps" on public.caption_request_steps
  for select to authenticated using ((select public.is_superadmin()));

-- ===== 4. Read-only views for server-side sort + pagination =====
-- PostgREST can't sort by an aggregate, and aggregates are disabled here.
-- security_invoker = on: every underlying table is read with the CALLER's
-- RLS, so these views expose nothing a caller couldn't already read row by
-- row. Favorites are deliberately absent (they're private; the admin sees
-- counts only, via admin_favorite_counts()).

create or replace view public.admin_caption_rows
with (security_invoker = on) as
select
  c.id,
  c.image_id,
  c.content,
  c.is_public,
  c.like_count,
  c.created_at,
  c.profile_id,
  c.caption_request_id,
  i.url as image_url,
  p.first_name as author_first_name,
  p.last_name as author_last_name,
  p.email as author_email,
  (select count(*) from public.caption_votes v where v.caption_id = c.id) as vote_count
from public.captions c
left join public.images i on i.id = c.image_id
left join public.profiles p on p.id = c.profile_id;

create or replace view public.admin_people_rows
with (security_invoker = on) as
select
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.created_at,
  p.is_superadmin,
  (select count(*) from public.images i where i.profile_id = p.id) as images_uploaded,
  (select count(*) from public.captions c where c.profile_id = p.id) as captions_authored,
  (select count(*) from public.captions c where c.profile_id = p.id and c.is_public) as captions_published,
  (select count(*) from public.caption_votes v where v.profile_id = p.id) as votes_cast,
  (select case when count(*) = 0 then null
               else round(100.0 * count(*) filter (where c.is_public) / count(*), 1) end
     from public.captions c where c.profile_id = p.id) as publish_rate
from public.profiles p;

revoke all on public.admin_caption_rows, public.admin_people_rows from anon, public;
grant select on public.admin_caption_rows, public.admin_people_rows to authenticated;

-- ===== 5. admin_create_image: the only write path for images =====
-- Same shape as the admin_*_caption RPCs: SECURITY DEFINER, and the first
-- statement refuses anyone who isn't a superadmin. The image is recorded as
-- the admin's own upload (profile_id = caller). The URL is either a file the
-- admin uploaded to Storage or an external https link.
create or replace function public.admin_create_image(p_url text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;
  if p_url is null or p_url !~ '^https://[^[:space:]]+$' or length(p_url) > 2048 then
    raise exception 'image url must be an https URL';
  end if;

  insert into public.images (url, profile_id)
  values (p_url, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_create_image(text) from public, anon;
grant execute on function public.admin_create_image(text) to authenticated;

-- ===== 6. admin_delete_image: remove an image nobody captioned =====
-- Refuses images that have captions, so deleting an image can never cascade
-- into captions, votes or favorites. Returns the deleted row's url so the
-- app can remove the file from Storage too.
create or replace function public.admin_delete_image(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_captions bigint;
  v_url text;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  select count(*) into v_captions from public.captions where image_id = p_id;
  if v_captions > 0 then
    raise exception 'image % has % caption(s); delete or unpublish those instead', p_id, v_captions;
  end if;

  delete from public.images where id = p_id returning url into v_url;
  if v_url is null then
    raise exception 'image % not found', p_id;
  end if;
  return v_url;
end;
$$;

revoke all on function public.admin_delete_image(bigint) from public, anon;
grant execute on function public.admin_delete_image(bigint) to authenticated;

-- The images bucket is public, so deleting the row alone would leave the file
-- reachable by its URL. Storage can't be written from SQL, so superadmins get
-- delete (only) on files in that bucket, used right after admin_delete_image.
drop policy if exists "admin delete image files" on storage.objects;
create policy "admin delete image files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (select public.is_superadmin()));

-- ===== 7. Read-only image view for the Images list =====
create or replace view public.admin_image_rows
with (security_invoker = on) as
select
  i.id,
  i.url,
  i.description,
  i.is_library,
  i.profile_id,
  i.created_at,
  p.first_name as owner_first_name,
  p.last_name as owner_last_name,
  p.email as owner_email,
  (select count(*) from public.captions c where c.image_id = i.id) as caption_count
from public.images i
left join public.profiles p on p.id = i.profile_id;

revoke all on public.admin_image_rows from anon, public;
grant select on public.admin_image_rows to authenticated;

notify pgrst, 'reload schema';
