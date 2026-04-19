-- =============================================================
-- L'ÀPAT FIDEL - Esquema de base de datos Supabase
-- =============================================================
-- Ejecuta TODO este archivo de una vez en el SQL Editor de Supabase
-- Dashboard → SQL Editor → New query → pega y pulsa "Run"
-- =============================================================

-- Extensión para generar UUIDs
create extension if not exists "uuid-ossp";

-- =============================================================
-- TABLA: profiles (perfiles de clientes y administradores)
-- =============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellidos text not null,
  telefono text,
  email text not null unique,
  puntos_total integer not null default 0,
  puntos_menu integer not null default 0, -- puntos acumulados desde menús del día (para tarjeta de sellos)
  acepta_promociones boolean not null default false,
  acepta_terminos boolean not null default true,
  idioma text not null default 'ca', -- 'ca' o 'es'
  is_admin boolean not null default false,
  ultimo_giro_ruleta timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- =============================================================
-- TABLA: qr_codes (QR generados desde el panel admin)
-- =============================================================
create table if not exists public.qr_codes (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique, -- el código único que va en la URL del QR
  importe_euros numeric(10,2) not null,
  puntos integer not null,
  es_menu boolean not null default false, -- si proviene de un menú del día
  usado boolean not null default false,
  usado_por uuid references public.profiles(id),
  usado_at timestamp with time zone,
  reservado_por_email text, -- email de cliente sin cuenta que está en proceso de registro
  reservado_at timestamp with time zone,
  expira_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  created_by uuid references public.profiles(id)
);

create index if not exists idx_qr_codigo on public.qr_codes(codigo);
create index if not exists idx_qr_usado on public.qr_codes(usado);

-- =============================================================
-- TABLA: movimientos_puntos (historial de puntos)
-- =============================================================
create table if not exists public.movimientos_puntos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  puntos integer not null, -- positivo al ganar, negativo al canjear
  tipo text not null, -- 'qr', 'canje', 'ruleta', 'ajuste_admin'
  descripcion text,
  qr_id uuid references public.qr_codes(id),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_mov_user on public.movimientos_puntos(user_id);

-- =============================================================
-- TABLA: premios (catálogo de premios canjeables)
-- =============================================================
create table if not exists public.premios (
  id uuid primary key default uuid_generate_v4(),
  nombre_ca text not null,
  nombre_es text not null,
  descripcion_ca text,
  descripcion_es text,
  puntos_necesarios integer not null,
  activo boolean not null default true,
  orden integer not null default 0
);

-- Insertar premios por defecto
insert into public.premios (nombre_ca, nombre_es, puntos_necesarios, orden, descripcion_ca, descripcion_es) values
  ('Cafè gratis', 'Café gratis', 125, 1, 'Un cafè a escollir', 'Un café a elegir'),
  ('Postres gratis', 'Postre gratis', 200, 2, 'Un postre de la carta', 'Un postre de la carta'),
  ('Menú de migdia gratis', 'Menú de mediodía gratis', 500, 3, 'Un menú del dia complet', 'Un menú del día completo'),
  ('Arròs per a 2 persones', 'Arroz para 2 personas', 1000, 4, 'Arròs a escollir de la carta', 'Arroz a elegir de la carta'),
  ('Sopar per a 2 persones', 'Cena para 2 personas', 2000, 5, 'Sopar complet per a 2', 'Cena completa para 2'),
  ('Ganivet de cuina professional', 'Cuchillo de cocina profesional', 2500, 6, 'Ganivet de qualitat (80-100€)', 'Cuchillo de calidad (80-100€)')
on conflict do nothing;

-- =============================================================
-- TABLA: canjes (solicitudes de canje de premios)
-- =============================================================
create table if not exists public.canjes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  premio_id uuid not null references public.premios(id),
  puntos_usados integer not null,
  codigo_canje text not null unique, -- código que enseñará el cliente en el restaurante
  estado text not null default 'pendiente', -- 'pendiente', 'validado', 'rechazado'
  validado_at timestamp with time zone,
  validado_por uuid references public.profiles(id),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_canjes_user on public.canjes(user_id);
create index if not exists idx_canjes_estado on public.canjes(estado);

-- =============================================================
-- TABLA: noticias (noticias y promociones publicadas)
-- =============================================================
create table if not exists public.noticias (
  id uuid primary key default uuid_generate_v4(),
  titulo_ca text not null,
  titulo_es text not null,
  contenido_ca text not null,
  contenido_es text not null,
  imagen_url text,
  publicada boolean not null default true,
  created_at timestamp with time zone not null default now(),
  created_by uuid references public.profiles(id)
);

-- =============================================================
-- TABLA: newsletters (historial de envíos masivos)
-- =============================================================
create table if not exists public.newsletters (
  id uuid primary key default uuid_generate_v4(),
  asunto text not null,
  contenido_html text not null,
  destinatarios integer not null default 0,
  enviada_at timestamp with time zone not null default now(),
  enviada_por uuid references public.profiles(id)
);

-- =============================================================
-- TABLA: giros_ruleta (historial de giros de la ruleta)
-- =============================================================
create table if not exists public.giros_ruleta (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  premio_obtenido text not null,
  puntos_ganados integer not null default 0,
  codigo_canje text, -- si el premio es un café o postre canjeable
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_giros_user on public.giros_ruleta(user_id);

-- =============================================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================
alter table public.profiles enable row level security;
alter table public.qr_codes enable row level security;
alter table public.movimientos_puntos enable row level security;
alter table public.premios enable row level security;
alter table public.canjes enable row level security;
alter table public.noticias enable row level security;
alter table public.newsletters enable row level security;
alter table public.giros_ruleta enable row level security;

-- PROFILES: el usuario ve y edita su propio perfil. El admin ve todos.
drop policy if exists "users_select_own_profile" on public.profiles;
create policy "users_select_own_profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "users_update_own_profile" on public.profiles;
create policy "users_update_own_profile" on public.profiles
  for update using (auth.uid() = id);

-- Funció helper SECURITY DEFINER per evitar recursió infinita a les polítiques d'admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $func$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$func$;

drop policy if exists "admins_select_all_profiles" on public.profiles;
create policy "admins_select_all_profiles" on public.profiles
  for select using (public.is_admin());

-- MOVIMIENTOS: cada usuario ve los suyos
drop policy if exists "users_select_own_movimientos" on public.movimientos_puntos;
create policy "users_select_own_movimientos" on public.movimientos_puntos
  for select using (auth.uid() = user_id);

drop policy if exists "admins_all_movimientos" on public.movimientos_puntos;
create policy "admins_all_movimientos" on public.movimientos_puntos
  for all using (public.is_admin());

-- PREMIOS: todos los usuarios autenticados los ven
drop policy if exists "everyone_select_premios" on public.premios;
create policy "everyone_select_premios" on public.premios
  for select using (true);

drop policy if exists "admins_all_premios" on public.premios;
create policy "admins_all_premios" on public.premios
  for all using (public.is_admin());

-- CANJES: cada usuario ve los suyos, admin ve todos
drop policy if exists "users_select_own_canjes" on public.canjes;
create policy "users_select_own_canjes" on public.canjes
  for select using (auth.uid() = user_id);

drop policy if exists "users_insert_own_canjes" on public.canjes;
create policy "users_insert_own_canjes" on public.canjes
  for insert with check (auth.uid() = user_id);

drop policy if exists "admins_all_canjes" on public.canjes;
create policy "admins_all_canjes" on public.canjes
  for all using (public.is_admin());

-- NOTICIAS: todos ven las publicadas
drop policy if exists "everyone_select_noticias" on public.noticias;
create policy "everyone_select_noticias" on public.noticias
  for select using (publicada = true);

drop policy if exists "admins_all_noticias" on public.noticias;
create policy "admins_all_noticias" on public.noticias
  for all using (public.is_admin());

-- QR CODES: solo admin, el cliente no los lista directamente (se procesan por API con service role)
drop policy if exists "admins_all_qr" on public.qr_codes;
create policy "admins_all_qr" on public.qr_codes
  for all using (public.is_admin());

-- NEWSLETTERS: solo admin
drop policy if exists "admins_all_newsletters" on public.newsletters;
create policy "admins_all_newsletters" on public.newsletters
  for all using (public.is_admin());

-- GIROS RULETA: cada usuario ve los suyos
drop policy if exists "users_select_own_giros" on public.giros_ruleta;
create policy "users_select_own_giros" on public.giros_ruleta
  for select using (auth.uid() = user_id);

drop policy if exists "admins_all_giros" on public.giros_ruleta;
create policy "admins_all_giros" on public.giros_ruleta
  for all using (public.is_admin());

-- =============================================================
-- FUNCIÓN: reclamar QR (atómica)
-- =============================================================
create or replace function public.reclamar_qr(p_codigo text, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_qr public.qr_codes%rowtype;
  v_profile public.profiles%rowtype;
begin
  -- Obtener el QR con lock
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

  -- Marcar QR como usado
  update public.qr_codes
    set usado = true,
        usado_por = p_user_id,
        usado_at = now(),
        reservado_por_email = null,
        reservado_at = null
    where id = v_qr.id;

  -- Actualizar puntos del perfil
  update public.profiles
    set puntos_total = puntos_total + v_qr.puntos,
        puntos_menu = case when v_qr.es_menu then puntos_menu + v_qr.puntos else puntos_menu end,
        updated_at = now()
    where id = p_user_id
    returning * into v_profile;

  -- Registrar movimiento
  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion, qr_id)
    values (p_user_id, v_qr.puntos, 'qr', 'Puntos por consumición de ' || v_qr.importe_euros || '€', v_qr.id);

  return jsonb_build_object(
    'ok', true,
    'puntos_ganados', v_qr.puntos,
    'puntos_total', v_profile.puntos_total,
    'puntos_menu', v_profile.puntos_menu,
    'es_menu', v_qr.es_menu
  );
end;
$$;

-- =============================================================
-- FUNCIÓN: canjear premio (atómica)
-- =============================================================
create or replace function public.canjear_premio(p_premio_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_premio public.premios%rowtype;
  v_profile public.profiles%rowtype;
  v_codigo text;
begin
  select * into v_premio from public.premios where id = p_premio_id and activo = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'premio_no_disponible');
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if v_profile.puntos_total < v_premio.puntos_necesarios then
    return jsonb_build_object('ok', false, 'error', 'puntos_insuficientes');
  end if;

  -- Generar código de canje aleatorio de 6 caracteres
  v_codigo := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));

  -- Restar puntos
  update public.profiles
    set puntos_total = puntos_total - v_premio.puntos_necesarios,
        updated_at = now()
    where id = p_user_id;

  -- Crear canje
  insert into public.canjes (user_id, premio_id, puntos_usados, codigo_canje)
    values (p_user_id, p_premio_id, v_premio.puntos_necesarios, v_codigo);

  -- Registrar movimiento
  insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
    values (p_user_id, -v_premio.puntos_necesarios, 'canje', 'Canje: ' || v_premio.nombre_es);

  return jsonb_build_object('ok', true, 'codigo_canje', v_codigo);
end;
$$;

-- =============================================================
-- FUNCIÓN: girar ruleta (atómica, 1 vez al mes)
-- =============================================================
create or replace function public.girar_ruleta(p_user_id uuid)
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
begin
  select * into v_profile from public.profiles where id = p_user_id for update;

  -- Verificar que no haya girado este mes
  if v_profile.ultimo_giro_ruleta is not null
     and date_trunc('month', v_profile.ultimo_giro_ruleta) = date_trunc('month', now()) then
    return jsonb_build_object('ok', false, 'error', 'ya_girada_este_mes');
  end if;

  -- Probabilidades: 15pts=35%, 10pts=25%, 25pts=20%, 50pts=10%, café=5%, postre=5%
  v_random := random();
  if v_random < 0.35 then
    v_premio := '15_puntos'; v_puntos := 15;
  elsif v_random < 0.60 then
    v_premio := '10_puntos'; v_puntos := 10;
  elsif v_random < 0.80 then
    v_premio := '25_puntos'; v_puntos := 25;
  elsif v_random < 0.90 then
    v_premio := '50_puntos'; v_puntos := 50;
  elsif v_random < 0.95 then
    v_premio := 'cafe_gratis';
    v_codigo := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));
  else
    v_premio := 'postre_gratis';
    v_codigo := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));
  end if;

  -- Actualizar último giro y puntos si aplica
  update public.profiles
    set ultimo_giro_ruleta = now(),
        puntos_total = puntos_total + v_puntos,
        updated_at = now()
    where id = p_user_id;

  -- Registrar giro
  insert into public.giros_ruleta (user_id, premio_obtenido, puntos_ganados, codigo_canje)
    values (p_user_id, v_premio, v_puntos, v_codigo);

  if v_puntos > 0 then
    insert into public.movimientos_puntos (user_id, puntos, tipo, descripcion)
      values (p_user_id, v_puntos, 'ruleta', 'Premio ruleta mensual: ' || v_puntos || ' puntos');
  end if;

  return jsonb_build_object(
    'ok', true,
    'premio', v_premio,
    'puntos', v_puntos,
    'codigo_canje', v_codigo
  );
end;
$$;

-- Permitir que authenticated users llamen a las funciones
grant execute on function public.reclamar_qr(text, uuid) to authenticated;
grant execute on function public.canjear_premio(uuid, uuid) to authenticated;
grant execute on function public.girar_ruleta(uuid) to authenticated;
