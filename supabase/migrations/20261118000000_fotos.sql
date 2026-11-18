-- ════════════════════════════════════════════════════════════════════════════
--  Fotos del piso: almacenamiento privado. Cada usuario solo ve, sube y borra
--  los archivos de su carpeta (<id de usuario>/...). Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = false;

drop policy if exists "fotos: ver las mías" on storage.objects;
create policy "fotos: ver las mías" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fotos: subir a mi carpeta" on storage.objects;
create policy "fotos: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fotos: borrar las mías" on storage.objects;
create policy "fotos: borrar las mías" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
