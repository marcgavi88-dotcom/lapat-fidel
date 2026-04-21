-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 6 — Rebalanceig del sistema de punts
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Objectiu:
--   Ajustar el catàleg de premis i les vies extra perquè l'escala
--   de retorn al client estigui equilibrada (5-9% segons esglaó)
--   i afegir esglaons intermedis perquè l'usuari sempre tingui
--   un premi raonablement a tocar.
--
-- Canvis:
--   1) Assignar codigo_interno als premis actius existents
--   2) Recalibrar puntos_necesarios i orden del catàleg:
--        · Cafè:           125 → 70
--        · Copa de vi/canya:   NOU (100)
--        · Postres:        200 → 175
--        · Menú del dia:   500 → 450
--        · Arròs 1 pers.:      NOU (550)
--        · Arròs 2 pers.:  1000 (igual, orden nou)
--        · Sopar 2 pers.:  2000 (sense canvi, orden nou)
--        · Ganivet pro:    2500 (sense canvi, orden nou)
--   3) Stories d'Instagram: default 50 → 30 pts
--   4) Ruleta PRO: redistribuir probabilitats perquè el premi
--      mig sigui més generós (més postres, menys cafè).
-- =============================================================

-- 1) Assignar codigo_interno als premis actius que encara no en tenen.
--    Ho fem per nombre_es exacte (els noms són estables des del seed
--    original). Si l'índex únic ja té el codi, l'UPDATE filtrat per
--    `codigo_interno is null` fa el canvi una única vegada.
update public.premios
  set codigo_interno = 'cafe'
  where nombre_es = 'Café gratis' and codigo_interno is null;

update public.premios
  set codigo_interno = 'postres'
  where nombre_es = 'Postre gratis' and codigo_interno is null;

update public.premios
  set codigo_interno = 'menu_dia'
  where nombre_es = 'Menú de mediodía gratis' and codigo_interno is null;

update public.premios
  set codigo_interno = 'arros_2'
  where nombre_es = 'Arroz para 2 personas' and codigo_interno is null;

update public.premios
  set codigo_interno = 'sopar_2'
  where nombre_es = 'Cena para 2 personas' and codigo_interno is null;

update public.premios
  set codigo_interno = 'ganivet'
  where nombre_es = 'Cuchillo de cocina profesional' and codigo_interno is null;

-- 2a) Recalibrar els premis existents (costos i ordre)
update public.premios
  set puntos_necesarios = 70,
      orden = 1
  where codigo_interno = 'cafe';

update public.premios
  set puntos_necesarios = 175,
      orden = 3
  where codigo_interno = 'postres';

update public.premios
  set puntos_necesarios = 450,
      orden = 4
  where codigo_interno = 'menu_dia';

update public.premios
  set puntos_necesarios = 1000,
      orden = 6
  where codigo_interno = 'arros_2';

update public.premios
  set puntos_necesarios = 2000,
      orden = 7
  where codigo_interno = 'sopar_2';

update public.premios
  set puntos_necesarios = 2500,
      orden = 8
  where codigo_interno = 'ganivet';

-- 2b) Afegir els dos nous premis (idempotent via codigo_interno únic)
insert into public.premios
  (nombre_ca, nombre_es, descripcion_ca, descripcion_es,
   puntos_necesarios, orden, activo, codigo_interno)
values
  ('Copa de vi o canya',
   'Copa de vino o caña',
   'Una copa de vi de la casa o una canya.',
   'Una copa de vino de la casa o una caña.',
   100, 2, true, 'copa'),
  ('Arròs per a 1 persona',
   'Arroz para 1 persona',
   'Arròs a escollir de la carta (ració individual).',
   'Arroz a elegir de la carta (ración individual).',
   550, 5, true, 'arros_1')
on conflict (codigo_interno) do nothing;

-- 3) Stories d'Instagram: passar el default de 50 a 30 punts.
--    Les files ja creades mantenen el valor amb què van néixer
--    (és el que ja han guanyat o estan a punt de guanyar). Només
--    actualitzem les pendents, perquè el puntos_otorgados es llegeix
--    en el moment de validar-les.
alter table public.stories
  alter column puntos_otorgados set default 30;

update public.stories
  set puntos_otorgados = 30
  where estado = 'pendiente' and puntos_otorgados = 50;

-- 4) Ruleta PRO: redistribuir probabilitats.
--    Normal es manté idèntica. PRO passa de 60/25/13/1/1
--    (cafè/copa/postre/copa_extra/menú) a 40/28/30/1/1.
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
    --  30% +15 pts / 25% +10 pts / 20% +25 pts / 10% +50 pts
    --   5% cafè gratis / 5% copa gratis / 5% +5 pts (consolació)
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
    -- Ruleta PRO (cada 100 croquetes): tot canjeable, premi mig + generós.
    --  40% cafè gratis
    --  28% copa o canya
    --  30% postres gratis
    --   1% ampolla de vi de la casa (reutilitzem ruleta_copa com a "extra")
    --   1% menú del migdia gratis (premi gros)
    if v_random < 0.40 then
      v_premio := 'cafe_gratis';
      v_premio_codigo_interno := 'ruleta_cafe';
    elsif v_random < 0.68 then
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

grant execute on function public.girar_ruleta(uuid, text) to authenticated;

-- =============================================================
-- Verificació manual (copiar separadament al SQL editor):
--   select nombre_es, puntos_necesarios, orden, codigo_interno, activo
--     from public.premios where activo = true
--     order by orden asc;
-- =============================================================
