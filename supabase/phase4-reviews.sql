-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 4 — Ressenyes de Google
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Objectiu:
--   L'usuari deixa una ressenya de 5 estrelles a Google Maps, puja
--   una captura de pantalla com a prova, i quan l'admin la valida
--   guanya 100 punts. Màxim 1 reclamació per mes calendari.
--
-- Estructura:
--   1) Taula public.reviews
--   2) Bucket Storage 'reviews' amb RLS per carpeta d'usuari
--   3) RPC request_review(screenshot_path)
--   4) RPC process_review(review_id, action, motiu)
-- =============================================================

-- 1) TAULA -----------------------------------------------------
create table if not exists public.reviews (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  screenshot_path   text not null,
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente','validado','rechazado')),
  puntos_otorgados  integer not null default 100,
  created_at        timestamptz not null default now(),
  validado_at       timestamptz,
  validado_por      uuid references public.profiles(id),
  motivo_rechazo    text
);

create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists reviews_estado_idx on public.reviews(estado);
create index if not exists reviews_created_at_idx on public.reviews(created_at desc);

alter table public.reviews enable row level security;

-- L'usuari pot veure les seves ressenyes
drop policy if exists "reviews_own_select" on public.reviews;
create policy "reviews_own_select" on public.reviews
  for select
  using (user_id = auth.uid());

-- Els admins poden veure totes les ressenyes
drop policy if exists "reviews_admin_all" on public.reviews;
create policy "reviews_admin_all" on public.reviews
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
values ('reviews', 'reviews', false)
on conflict (id) do nothing;

-- Política: l'usuari pot pujar a la seva carpeta {user_id}/...
drop policy if exists "reviews_upload_own_folder" on storage.objects;
create policy "reviews_upload_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'reviews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Política: l'usuari pot llegir els seus propis fitxers
drop policy if exists "reviews_select_own" on storage.objects;
create policy "reviews_select_own"
  on storage.objects for select
  using (
    bucket_id = 'reviews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Política: l'admin pot llegir totes les ressenyes
drop policy if exists "reviews_select_admin" on storage.objects;
create policy "reviews_select_admin"
  on storage.objects for select
  using (
    bucket_id = 'reviews'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );


-- 3) RPC · REQUEST REVIEW --------------------------------------
-- Crea una ressenya pendent per a l'usuari actual si no n'ha
-- reclamat cap (pendent o validada) aquest mes calendari.
create or replace function public.request_review(p_screenshot_path text)
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

  -- Check: cap ressenya pendent o validada aquest mes calendari
  select count(*) into v_count
    from public.reviews r
    where r.user_id = v_user
      and r.estado in ('pendiente','validado')
      and r.created_at >= date_trunc('month', now());

  if v_count > 0 then
    raise exception 'already_claimed_this_month' using errcode = 'P0003';
  end if;

  insert into public.reviews (user_id, screenshot_path)
    values (v_user, p_screenshot_path)
    returning public.reviews.id into v_new_id;

  return query select v_new_id, 'pendiente'::text;
end;
$$;

revoke all on function public.request_review(text) from public;
grant execute on function public.request_review(text) to authenticated;


-- 4) RPC · PROCESS REVIEW (admin) ------------------------------
-- Valida o rebutja una ressenya. Si es valida, suma els punts al
-- perfil de l'usuari i registra un moviment.
create or replace function public.process_review(
  p_review_id uuid,
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
  v_review public.reviews%rowtype;
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

  select * into v_review from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'review_not_found' using errcode = 'P0006';
  end if;

  if v_review.estado <> 'pendiente' then
    raise exception 'review_not_pending' using errcode = 'P0007';
  end if;

  if p_action = 'validate' then
    update public.reviews
      set estado = 'validado',
          validado_at = now(),
          validado_por = v_admin
      where id = p_review_id;

    update public.profiles
      set puntos_total = coalesce(puntos_total, 0) + v_review.puntos_otorgados
      where id = v_review.user_id;

    insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
      values (v_review.user_id, v_review.puntos_otorgados, 'resena',
              'Ressenya de Google validada');
  else
    update public.reviews
      set estado = 'rechazado',
          validado_at = now(),
          validado_por = v_admin,
          motivo_rechazo = p_motivo
      where id = p_review_id;
  end if;
end;
$$;

revoke all on function public.process_review(uuid, text, text) from public;
grant execute on function public.process_review(uuid, text, text) to authenticated;


-- =============================================================
-- Verificació manual (executar separadament):
--   select * from public.reviews limit 5;
--   select * from storage.buckets where id = 'reviews';
-- =============================================================
