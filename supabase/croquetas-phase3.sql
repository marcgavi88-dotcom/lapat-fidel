-- =============================================================
-- L'ÀPAT FIDEL · Migració: Fase 3 - Rànquing públic (dashboard)
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
--
-- Objectiu:
--   Exposar un top 10 de punts al dashboard mostrant nom + inicial
--   cognom, sense obrir RLS de `profiles`. Fem servir funcions
--   SECURITY DEFINER que retornen només les columnes segures.
--
-- Funcions creades:
--   1) get_ranking_top(p_limit int default 10)
--        -> taula (rang, nom_display, puntos_total, is_me)
--        'is_me' marca l'usuari actual si apareix al top
--   2) get_my_ranking()
--        -> taula (rang, puntos_total)
--        Retorna la posició de l'usuari actual (sempre que tingui > 0 punts)
-- =============================================================

-- 1) TOP N PÚBLIC ----------------------------------------------
create or replace function public.get_ranking_top(p_limit int default 10)
returns table (
  rang        int,
  nom_display text,
  puntos_total integer,
  is_me       boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  return query
  with base as (
    select
      p.id,
      p.nombre,
      p.apellidos,
      p.puntos_total,
      p.created_at
    from public.profiles p
    where coalesce(p.puntos_total, 0) > 0
  ),
  ranked as (
    select
      row_number() over (order by puntos_total desc, created_at asc)::int as rang,
      id,
      nombre,
      apellidos,
      puntos_total
    from base
  )
  select
    r.rang,
    -- Nom + inicial cognom (ex: "Marc G.")
    coalesce(nullif(trim(r.nombre), ''), '—')
      || case
           when r.apellidos is null or trim(r.apellidos) = '' then ''
           else ' ' || upper(left(trim(r.apellidos), 1)) || '.'
         end
      as nom_display,
    r.puntos_total,
    (r.id = v_user) as is_me
  from ranked r
  where r.rang <= greatest(p_limit, 1)
  order by r.rang asc;
end;
$$;

revoke all on function public.get_ranking_top(int) from public;
grant execute on function public.get_ranking_top(int) to authenticated;

-- 2) POSICIÓ DE L'USUARI ACTUAL --------------------------------
create or replace function public.get_my_ranking()
returns table (
  rang         int,
  puntos_total integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  return query
  with base as (
    select
      p.id,
      p.puntos_total,
      p.created_at
    from public.profiles p
    where coalesce(p.puntos_total, 0) > 0
  ),
  ranked as (
    select
      id,
      puntos_total,
      row_number() over (order by puntos_total desc, created_at asc)::int as rang
    from base
  )
  select r.rang, r.puntos_total
  from ranked r
  where r.id = v_user;
end;
$$;

revoke all on function public.get_my_ranking() from public;
grant execute on function public.get_my_ranking() to authenticated;

-- =============================================================
-- Verificació manual (copiar separadament al SQL editor):
--   select * from public.get_ranking_top(10);
--   select * from public.get_my_ranking();
-- =============================================================
