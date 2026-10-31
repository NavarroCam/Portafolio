-- ==========================================================
-- Mi Plato — tablas de Supabase
-- Copiá todo esto en Supabase › SQL Editor › New query y tocá "Run".
-- Se puede correr más de una vez sin romper nada.
-- ==========================================================

-- Datos de cada usuario (perfil, comidas, agua, metas, etc.) en un solo JSON
create table if not exists public.perfiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  datos       jsonb not null,
  actualizado timestamptz not null default now()
);

-- Fotos de los platos (miniaturas en base64), aparte para no subirlas en cada cambio
create table if not exists public.fotos (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  id      text not null,
  data    text not null,
  creado  timestamptz not null default now(),
  primary key (user_id, id)
);

-- Seguridad: cada usuario solo ve y modifica lo suyo
alter table public.perfiles enable row level security;
alter table public.fotos    enable row level security;

drop policy if exists "perfiles: leer lo mío"    on public.perfiles;
drop policy if exists "perfiles: crear lo mío"   on public.perfiles;
drop policy if exists "perfiles: editar lo mío"  on public.perfiles;
drop policy if exists "perfiles: borrar lo mío"  on public.perfiles;
create policy "perfiles: leer lo mío"   on public.perfiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "perfiles: crear lo mío"  on public.perfiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "perfiles: editar lo mío" on public.perfiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "perfiles: borrar lo mío" on public.perfiles for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "fotos: leer lo mío"   on public.fotos;
drop policy if exists "fotos: crear lo mío"  on public.fotos;
drop policy if exists "fotos: editar lo mío" on public.fotos;
drop policy if exists "fotos: borrar lo mío" on public.fotos;
create policy "fotos: leer lo mío"   on public.fotos for select to authenticated using ((select auth.uid()) = user_id);
create policy "fotos: crear lo mío"  on public.fotos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "fotos: editar lo mío" on public.fotos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fotos: borrar lo mío" on public.fotos for delete to authenticated using ((select auth.uid()) = user_id);

-- Permisos para que la app (usuarios logueados) pueda usar las tablas
grant select, insert, update, delete on public.perfiles to authenticated;
grant select, insert, update, delete on public.fotos    to authenticated;
revoke all on public.perfiles from anon;
revoke all on public.fotos    from anon;

-- ==========================================================
-- Próximas mejoras: votos y sugerencias (agregado en la versión con demo)
-- ==========================================================

-- Un voto por usuario y mejora (la lista de mejoras está en js/mejoras.js)
create table if not exists public.votos (
  user_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  mejora_id text not null check (char_length(mejora_id) <= 40),
  creado    timestamptz not null default now(),
  primary key (user_id, mejora_id)
);
alter table public.votos enable row level security;
drop policy if exists "votos: leer lo mío"   on public.votos;
drop policy if exists "votos: crear lo mío"  on public.votos;
drop policy if exists "votos: borrar lo mío" on public.votos;
create policy "votos: leer lo mío"   on public.votos for select to authenticated using ((select auth.uid()) = user_id);
create policy "votos: crear lo mío"  on public.votos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "votos: borrar lo mío" on public.votos for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.votos to authenticated;
revoke all on public.votos from anon;

-- Total de votos por mejora (sin mostrar quién votó)
create or replace function public.conteo_votos()
returns table (mejora_id text, votos bigint)
language sql
security definer
set search_path = public
as $$
  select mejora_id, count(*) from public.votos group by mejora_id;
$$;
revoke all on function public.conteo_votos() from public;
grant execute on function public.conteo_votos() to anon, authenticated;

-- Sugerencias: cualquiera puede mandar una (también desde la demo), nadie las puede leer desde la app.
-- Las ves en Supabase › Table Editor › sugerencias (y te llegan por mail).
create table if not exists public.sugerencias (
  id       bigint generated always as identity primary key,
  creado   timestamptz not null default now(),
  user_id  uuid references auth.users (id) on delete set null,
  email    text check (char_length(email) <= 200),
  nombre   text check (char_length(nombre) <= 60),
  tipo     text not null check (tipo in ('nuevo', 'error', 'diseno', 'otra')),
  titulo   text not null check (char_length(titulo) between 3 and 80),
  detalle  text check (char_length(detalle) <= 1500),
  avisar   boolean not null default false,
  contexto jsonb,
  estado   text not null default 'nueva'
);
alter table public.sugerencias enable row level security;
drop policy if exists "sugerencias: cualquiera puede mandar" on public.sugerencias;
create policy "sugerencias: cualquiera puede mandar" on public.sugerencias for insert to anon, authenticated
  with check (estado = 'nueva' and (user_id is null or user_id = (select auth.uid())));
grant insert on public.sugerencias to anon, authenticated;
