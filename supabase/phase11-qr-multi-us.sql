-- =============================================================
-- L'ÀPAT FIDEL · Fase 11 - QR multi-ús (divisió per comensals)
-- =============================================================
-- Objectiu:
--   Permetre que un mateix QR el puguin escanejar fins a N comensals
--   diferents, cadascun 1 sol cop. Útil per taules que volen repartir
--   els punts d'un mateix ticket (240€ / 4 comensals → cadascú 60€).
--
-- Canvis:
--   1) qr_codes:    afegir `max_usos` (default 1) i `usos` (default 0).
--                   Semantica: puntos/croquetas són *per escaneig*.
--                   importe_euros manté el TOTAL del tiquet perquè
--                   l'admin continuï veient la consumició real.
--   2) reclamar_qr: rescrita per gestionar:
--        · usos < max_usos
--        · un mateix user NO pot reclamar dues vegades el mateix QR
--        · manté usado=true quan s'omple (retrocompatibilitat)
--        · serialitza concurrència amb FOR UPDATE a qr_codes
--
-- Idempotent. Executa sencer al SQL Editor.
-- =============================================================

alter table public.qr_codes
  add column if not exists max_usos integer not null default 1;

alter table public.qr_codes
  add column if not exists usos integer not null default 0;

-- Per a QRs antics (max_usos=1, usos=0 o 1) queda consistent perquè
-- si usado=true llavors usos >= max_usos (1) a efectes pràctics.

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
  v_ya_reclamat integer;
  v_nou_usos integer;
  v_max_usos integer;
  v_ple boolean;
begin
  -- Obtenir el QR amb lock (serialitza escanejos simultanis del mateix QR)
  select * into v_qr from public.qr_codes where codigo = p_codigo for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'qr_no_existe');
  end if;

  if v_qr.expira_at < now() then
    return jsonb_build_object('ok', false, 'error', 'qr_caducado');
  end if;

  v_max_usos := coalesce(v_qr.max_usos, 1);

  -- QRs antics: `usado=true` indica consumit (max_usos=1 i usos=1 o 0+usado)
  if v_qr.usado and coalesce(v_qr.usos, 0) >= v_max_usos then
    return jsonb_build_object('ok', false, 'error', 'qr_ya_usado');
  end if;
  if coalesce(v_qr.usos, 0) >= v_max_usos then
    -- Defensa extra: si usos ja ha arribat al màxim, tanquem
    update public.qr_codes set usado = true where id = v_qr.id;
    return jsonb_build_object('ok', false, 'error', 'qr_ya_usado');
  end if;

  -- Aquest usuari ja l'ha reclamat abans?
  select count(*) into v_ya_reclamat
    from public.movimientos_puntos
   where qr_id = v_qr.id and user_id = p_user_id;
  if v_ya_reclamat > 0 then
    return jsonb_build_object('ok', false, 'error', 'qr_ya_reclamado');
  end if;

  -- Lock del perfil per actualitzar punts/croquetes atòmicament
  select total_croquetas into v_old_croquetas
    from public.profiles where id = p_user_id for update;
  if v_old_croquetas is null then
    v_old_croquetas := 0;
  end if;
  v_new_croquetas := v_old_croquetas + coalesce(v_qr.croquetas, 0);

  v_tiradas_normales_novas := floor(v_new_croquetas / 12) - floor(v_old_croquetas / 12);
  v_tiradas_pro_novas := floor(v_new_croquetas / 100) - floor(v_old_croquetas / 100);

  -- Incrementar comptador d'usos; si omplim, marcar com a usat
  v_nou_usos := coalesce(v_qr.usos, 0) + 1;
  v_ple := v_nou_usos >= v_max_usos;

  update public.qr_codes
     set usos = v_nou_usos,
         usado = v_ple,
         usado_por = case when v_ple then p_user_id else v_qr.usado_por end,
         usado_at = case when v_ple then now() else v_qr.usado_at end,
         reservado_por_email = null,
         reservado_at = null
   where id = v_qr.id;

  -- Actualitzar perfil (punts i croquetes per escaneig)
  update public.profiles
     set puntos_total = puntos_total + v_qr.puntos,
         puntos_menu = case when v_qr.es_menu then puntos_menu + v_qr.puntos else puntos_menu end,
         total_croquetas = v_new_croquetas,
         tiradas_ruleta = tiradas_ruleta + v_tiradas_normales_novas,
         tiradas_ruleta_pro = tiradas_ruleta_pro + v_tiradas_pro_novas,
         updated_at = now()
   where id = p_user_id
   returning * into v_profile;

  -- Moviment (inclou qr_id, que és el que fem servir per evitar doble reclamació)
  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion, qr_id)
    values (p_user_id, v_qr.puntos, 'qr',
      case
        when v_max_usos > 1 then
          'Punts compartits de tiquet ' || v_qr.importe_euros || '€ (' || v_nou_usos || '/' || v_max_usos || ')'
        else
          'Punts per consumició de ' || v_qr.importe_euros || '€'
      end
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
    'tiradas_ruleta_pro', v_profile.tiradas_ruleta_pro,
    'max_usos', v_max_usos,
    'usos', v_nou_usos,
    'restants', greatest(v_max_usos - v_nou_usos, 0)
  );
end;
$$;

grant execute on function public.reclamar_qr(text, uuid) to authenticated;
