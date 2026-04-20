-- =============================================================
-- L'ÀPAT FIDEL · Migració: Cafè de benvinguda (QR físic A5)
-- =============================================================
-- Executa aquest fitxer sencer al SQL Editor de Supabase.
-- Idempotent: es pot executar més d'un cop sense efectes adversos.
-- =============================================================

-- 1) Afegir identificador intern a premios per poder referenciar
--    el premi especial de benvinguda sense dependre del nom.
alter table public.premios
  add column if not exists codigo_interno text;

-- NOTA: índex únic *no parcial*. El `on conflict (codigo_interno)` de sota
-- requereix que el predicate de l'índex coincideixi amb el d'ON CONFLICT;
-- com que Postgres tracta els NULL com a distints per defecte, l'efecte
-- pràctic és el mateix: només un registre pot tenir cada valor no-null.
create unique index if not exists idx_premios_codigo_interno
  on public.premios(codigo_interno);

-- 2) Insertar el premi "Cafè de benvinguda".
--    activo = false perquè NO aparegui al catàleg públic de /rewards
--    (només es concedeix automàticament al registrar-se via QR promo).
insert into public.premios
  (nombre_ca, nombre_es, descripcion_ca, descripcion_es,
   puntos_necesarios, orden, activo, codigo_interno)
values
  ('Cafè de benvinguda',
   'Café de bienvenida',
   'Regal per registrar-te al club. Bescanviable a la barra.',
   'Regalo por registrarte al club. Canjeable en la barra.',
   0, 0, false, 'cafe_benvinguda')
on conflict (codigo_interno) do nothing;

-- 3) Camp de tracking al perfil per garantir que el regal s'entrega
--    només una vegada per usuari.
alter table public.profiles
  add column if not exists regalo_benvinguda_reclamat boolean not null default false;

-- 4) Actualitzar el trigger handle_new_user per, si el signup porta
--    la flag promo_benvinguda=true al raw_user_meta_data, crear
--    automàticament un canje de cafè a favor del nou usuari.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_premio_id uuid;
  v_codigo text;
begin
  -- Crear el perfil (comportament original)
  insert into public.profiles (id, email, nombre, apellidos, telefono, acepta_promociones, acepta_terminos, idioma)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellidos', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce((new.raw_user_meta_data->>'acepta_promociones')::boolean, false),
    true,
    coalesce(new.raw_user_meta_data->>'idioma', 'ca')
  );

  -- Promo cafè de benvinguda
  if coalesce((new.raw_user_meta_data->>'promo_benvinguda')::boolean, false) then
    select id into v_premio_id
      from public.premios
      where codigo_interno = 'cafe_benvinguda'
      limit 1;

    if v_premio_id is not null then
      v_codigo := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));

      insert into public.canjes (user_id, premio_id, puntos_usados, codigo_canje)
        values (new.id, v_premio_id, 0, v_codigo);

      update public.profiles
        set regalo_benvinguda_reclamat = true
        where id = new.id;

      insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
        values (new.id, 0, 'canje', 'Regal de benvinguda: cafè gratis');
    end if;
  end if;

  return new;
end;
$$;

-- El trigger ja existeix a schema.sql, però per si s'executa aquest fitxer
-- en un entorn net el reinstal·lem:
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
