-- ════════════════════════════════════════════════════════════════════════════
--  Piso Castellón · esquema de Supabase
--  Lo aplica automáticamente la integración de GitHub de Supabase al fusionar en
--  main. También se puede pegar entero en Supabase → SQL Editor → Run (es idempotente).
-- ════════════════════════════════════════════════════════════════════════════

-- Documento actual (uno por usuario). La app guarda todos sus datos como un único JSON.
create table if not exists public.documents (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  version    bigint      not null default 0,
  data       jsonb       not null,
  device     text,
  updated_at timestamptz not null default now()
);

-- Historial de revisiones: SOLO se añade, nunca se modifica. Cada guardado crea una fila.
create table if not exists public.revisions (
  id         bigserial primary key,
  user_id    uuid        not null default auth.uid() references auth.users on delete cascade,
  version    bigint      not null,
  data       jsonb       not null,
  device     text,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists revisions_user_idx on public.revisions (user_id, id desc);

-- Seguridad: cada usuario solo puede LEER lo suyo. No hay políticas de escritura:
-- la única forma de escribir es la función save_document (abajo).
alter table public.documents enable row level security;
alter table public.revisions enable row level security;

drop policy if exists "leer mi documento" on public.documents;
create policy "leer mi documento" on public.documents
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "leer mis revisiones" on public.revisions;
create policy "leer mis revisiones" on public.revisions
  for select to authenticated using (user_id = auth.uid());

-- Guardado atómico con control de versión (compare-and-swap).
-- Si p_base_version no coincide con la versión actual, NO escribe nada y devuelve
-- la versión del servidor para que la app muestre el conflicto.
create or replace function public.save_document(
  p_base_version bigint,
  p_data jsonb,
  p_device text default null,
  p_reason text default 'Edición'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cur public.documents%rowtype;
  v_new bigint;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Datos no válidos';
  end if;

  select * into v_cur from public.documents where user_id = v_uid for update;

  if not found then
    if p_base_version <> 0 then
      return jsonb_build_object('ok', false, 'version', 0, 'data', null);
    end if;
    v_new := 1;
    insert into public.documents (user_id, version, data, device) values (v_uid, v_new, p_data, p_device);
  else
    if v_cur.version <> p_base_version then
      return jsonb_build_object(
        'ok', false, 'version', v_cur.version, 'data', v_cur.data,
        'updated_at', v_cur.updated_at, 'device', v_cur.device
      );
    end if;
    v_new := v_cur.version + 1;
    update public.documents
       set version = v_new, data = p_data, device = p_device, updated_at = now()
     where user_id = v_uid;
  end if;

  insert into public.revisions (user_id, version, data, device, reason)
  values (v_uid, v_new, p_data, p_device, p_reason);

  -- Poda del historial: se conservan las 300 revisiones más recientes y, de las
  -- anteriores, la primera de cada día (para siempre).
  delete from public.revisions r
   where r.user_id = v_uid
     and r.id < (
       select min(id) from (
         select id from public.revisions where user_id = v_uid order by id desc limit 300
       ) recientes
     )
     and exists (
       select 1 from public.revisions r2
        where r2.user_id = v_uid
          and r2.created_at::date = r.created_at::date
          and r2.id < r.id
     );

  return jsonb_build_object('ok', true, 'version', v_new);
end;
$$;

revoke all on function public.save_document(bigint, jsonb, text, text) from public, anon;
grant execute on function public.save_document(bigint, jsonb, text, text) to authenticated;
