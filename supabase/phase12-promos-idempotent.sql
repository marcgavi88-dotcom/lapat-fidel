-- =============================================================
-- L'ÀPAT FIDEL · Fase 12.1 — reclamar_promo idempotent
-- =============================================================
-- Objectiu:
--   Millorar UX després del registre. Quan un usuari nou es
--   registra des de /promo/VINO2026 i torna al landing un cop
--   confirmat el correu, volem que la pàgina reclami el premi
--   automàticament. Per fer-ho de manera segura, la funció
--   reclamar_promo ha de ser idempotent: si l'usuari ja l'havia
--   reclamada, en comptes de fallar amb 'promo_ya_reclamada'
--   retornem el codi existent perquè el client el mostri.
--
--   Així:
--     · Primera visita logada → es crea el canje → es retorna codi
--     · Visites posteriors o doble click → es retorna el mateix codi
--     · Mai es generen dos canjes per un mateix usuari/promo
--
-- Idempotent. Executa sencer al SQL Editor de Supabase.
-- =============================================================

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
  v_existing_codigo text;
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

  -- Premi associat (per retornar nom i descripció en tots els camins)
  select * into v_premio from public.premios where id = v_promo.premio_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'premio_no_existe');
  end if;

  -- Aquest usuari ja l'ha reclamada? → retornem el codi existent (idempotent)
  select c.codigo_canje into v_existing_codigo
    from public.promos_canjes pc
    join public.canjes c on c.id = pc.canje_id
   where pc.promo_id = v_promo.id and pc.user_id = p_user_id;

  if v_existing_codigo is not null then
    return jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'codigo_canje', v_existing_codigo,
      'premio_nombre_ca', v_premio.nombre_ca,
      'premio_nombre_es', v_premio.nombre_es,
      'premio_descripcion_ca', v_premio.descripcion_ca,
      'premio_descripcion_es', v_premio.descripcion_es
    );
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
    'already_claimed', false,
    'codigo_canje', v_codigo_canje,
    'premio_nombre_ca', v_premio.nombre_ca,
    'premio_nombre_es', v_premio.nombre_es,
    'premio_descripcion_ca', v_premio.descripcion_ca,
    'premio_descripcion_es', v_premio.descripcion_es
  );
end;
$$;

grant execute on function public.reclamar_promo(text, uuid) to authenticated;
