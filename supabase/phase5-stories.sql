-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 5 — Històries d'Instagram
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Objectiu:
--   L'usuari publica una història d'Instagram etiquetant
--   @apatdelprat, puja una captura de pantalla com a prova,
--   i quan l'admin la valida guanya 50 punts.
--   Màxim 1 reclamació per setmana calendària (dl-dg).
--
-- Estructura:
--   1) Taula public.stories
--   2) Bucket Storage 'stories' amb RLS per carpeta d'usuari
--   3) RPC request_story(screenshot_path)
--   4) RPC process_story(story_id, action, motiu)
-- =============================================================

-- 1) TAULA -----------------------------------------------------
create table if not exists public.stories (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  screenshot_path   text not null,
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente','validado','rechazado')),
  puntos_otorgados  integer not null default 50,
  created_at        timestamptz not null default now(),
  validado_at       timestamptz,
  validado_por      uuid references public.profiles(id),
  motivo_rechazo    text
);

create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists stories_estado_idx on public.stories(estado);
create index if not exists stories_created_at_idx on public.stories(created_at desc);

alter table public.stories enable row level security;

-- L'usuari pot veure les seves històries
drop policy if exists "stories_own_select" on public.stories;
create policy "stories_own_select" on public.stories
  for select
  using (user_id = auth.uid());

-- Els admins poden veure totes les històries
drop policy if exists "stories_admin_all" on public.stories;
create policy "stories_admin_all" on public.stories
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- Les insercions i actualitzacions es fan sempre via RPC (security definer)


-- 2) STORAGE BUCKET --------------------------------------------
insert into storage.buckets (id, name, public)
values ('stories', 'stories', false)
on conflict (id) do nothing;

-- Política: l'usuari pot pujar a la seva carpeta {user_id}/...
drop policy if exists "stories_upload_own_folder" on storage.objects;
create policy "stories_upload_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Política: l'usuari pot llegir els seus propis fitxers
drop policy if exists "stories_select_own" on storage.objects;
create policy "stories_select_own"
  on storage.objects for select
  using (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Política: l'admin pot llegir totes les històries
drop policy if exists "stories_select_admin" on storage.objects;
create policy "stories_select_admin"
  on storage.objects for select
  using (
    bucket_id = 'stories'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );


-- 3) RPC · REQUEST STORY ---------------------------------------
-- Crea una història pendent per a l'usuari actual si no n'ha
-- reclamat cap (pendent o validada) aquesta setmana calendària.
-- PostgreSQL: date_trunc('week', now()) retorna dilluns 00:00.
create or replace function public.request_story(p_screenshot_path text)
returns table (id uuid, estado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_count   int;
  v_new_id  uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;
  if p_screenshot_path is null or length(trim(p_screenshot_path)) = 0 then
    raise exception 'screenshot_path required' using errcode = 'P0002';
  end if;

  -- Check: cap història pendent o validada aquesta setmana calendària
  -- (PostgreSQL ISO: la setmana comença en dilluns)
  select count(*) into v_count
    from public.stories s
    where s.user_id = v_user
      and s.estado in ('pendiente','validado')
      and s.created_at >= date_trunc('week', now());

  if v_count > 0 then
    raise exception 'already_claimed_this_week' using errcode = 'P0003';
  end if;

  insert into public.stories (user_id, screenshot_path)
    values (v_user, p_screenshot_path)
    returning public.stories.id into v_new_id;

  return query select v_new_id, 'pendiente'::text;
end;
$$;

revoke all on function public.request_story(text) from public;
grant execute on function public.request_story(text) to authenticated;


-- 4) RPC · PROCESS STORY (admin) -------------------------------
-- Valida o rebutja una història. Si es valida, suma els punts al
-- perfil de l'usuari i registra un moviment.
create or replace function public.process_story(
  p_story_id  uuid,
  p_action    text,     -- 'validate' | 'reject'
  p_motivo    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin  uuid := auth.uid();
  v_story  public.stories%rowtype;
begin
  if v_admin is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = v_admin and is_admin = true) then
    raise exception 'Not admin' using errcode = 'P0004';
  end if;

  if p_action not in ('validate','reject') then
    raise exception 'Invalid action' using errcode = 'P0005';
  end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found then
    raise exception 'story_not_found' using errcode = 'P0006';
  end if;

  if v_story.estado <> 'pendiente' then
    raise exception 'story_not_pending' using errcode = 'P0007';
  end if;

  if p_action = 'validate' then
    update public.stories
      set estado = 'validado',
          validado_at = now(),
          validado_por = v_admin
      where id = p_story_id;

    update public.profiles
      set puntos_total = coalesce(puntos_total, 0) + v_story.puntos_otorgados
      where id = v_story.user_id;

    insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
      values (v_story.user_id, v_story.puntos_otorgados, 'historia',
              'Història d''Instagram validada');
  else
    update public.stories
      set estado = 'rechazado',
          validado_at = now(),
          validado_por = v_admin,
          motivo_rechazo = p_motivo
      where id = p_story_id;
  end if;
end;
$$;

revoke all on function public.process_story(uuid, text, text) from public;
grant execute on function public.process_story(uuid, text, text) to authenticated;


-- =============================================================
-- Verificació manual (executar separadament):
--   select * from public.stories limit 5;
--   select * from storage.buckets where id = 'stories';
-- =============================================================
