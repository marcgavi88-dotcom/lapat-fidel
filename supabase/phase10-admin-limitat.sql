-- =============================================================
-- L'ÀPAT FIDEL · Fase 10 - Admin limitat
-- =============================================================
-- Afegeix una variant d'admin "limitat" que no pot veure ni gestionar
-- les seccions de Clients, Notícies ni Butlletí.
--
-- Un admin limitat té:
--   · is_admin = true           (segueix sent admin a tots els efectes)
--   · is_admin_limitado = true  (però amb les 3 seccions capades)
--
-- Executa aquest fitxer al SQL Editor de Supabase. Idempotent.
-- =============================================================

alter table public.profiles
  add column if not exists is_admin_limitado boolean not null default false;

-- Nota: la restricció real s'aplica a la capa d'aplicació (layout.tsx i
-- handlers /api/admin/*). Les polítiques RLS existents no canvien
-- perquè els admins limitats segueixen podent veure premis, QRs i
-- bescanvis (les seccions permeses). Els endpoints sensibles
-- (adjust-points, delete-user) bloquegen explícitament els limitats.
