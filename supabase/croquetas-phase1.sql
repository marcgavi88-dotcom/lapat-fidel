-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 1 - Ruleta Croquetera
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Canvis:
--  1) qr_codes:  afegir columna `croquetas`
--  2) profiles:  afegir `total_croquetas`, `tiradas_ruleta`, `tiradas_ruleta_pro`
--  3) premios:   afegir entrades noves per a premis de ruleta PRO
--  4) reclamar_qr(): sumar croquetes i atorgar tirades (cada 12 → normal; cada 100 → PRO)
--  5) girar_ruleta(): accepta tipus ('normal' | 'pro'); consumeix 1 tirada
-- =============================================================

-- 1) QR_CODES ---------------------------------------------------
alter table public.qr_codes
  add column if not exists croquetas integer not null default 0;

-- Nota: mantenim `es_menu` per compatibilitat amb QR antics ja emesos,
-- però a partir d'ara el formulari ja no el pot activar (deprecated).

-- 2) PROFILES ---------------------------------------------------
alter table public.profiles
  add column if not exists total_croquetas integer not null default 0;

alter table public.profiles
  add column if not exists tiradas_ruleta integer not null default 0;

alter table public.profiles
  add column if not exists tiradas_ruleta_pro integer not null default 0;

-- 3) PREMIOS ---------------------------------------------------
-- Afegim els premis que pot repartir la Ruleta PRO (codigo_interno
-- per poder-los referenciar sense dependre del nom). Posem activo=false
-- per no dispersar el catàleg públic a /rewards.
insert into public.premios
  (nombre_ca, nombre_es, descripcion_ca, descripcion_es, puntos_necesarios, orden, activo, codigo_interno)
values
  ('Cafè gratis (ruleta)', 'Café gratis (ruleta)',
   'Premi guanyat a la ruleta. Bescanviable a la barra.', 'Premio ganado en la ruleta. Canjeable en la barra.',
   0, 100, false, 'ruleta_cafe'),
  ('Canya o copa de vi (ruleta)', 'Caña o copa de vino (ruleta)',
   'Premi guanyat a la ruleta. Bescanviable a la barra.', 'Premio ganado en la ruleta. Canjeable en la barra.',
   0, 101, false, 'ruleta_copa'),
  ('Postres gratis (ruleta)', 'Postre gratis (ruleta)',
   'Premi guanyat a la ruleta. Bescanviable a la barra.', 'Premio ganado en la ruleta. Canjeable en la barra.',
   0, 102, false, 'ruleta_postre'),
  ('Menú del migdia gratis (ruleta)', 'Menú del día gratis (ruleta)',
   'Premi gros de la ruleta PRO. Bescanviable a la sala.', 'Premio gordo de la ruleta PRO. Canjeable en la sala.',
   0, 103, false, 'ruleta_menu')
on conflict (codigo_interno) do nothing;

-- 4) FUNCIÓ reclamar_qr() ---------------------------------------
-- Sobreescriu la funció existent perquè també sumi croquetes i atorgui
-- tirades de ruleta quan es creuen múltiples de 12 i 100.
create or replace function public.reclamar_qr(p_codigo text, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_qr public.qr_codes%rowtype;
  v_profile public.profiles%rowtype;
  v_old_croquetas integer;
  v_new_croquetas integer;
  v_tiradas_normales_novas integer := 0;
  v_tiradas_pro_novas integer := 0;
begin
  -- Obtenir el QR amb lock
  select * into v_qr from public.qr_codes where codigo = p_codigo for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'qr_no_existe');
  end if;

  if v_qr.usado then
    return jsonb_build_object('ok', false, 'error', 'qr_ya_usado');
  end if;

  if v_qr.expira_at < now() then
    return jsonb_build_object('ok', false, 'error', 'qr_caducado');
  end if;

  -- Llegim el total actual de croquetes abans de sumar
  select total_croquetas into v_old_croquetas
    from public.profiles where id = p_user_id for update;
  if v_old_croquetas is null then
    v_old_croquetas := 0;
  end if;
  v_new_croquetas := v_old_croquetas + coalesce(v_qr.croquetas, 0);

  -- Quantes tirades noves s'han desbloquejat en creuar múltiples de 12 i 100
  v_tiradas_normales_novas := floor(v_new_croquetas / 12) - floor(v_old_croquetas / 12);
  v_tiradas_pro_novas := floor(v_new_croquetas / 100) - floor(v_old_croquetas / 100);

  -- Marcar QR com a usat
  update public.qr_codes
    set usado = true,
        usado_por = p_user_id,
        usado_at = now(),
        reservado_por_email = null,
        reservado_at = null
    where id = v_qr.id;

  -- Actualitzar perfil
  update public.profiles
    set puntos_total = puntos_total + v_qr.puntos,
        puntos_menu = case when v_qr.es_menu then puntos_menu + v_qr.puntos else puntos_menu end,
        total_croquetas = v_new_croquetas,
        tiradas_ruleta = tiradas_ruleta + v_tiradas_normales_novas,
        tiradas_ruleta_pro = tiradas_ruleta_pro + v_tiradas_pro_novas,
        updated_at = now()
    where id = p_user_id
    returning * into v_profile;

  -- Registrar moviment de punts
  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion, qr_id)
    values (p_user_id, v_qr.puntos, 'qr',
      'Punts per consumició de ' || v_qr.importe_euros || '€'
      || case when coalesce(v_qr.croquetas, 0) > 0
              then ' (+' || v_qr.croquetas || ' croquetes)'
              else '' end,
      v_qr.id);

  return jsonb_build_object(
    'ok', true,
    'puntos_ganados', v_qr.puntos,
    'puntos_total', v_profile.puntos_total,
    'puntos_menu', v_profile.puntos_menu,
    'es_menu', v_qr.es_menu,
    'croquetas_sumadas', coalesce(v_qr.croquetas, 0),
    'total_croquetas', v_profile.total_croquetas,
    'tiradas_nuevas', v_tiradas_normales_novas,
    'tiradas_pro_nuevas', v_tiradas_pro_novas,
    'tiradas_ruleta', v_profile.tiradas_ruleta,
    'tiradas_ruleta_pro', v_profile.tiradas_ruleta_pro
  );
end;
$$;

-- 5) FUNCIÓ girar_ruleta() ---------------------------------------
-- Reescrita: accepta p_tipo ('normal' o 'pro'). Ja no depèn del mes.
--   - Verifica tirades disponibles del tipus
--   - Decrementa 1 tirada
--   - Aplica taula de probabilitats del tipus
--   - Si el premi és bescanviable, crea codi a canjes i a giros_ruleta
create or replace function public.girar_ruleta(p_user_id uuid, p_tipo text default 'normal')
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_random numeric;
  v_premio text;
  v_puntos integer := 0;
  v_codigo text := null;
  v_premio_codigo_interno text := null;
  v_premio_id uuid := null;
  v_premio_nombre text := null;
begin
  if p_tipo not in ('normal', 'pro') then
    return jsonb_build_object('ok', false, 'error', 'tipo_invalido');
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'perfil_no_existe');
  end if;

  -- Comprovar tirades disponibles
  if p_tipo = 'normal' and v_profile.tiradas_ruleta <= 0 then
    return jsonb_build_object('ok', false, 'error', 'sin_tiradas');
  end if;
  if p_tipo = 'pro' and v_profile.tiradas_ruleta_pro <= 0 then
    return jsonb_build_object('ok', false, 'error', 'sin_tiradas_pro');
  end if;

  v_random := random();

  if p_tipo = 'normal' then
    -- Ruleta Normal (cada 12 croquetes): majoritàriament punts
    --  30% +15 pts
    --  25% +10 pts
    --  20% +25 pts
    --  10% +50 pts
    --   5% cafè gratis (canjeable)
    --   5% canya o copa de vi gratis (canjeable)
    --   5% +5 pts (consolació)
    if v_random < 0.30 then
      v_premio := '15_puntos'; v_puntos := 15;
    elsif v_random < 0.55 then
      v_premio := '10_puntos'; v_puntos := 10;
    elsif v_random < 0.75 then
      v_premio := '25_puntos'; v_puntos := 25;
    elsif v_random < 0.85 then
      v_premio := '50_puntos'; v_puntos := 50;
    elsif v_random < 0.90 then
      v_premio := 'cafe_gratis';
      v_premio_codigo_interno := 'ruleta_cafe';
    elsif v_random < 0.95 then
      v_premio := 'copa_gratis';
      v_premio_codigo_interno := 'ruleta_copa';
    else
      v_premio := '5_puntos'; v_puntos := 5;
    end if;
  else
    -- Ruleta PRO (cada 100 croquetes): tot canjeable
    --  60% cafè gratis
    --  25% canya o copa de vi
    --  13% postre gratis
    --   1% ampolla de vi de la casa (extra) → aquí reutilitzem ruleta_copa amb nota
    --   1% menú del migdia gratis (premi gros)
    if v_random < 0.60 then
      v_premio := 'cafe_gratis';
      v_premio_codigo_interno := 'ruleta_cafe';
    elsif v_random < 0.85 then
      v_premio := 'copa_gratis';
      v_premio_codigo_interno := 'ruleta_copa';
    elsif v_random < 0.98 then
      v_premio := 'postre_gratis';
      v_premio_codigo_interno := 'ruleta_postre';
    elsif v_random < 0.99 then
      v_premio := 'copa_gratis';
      v_premio_codigo_interno := 'ruleta_copa';
    else
      v_premio := 'menu_gratis';
      v_premio_codigo_interno := 'ruleta_menu';
    end if;
  end if;

  -- Si és un premi canjeable, generar codi i crear entrada a `canjes`
  if v_premio_codigo_interno is not null then
    select id, nombre_es into v_premio_id, v_premio_nombre
      from public.premios where codigo_interno = v_premio_codigo_interno limit 1;

    v_codigo := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));

    if v_premio_id is not null then
      insert into public.canjes (user_id, premio_id, puntos_usados, codigo_canje)
        values (p_user_id, v_premio_id, 0, v_codigo);

      insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
        values (p_user_id, 0, 'ruleta',
          'Premi ruleta ' || p_tipo || ': ' || coalesce(v_premio_nombre, v_premio));
    end if;
  end if;

  -- Decrementar la tirada consumida i registrar últim gir
  if p_tipo = 'normal' then
    update public.profiles
      set tiradas_ruleta = tiradas_ruleta - 1,
          ultimo_giro_ruleta = now(),
          puntos_total = puntos_total + v_puntos,
          updated_at = now()
      where id = p_user_id;
  else
    update public.profiles
      set tiradas_ruleta_pro = tiradas_ruleta_pro - 1,
          ultimo_giro_ruleta = now(),
          puntos_total = puntos_total + v_puntos,
          updated_at = now()
      where id = p_user_id;
  end if;

  -- Registrar el gir (per historial)
  insert into public.giros_ruleta (user_id, premio_obtenido, puntos_ganados, codigo_canje)
    values (p_user_id, v_premio || ':' || p_tipo, v_puntos, v_codigo);

  -- Si el premi són punts, també registrem moviment
  if v_puntos > 0 then
    insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
      values (p_user_id, v_puntos, 'ruleta',
        'Premi ruleta ' || p_tipo || ': +' || v_puntos || ' punts');
  end if;

  return jsonb_build_object(
    'ok', true,
    'premio', v_premio,
    'puntos', v_puntos,
    'codigo_canje', v_codigo,
    'tipo', p_tipo
  );
end;
$$;

-- Re-grantjar les funcions (per si el CREATE OR REPLACE les ha tornat)
grant execute on function public.reclamar_qr(text, uuid) to authenticated;
grant execute on function public.girar_ruleta(uuid, text) to authenticated;

-- Compatibilitat: la signatura antiga de girar_ruleta(uuid) ja no existeix.
-- Si el frontend o altres llocs el criden sense tipus, la crida fallarà.
-- El codi de l'app ja s'actualitza per passar 'p_tipo'.
