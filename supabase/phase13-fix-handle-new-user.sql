-- =============================================================
-- L'ÀPAT FIDEL · Fase 13 — FIX handle_new_user (cafè + invitació)
-- =============================================================
-- Bug detectat:
--   phase8-referrals.sql va sobreescriure handle_new_user per afegir
--   la lògica de codi d'invitació, però va PERDRE la lògica del cafè
--   de benvinguda (welcome-coffee.sql). Resultat: usuaris registrats
--   via QR cartell `/register?promo=cafe` no reben cap canje de cafè.
--
-- Aquesta migració reuneix les dues lògiques en una sola versió
-- definitiva del trigger:
--   1. Crear perfil amb fecha_nacimiento i codi d'invitació
--   2. Si ve promo_benvinguda=true → crear canje cafè automàticament
--   3. Si ve un codi d'invitador vàlid → registrar invitació
--
-- Idempotent. Reaplicar a producció no causa cap efecte advers.
-- =============================================================

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
  v_premio_id uuid;
  v_codigo_canje text;
begin
  -- Parsejar fecha_nacimiento amb tolerància (ve com a string del metadata)
  begin
    v_fecha := nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date;
  exception when others then
    v_fecha := null;
  end;

  -- Detectar invitador pel codi (si s'ha passat al signup)
  v_codi_invitador := upper(trim(coalesce(new.raw_user_meta_data->>'codigo_invitacion', '')));
  if v_codi_invitador <> '' then
    select id into v_invitador_id
      from public.profiles
      where codigo_invitacion = v_codi_invitador
      limit 1;
  end if;

  -- 1) Crear perfil
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

  -- 2) Registrar invitació pendent si aplica
  if v_invitador_id is not null then
    insert into public.invitaciones
      (invitador_id, invitado_id, codigo_usado, estado)
    values (v_invitador_id, new.id, v_codi_invitador, 'pendent')
    on conflict (invitado_id) do nothing;
  end if;

  -- 3) Cafè de benvinguda (si el signup ve del QR `/register?promo=cafe`)
  if coalesce((new.raw_user_meta_data->>'promo_benvinguda')::boolean, false) then
    select id into v_premio_id
      from public.premios
     where codigo_interno = 'cafe_benvinguda'
     limit 1;

    if v_premio_id is not null then
      v_codigo_canje := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));

      insert into public.canjes (user_id, premio_id, puntos_usados, codigo_canje)
        values (new.id, v_premio_id, 0, v_codigo_canje);

      update public.profiles
        set regalo_benvinguda_reclamat = true
        where id = new.id;

      insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
        values (new.id, 0, 'canje', 'Regal de benvinguda: cafè gratis');
    end if;
  end if;

  return new;
end;
$fn$;

-- Reinstal·lem el trigger per assegurar que apunta a la versió correcta.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
