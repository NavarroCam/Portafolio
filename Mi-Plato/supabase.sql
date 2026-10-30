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
