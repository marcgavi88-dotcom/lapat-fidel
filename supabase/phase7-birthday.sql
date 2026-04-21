-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 7 — Bonus d'aniversari
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Objectiu:
--   Premiar el client el dia del seu aniversari amb +75 punts
--   automàtics. Finestra de 7 dies (des del mateix dia del cumple),
--   una sola vegada l'any.
--
-- Canvis:
--   1) profiles: afegir `fecha_nacimiento` (opcional)
--               i `ultimo_bonus_aniversario` (data de reclamació)
--   2) handle_new_user(): acceptar fecha_nacimiento al meta_data
--   3) RPC `conceder_bonus_aniversario(p_user_id)` que comprova
--      la finestra + si no s'ha reclamat ja enguany, i suma els pts.
-- =============================================================

-- 1) PROFILES ---------------------------------------------------
alter table public.profiles
  add column if not exists fecha_nacimiento date;

alter table public.profiles
  add column if not exists ultimo_bonus_aniversario date;

-- 2) Trigger de creació de perfil — acceptar fecha_nacimiento del metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_fecha date;
begin
  -- Parsejar fecha_nacimiento amb tolerància (si ve mal format, l'ignorem)
  begin
    v_fecha := nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date;
  exception when others then
    v_fecha := null;
  end;

  insert into public.profiles
    (id, email, nombre, apellidos, telefono, acepta_promociones,
     acepta_terminos, idioma, fecha_nacimiento)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellidos', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce((new.raw_user_meta_data->>'acepta_promociones')::boolean, false),
    true,
    coalesce(new.raw_user_meta_data->>'idioma', 'ca'),
    v_fecha
  );
  return new;
end;
$$;

-- 3) RPC conceder_bonus_aniversario ----------------------------
create or replace function public.conceder_bonus_aniversario(p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_bday_this_year date;
  v_today date := current_date;
  v_puntos integer := 75;
  v_year int := extract(year from v_today)::int;
  v_month int;
  v_day int;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'perfil_no_existe');
  end if;

  if v_profile.fecha_nacimiento is null then
    return jsonb_build_object('ok', false, 'error', 'data_no_configurada');
  end if;

  v_month := extract(month from v_profile.fecha_nacimiento)::int;
  v_day   := extract(day   from v_profile.fecha_nacimiento)::int;

  -- Calcular aniversari d'enguany (gestiona 29 feb → 28 feb en any no bisiest)
  begin
    v_bday_this_year := make_date(v_year, v_month, v_day);
  exception when datetime_field_overflow or invalid_datetime_format then
    v_bday_this_year := make_date(v_year, v_month, 28);
  end;

  -- Finestra: des de l'aniversari fins a 6 dies després (7 dies inclosos)
  if v_today < v_bday_this_year or v_today > v_bday_this_year + interval '6 days' then
    return jsonb_build_object('ok', false, 'error', 'fora_de_finestra');
  end if;

  -- Ja reclamat enguany?
  if v_profile.ultimo_bonus_aniversario is not null
     and extract(year from v_profile.ultimo_bonus_aniversario)::int = v_year then
    return jsonb_build_object('ok', false, 'error', 'ja_reclamat');
  end if;

  -- Tot OK → concedim els punts
  update public.profiles
    set puntos_total = puntos_total + v_puntos,
        ultimo_bonus_aniversario = v_today,
        updated_at = now()
    where id = p_user_id;

  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
    values (p_user_id, v_puntos, 'aniversario', 'Bonus d''aniversari (+' || v_puntos || ' pts)');

  return jsonb_build_object(
    'ok', true,
    'puntos', v_puntos,
    'fecha', v_today
  );
end;
$$;

grant execute on function public.conceder_bonus_aniversario(uuid) to authenticated;

-- =============================================================
-- Verificació manual:
--   select id, nombre, fecha_nacimiento, ultimo_bonus_aniversario
--     from public.profiles where fecha_nacimiento is not null;
--
--   select public.conceder_bonus_aniversario(auth.uid());
-- =============================================================
