-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 8 — Apadrinar amics (referrals)
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Objectiu:
--   Programa d'apadrinament: cada usuari té un codi únic per
--   compartir. Quan un nou client es registra amb aquest codi i
--   arriba a 200 punts propis (reals, amb QR d'admin), tots dos
--   reben 50 punts. Això evita fraus amb comptes falsos.
--
-- Canvis:
--   1) profiles: columnes `codigo_invitacion` (únic, generat
--      automàticament) i `invitado_por` (FK a profiles).
--   2) handle_new_user(): genera codi únic i accepta
--      codi_invitacion del metadata (reclamar en el moment del registre).
--   3) Taula `invitaciones` (estat: pendent / desbloquejada).
--   4) RPC `reclamar_invitacion(p_codigo)` — crida opcional
--      després del signup (p_codigo ja es pot haver recollit via ?ref=).
--   5) Trigger a profiles quan puja puntos_total → si creuem 200,
--      desbloquegem invitacions pendents on l'usuari és l'invitat.
-- =============================================================

-- 1) PROFILES ---------------------------------------------------
alter table public.profiles
  add column if not exists codigo_invitacion text;

alter table public.profiles
  add column if not exists invitado_por uuid references public.profiles(id);

-- Índex únic (només entre codis no nuls)
create unique index if not exists profiles_codigo_invitacion_key
  on public.profiles(codigo_invitacion)
  where codigo_invitacion is not null;

-- Funció per generar un codi de 6 caràcters A-Z 2-9 (sense 0 1 I O L)
create or replace function public.generar_codigo_invitacion()
returns text
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_len int := 6;
  v_attempt int := 0;
  i int;
begin
  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..v_len loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    if not exists (select 1 from public.profiles where codigo_invitacion = v_code) then
      return v_code;
    end if;
    if v_attempt > 20 then
      -- Fallback: afegim timestamp per garantir unicitat
      return v_code || substr(md5(clock_timestamp()::text), 1, 2);
    end if;
  end loop;
end;
$fn$;

-- Backfill: assignar codi als perfils existents que no en tenen
update public.profiles
  set codigo_invitacion = public.generar_codigo_invitacion()
  where codigo_invitacion is null;

-- 2) Taula invitaciones ---------------------------------------
create table if not exists public.invitaciones (
  id uuid primary key default uuid_generate_v4(),
  invitador_id uuid not null references public.profiles(id) on delete cascade,
  invitado_id uuid not null references public.profiles(id) on delete cascade,
  codigo_usado text not null,
  estado text not null default 'pendent', -- 'pendent' | 'desbloquejada'
  puntos_invitador integer not null default 50,
  puntos_invitado integer not null default 50,
  created_at timestamp with time zone not null default now(),
  desbloquejada_at timestamp with time zone,
  constraint invitaciones_no_self check (invitador_id <> invitado_id),
  constraint invitaciones_invitado_unique unique (invitado_id) -- 1 invitació per invitat
);

create index if not exists invitaciones_invitador_idx on public.invitaciones(invitador_id);
create index if not exists invitaciones_estado_idx on public.invitaciones(estado);

alter table public.invitaciones enable row level security;

drop policy if exists "users_view_own_invitaciones" on public.invitaciones;
create policy "users_view_own_invitaciones" on public.invitaciones
  for select using (auth.uid() = invitador_id or auth.uid() = invitado_id);

-- (Cap política d'insert/update/delete per usuaris — només via RPC)

-- 3) handle_new_user actualitzat: genera codi i accepta codi d'invitació
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_fecha date;
  v_codi text := public.generar_codigo_invitacion();
  v_codi_invitador text;
  v_invitador_id uuid;
begin
  -- Parsejar fecha_nacimiento amb tolerància
  begin
    v_fecha := nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date;
  exception when others then
    v_fecha := null;
  end;

  -- Buscar invitador pel codi que ha passat (si s'ha passat)
  v_codi_invitador := upper(trim(coalesce(new.raw_user_meta_data->>'codigo_invitacion', '')));
  if v_codi_invitador <> '' then
    select id into v_invitador_id
      from public.profiles
      where codigo_invitacion = v_codi_invitador
      limit 1;
  end if;

  insert into public.profiles
    (id, email, nombre, apellidos, telefono, acepta_promociones,
     acepta_terminos, idioma, fecha_nacimiento, codigo_invitacion, invitado_por)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellidos', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce((new.raw_user_meta_data->>'acepta_promociones')::boolean, false),
    true,
    coalesce(new.raw_user_meta_data->>'idioma', 'ca'),
    v_fecha,
    v_codi,
    v_invitador_id
  );

  -- Crear registre d'invitació en estat pendent si aplica
  if v_invitador_id is not null then
    insert into public.invitaciones
      (invitador_id, invitado_id, codigo_usado, estado)
    values (v_invitador_id, new.id, v_codi_invitador, 'pendent')
    on conflict (invitado_id) do nothing;
  end if;

  return new;
end;
$fn$;

-- 4) RPC reclamar_invitacion -----------------------------------
-- Serveix per usuaris que ja s'havien registrat sense el codi i el
-- volen aplicar més tard (edge case). Només funciona si encara no
-- tenen invitado_por.
create or replace function public.reclamar_invitacion(p_codigo text)
returns jsonb
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_invitador_id uuid;
  v_codi text := upper(trim(p_codigo));
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_autenticat');
  end if;

  if v_codi is null or v_codi = '' then
    return jsonb_build_object('ok', false, 'error', 'codi_buit');
  end if;

  -- Ja té invitador?
  if exists (select 1 from public.profiles where id = v_user_id and invitado_por is not null) then
    return jsonb_build_object('ok', false, 'error', 'ja_apadrinat');
  end if;

  -- Buscar invitador
  select id into v_invitador_id
    from public.profiles
    where codigo_invitacion = v_codi
    limit 1;

  if v_invitador_id is null then
    return jsonb_build_object('ok', false, 'error', 'codi_invalid');
  end if;

  if v_invitador_id = v_user_id then
    return jsonb_build_object('ok', false, 'error', 'no_auto_apadrinar');
  end if;

  -- Guardar invitador al perfil
  update public.profiles
    set invitado_por = v_invitador_id, updated_at = now()
    where id = v_user_id;

  -- Crear la invitació en pendent
  insert into public.invitaciones
    (invitador_id, invitado_id, codigo_usado, estado)
  values (v_invitador_id, v_user_id, v_codi, 'pendent')
  on conflict (invitado_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$fn$;

grant execute on function public.reclamar_invitacion(text) to authenticated;

-- 5) Desbloqueig automàtic en arribar a 200 pts ---------------
create or replace function public.desbloquejar_invitacio_si_cal(p_invitat_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_inv public.invitaciones%rowtype;
  v_puntos_invitat integer;
  v_llindar integer := 200;
begin
  -- Agafem la invitació pendent (si n'hi ha)
  select * into v_inv
    from public.invitaciones
    where invitado_id = p_invitat_id and estado = 'pendent'
    limit 1;

  if not found then
    return;
  end if;

  -- Punts reals acumulats de l'invitat (no comptem els que vingui de
  -- la mateixa invitació, però al moment d'aquesta crida encara no
  -- s'han pagat)
  select coalesce(puntos_total, 0) into v_puntos_invitat
    from public.profiles where id = p_invitat_id;

  if v_puntos_invitat < v_llindar then
    return;
  end if;

  -- Tot OK → desbloquegem
  update public.invitaciones
    set estado = 'desbloquejada', desbloquejada_at = now()
    where id = v_inv.id;

  -- Pagar a invitador
  update public.profiles
    set puntos_total = puntos_total + v_inv.puntos_invitador,
        updated_at = now()
    where id = v_inv.invitador_id;

  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
    values (v_inv.invitador_id, v_inv.puntos_invitador, 'apadrinar',
            'Apadrinament desbloquejat (+' || v_inv.puntos_invitador || ' pts)');

  -- Pagar a invitat
  update public.profiles
    set puntos_total = puntos_total + v_inv.puntos_invitado,
        updated_at = now()
    where id = v_inv.invitado_id;

  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
    values (v_inv.invitado_id, v_inv.puntos_invitado, 'apadrinar',
            'Benvinguda d''apadrinament (+' || v_inv.puntos_invitado || ' pts)');
end;
$fn$;

-- Trigger: quan profiles.puntos_total es modifica, comprovem si cal desbloquejar
create or replace function public.tg_profiles_check_desbloqueig()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
begin
  if new.puntos_total is distinct from old.puntos_total
     and new.puntos_total >= 200 and coalesce(old.puntos_total, 0) < 200 then
    perform public.desbloquejar_invitacio_si_cal(new.id);
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_check_desbloqueig on public.profiles;
create trigger profiles_check_desbloqueig
  after update of puntos_total on public.profiles
  for each row execute procedure public.tg_profiles_check_desbloqueig();

-- =============================================================
-- Verificació manual:
--   select id, nombre, codigo_invitacion, invitado_por from public.profiles;
--   select * from public.invitaciones order by created_at desc limit 20;
--   select public.reclamar_invitacion('XYZABC');
-- =============================================================
