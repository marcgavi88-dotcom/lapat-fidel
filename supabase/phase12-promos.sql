-- =============================================================
-- L'ÀPAT FIDEL · Fase 12 — Promos genèriques per mailing
-- =============================================================
-- Objectiu:
--   Permetre repartir un mateix codi de promoció (p.ex. "VINO2026")
--   per email/xarxes socials de manera que cada usuari registrat
--   el pugui reclamar UNA sola vegada, generant un canje normal
--   que apareix a "Els meus premis" (/dashboard) i que l'admin
--   valida a /admin/redemptions com qualsevol altre canje.
--
-- Casos d'ús previstos:
--   · Mailing botella de vi gratis ("VINO2026")
--   · Promos puntuals amb caducitat
--
-- Idempotent. Executa sencer al SQL Editor de Supabase.
-- =============================================================

-- 0) Pre-requisit: codigo_interno a premios (ja creat per welcome-coffee.sql,
--    repetim per si aquest fitxer s'executa en un entorn net).
alter table public.premios
  add column if not exists codigo_interno text;

create unique index if not exists idx_premios_codigo_interno
  on public.premios(codigo_interno);

-- 1) Premi "Botella de vi gratis".
--    activo = false: no surt al catàleg /rewards (no es pot canviar per punts).
--    Només es pot obtenir reclamant un codi promocional.
insert into public.premios
  (nombre_ca, nombre_es, descripcion_ca, descripcion_es,
   puntos_necesarios, orden, activo, codigo_interno)
values
  ('Botella de vi gratis',
   'Botella de vino gratis',
   'Regal de la casa per celebrar amb tu. Bescanviable a taula.',
   'Regalo de la casa para celebrar contigo. Canjeable en mesa.',
   0, 0, false, 'botella_vi')
on conflict (codigo_interno) do nothing;

-- 2) Taula promos: defineix codis de promoció reclamables.
create table if not exists public.promos (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique,                  -- ex: "VINO2026"
  premio_id uuid not null references public.premios(id),
  expira_at timestamp with time zone not null,
  activa boolean not null default true,
  descripcion_ca text,
  descripcion_es text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_promos_codigo on public.promos(codigo);

-- 3) Taula promos_canjes: tracking de qui ha reclamat què (1 per usuari).
create table if not exists public.promos_canjes (
  promo_id uuid not null references public.promos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  canje_id uuid not null references public.canjes(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (promo_id, user_id)
);

create index if not exists idx_promos_canjes_user on public.promos_canjes(user_id);

-- 4) RLS — promos és consultable per tothom (per /api/promo/info), els
--    canjes només per l'usuari propietari (a través de promos_canjes).
alter table public.promos enable row level security;
alter table public.promos_canjes enable row level security;

drop policy if exists "everyone_select_promos" on public.promos;
create policy "everyone_select_promos" on public.promos
  for select using (true);

drop policy if exists "admins_all_promos" on public.promos;
create policy "admins_all_promos" on public.promos
  for all using (public.is_admin());

drop policy if exists "users_select_own_promos_canjes" on public.promos_canjes;
create policy "users_select_own_promos_canjes" on public.promos_canjes
  for select using (auth.uid() = user_id);

drop policy if exists "admins_all_promos_canjes" on public.promos_canjes;
create policy "admins_all_promos_canjes" on public.promos_canjes
  for all using (public.is_admin());

-- 5) Funció reclamar_promo:
--    · valida codi, activa, no caducat
--    · serialitza amb FOR UPDATE
--    · evita doble-reclamació per usuari
--    · crea entrada a canjes (apareix a "Els meus premis")
--    · registra moviment informatiu (0 punts)
--    · retorna codigo_canje perquè el client el mostri
create or replace function public.reclamar_promo(p_codigo text, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_promo public.promos%rowtype;
  v_premio public.premios%rowtype;
  v_canje_id uuid;
  v_codigo_canje text;
  v_ja_reclamat integer;
begin
  -- Codi normalitzat (uppercase, trim) per ser tolerants amb el que escriu l'usuari
  select * into v_promo
    from public.promos
   where upper(codigo) = upper(trim(p_codigo))
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'promo_no_existe');
  end if;

  if not v_promo.activa then
    return jsonb_build_object('ok', false, 'error', 'promo_inactiva');
  end if;

  if v_promo.expira_at < now() then
    return jsonb_build_object('ok', false, 'error', 'promo_caducada');
  end if;

  -- Aquest usuari ja l'ha reclamada?
  select count(*) into v_ja_reclamat
    from public.promos_canjes
   where promo_id = v_promo.id and user_id = p_user_id;

  if v_ja_reclamat > 0 then
    return jsonb_build_object('ok', false, 'error', 'promo_ya_reclamada');
  end if;

  -- Premi associat (per retornar nom i descripció)
  select * into v_premio from public.premios where id = v_promo.premio_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'premio_no_existe');
  end if;

  -- Generar codigo_canje únic (mateix format que les altres rutes)
  v_codigo_canje := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.canjes (user_id, premio_id, puntos_usados, codigo_canje)
    values (p_user_id, v_promo.premio_id, 0, v_codigo_canje)
    returning id into v_canje_id;

  insert into public.promos_canjes (promo_id, user_id, canje_id)
    values (v_promo.id, p_user_id, v_canje_id);

  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
    values (p_user_id, 0, 'canje',
            'Promo reclamada (' || v_promo.codigo || '): ' || v_premio.nombre_ca);

  return jsonb_build_object(
    'ok', true,
    'codigo_canje', v_codigo_canje,
    'premio_nombre_ca', v_premio.nombre_ca,
    'premio_nombre_es', v_premio.nombre_es,
    'premio_descripcion_ca', v_premio.descripcion_ca,
    'premio_descripcion_es', v_premio.descripcion_es
  );
end;
$$;

grant execute on function public.reclamar_promo(text, uuid) to authenticated;

-- 6) Seed: la promo del mailing actual de botella de vi.
--    Caduca 30 dies des de la creació.
insert into public.promos (codigo, premio_id, expira_at, descripcion_ca, descripcion_es)
select
  'VINO2026',
  p.id,
  now() + interval '30 days',
  'Botella de vi gratis per als clients del club',
  'Botella de vino gratis para los clientes del club'
from public.premios p
where p.codigo_interno = 'botella_vi'
on conflict (codigo) do nothing;
