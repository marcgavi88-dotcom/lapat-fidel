-- =============================================================
-- L'ÀPAT FIDEL · Reset pre-llançament
-- =============================================================
-- Objectiu:
--   Deixar la base de dades neta per al llançament oficial al
--   restaurant: esborrar totes les dades del programa de fidelitat
--   acumulades durant les proves i posar tots els comptadors de
--   punts a zero.
--
-- Què s'esborra:
--   · qr_codes              (tots els QR generats, usats o no)
--   · movimientos_puntos    (historial de punts)
--   · canjes                (bescanvis pendents i validats, inclòs
--                            el cafè de benvinguda pre-existent)
--   · giros_ruleta          (historial de tirades)
--   · reviews               (reclamacions de ressenyes)
--   · stories               (reclamacions d'històries d'Instagram)
--   · invitaciones          (apadrinaments pendents/desbloquejats)
--
-- Què es RESTABLEIX a profiles (sense esborrar comptes ni admins):
--   · puntos_total                   = 0
--   · puntos_menu                    = 0
--   · total_croquetas                = 0
--   · tiradas_ruleta                 = 0
--   · tiradas_ruleta_pro             = 0
--   · ultimo_giro_ruleta             = null
--   · ultimo_bonus_aniversario       = null
--   · regalo_benvinguda_reclamat     = false  (així qui torni a
--                                              entrar amb el QR promo
--                                              rebrà el cafè)
--
-- Què NO es toca:
--   · auth.users / profiles          (tots els comptes es mantenen)
--   · premios                        (catàleg intacte)
--   · noticias                       (continguts de màrqueting)
--   · newsletters                    (historial d'enviaments)
--   · codigo_invitacion / invitado_por a profiles (relacions de
--     padrinatge es mantenen; els bonus ja es re-calcularan quan
--     el fillol arribi a 200 punts amb la taula invitaciones neta)
--
-- Com executar-lo:
--   1) Dashboard de Supabase → SQL Editor → New query
--   2) Enganxa TOT aquest fitxer i prem Run
--   3) Mira els SELECT del final: han de mostrar 0 files a cada
--      taula esborrada i 0 punts a totes les files de profiles.
--
-- IMPORTANT: el fitxer s'executa dins d'una transacció (BEGIN/COMMIT).
-- Si vols provar-lo sense confirmar, canvia COMMIT per ROLLBACK al
-- final i no s'escriurà res a la BBDD.
-- =============================================================

begin;

-- 1) Esborrar taules dependents abans de qr_codes
--    (movimientos_puntos.qr_id → qr_codes.id sense ON DELETE CASCADE,
--     per tant cal buidar movimientos_puntos primer).
delete from public.movimientos_puntos;
delete from public.canjes;
delete from public.giros_ruleta;

-- Taules de reclamacions de punts via UGC (reviews / stories)
-- i apadrinaments. Si alguna no existeix al teu entorn, la línia
-- corresponent fallarà — comenta-la si cal.
delete from public.reviews;
delete from public.stories;
delete from public.invitaciones;

-- 2) Esborrar tots els QR generats
delete from public.qr_codes;

-- 3) Reset dels comptadors del perfil
--    (només columnes del programa de fidelitat; dades personals intactes)
update public.profiles
  set puntos_total              = 0,
      puntos_menu               = 0,
      total_croquetas           = 0,
      tiradas_ruleta            = 0,
      tiradas_ruleta_pro        = 0,
      ultimo_giro_ruleta        = null,
      ultimo_bonus_aniversario  = null,
      regalo_benvinguda_reclamat = false,
      updated_at                = now();

-- 4) Comprovació final — tot ha de sortir a 0
select 'qr_codes'            as taula, count(*) as files from public.qr_codes
union all
select 'movimientos_puntos',  count(*) from public.movimientos_puntos
union all
select 'canjes',              count(*) from public.canjes
union all
select 'giros_ruleta',        count(*) from public.giros_ruleta
union all
select 'reviews',             count(*) from public.reviews
union all
select 'stories',             count(*) from public.stories
union all
select 'invitaciones',        count(*) from public.invitaciones
union all
select 'profiles_amb_punts',  count(*) from public.profiles where puntos_total <> 0 or puntos_menu <> 0;

commit;
