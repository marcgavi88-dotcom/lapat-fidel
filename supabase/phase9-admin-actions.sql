-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 9 — Accions d'admin (punts + delete)
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Objectiu:
--   Donar a l'admin eines per:
--     · Ajustar punts manualment (sumar o restar) amb motiu
--       obligatori, registrant sempre un moviment.
--     · L'esborrat de comptes es fa des de l'API (Next.js)
--       amb el service role directament contra auth.admin.deleteUser(),
--       així que aquí només hi posem una vista amb el comptador
--       de files que es portarà per davant l'eliminació (informatiu).
--
-- Canvis:
--   1) RPC `ajustar_puntos_admin(p_user_id, p_delta, p_motivo)`:
--        - Comprova que qui crida és admin.
--        - Exigeix motiu no buit (min 3 caràcters).
--        - No permet deixar el saldo < 0.
--        - Afegeix moviment amb tipo='ajuste_admin'.
--   2) Vista `v_admin_user_impact(user_id)` — informa de quantes
--      files hi ha associades a un usuari (profiles, canjes,
--      movimientos_puntos, stories, reviews, invitaciones).
--      Serveix perquè el frontend mostri un resum abans de
--      confirmar el delete.
-- =============================================================

-- 1) RPC ajustar_puntos_admin -----------------------------------
create or replace function public.ajustar_puntos_admin(
  p_user_id uuid,
  p_delta integer,
  p_motivo text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
  v_saldo_actual integer;
  v_saldo_nou integer;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'no_autenticat');
  end if;

  select coalesce(is_admin, false) into v_is_admin
    from public.profiles where id = v_caller;
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('ok', false, 'error', 'no_admin');
  end if;

  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'usuari_buit');
  end if;

  if p_delta is null or p_delta = 0 then
    return jsonb_build_object('ok', false, 'error', 'delta_invalid');
  end if;

  if length(v_motivo) < 3 then
    return jsonb_build_object('ok', false, 'error', 'motiu_massa_curt');
  end if;

  select coalesce(puntos_total, 0) into v_saldo_actual
    from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'usuari_no_existeix');
  end if;

  v_saldo_nou := v_saldo_actual + p_delta;
  if v_saldo_nou < 0 then
    return jsonb_build_object(
      'ok', false, 'error', 'saldo_insuficient',
      'saldo_actual', v_saldo_actual,
      'delta', p_delta
    );
  end if;

  update public.profiles
    set puntos_total = v_saldo_nou, updated_at = now()
    where id = p_user_id;

  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
    values (
      p_user_id,
      p_delta,
      'ajuste_admin',
      'Ajust admin: ' || v_motivo
    );

  return jsonb_build_object(
    'ok', true,
    'saldo_anterior', v_saldo_actual,
    'saldo_nou', v_saldo_nou,
    'delta', p_delta
  );
end;
$fn$;

grant execute on function public.ajustar_puntos_admin(uuid, integer, text) to authenticated;

-- 2) Vista informativa v_admin_user_impact ---------------------
-- (Només la crea si no existeix. Si ja existia, DROP abans per
-- evitar el xoc de tipus de columnes.)
drop view if exists public.v_admin_user_impact;
create view public.v_admin_user_impact as
  select
    p.id as user_id,
    p.nombre,
    p.apellidos,
    p.email,
    p.puntos_total,
    (select count(*) from public.movimientos_puntos mp where mp.user_id = p.id) as n_moviments,
    (select count(*) from public.canjes c where c.user_id = p.id) as n_canjes,
    (select count(*) from public.stories s where s.user_id = p.id) as n_stories,
    (select count(*) from public.reviews r where r.user_id = p.id) as n_reviews,
    (select count(*) from public.invitaciones i where i.invitador_id = p.id or i.invitado_id = p.id) as n_invitaciones
  from public.profiles p;

-- RLS no s'aplica directament a vistes; però això és SELECT sobre
-- taules que ja tenen RLS pels usuaris normals. Els admins tenen
-- polítiques pròpies que permeten veure tots els perfils.
grant select on public.v_admin_user_impact to authenticated;

-- =============================================================
-- Verificació manual:
--   select public.ajustar_puntos_admin(
--     'UUID_DEL_USUARIO', 50, 'Bonus manual per incidència'
--   );
--   select * from public.v_admin_user_impact where user_id = 'UUID';
-- =============================================================
