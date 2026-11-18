import { supabase } from './remote';

const BUCKET = 'fotos';
/** Lado mayor de la imagen grande y de la miniatura, en píxeles */
const GRANDE = 1600;
const MINI = 480;

export const fotosDisponibles = !!supabase;

async function reducir(file: Blob, lado: number, calidad: number): Promise<{ blob: Blob; ancho: number; alto: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const ancho = Math.round(bmp.width * k);
  const alto = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, ancho, alto);
  bmp.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se ha podido procesar la imagen');
  return { blob, ancho, alto };
}

/** Reduce la foto, sube la imagen grande y la miniatura a la carpeta del usuario y devuelve sus rutas. */
export async function subirFoto(file: File, id: string) {
  if (!supabase) throw new Error('Las fotos necesitan la nube');
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('Inicia sesión para subir fotos');
  const grande = await reducir(file, GRANDE, 0.82);
  const mini = await reducir(file, MINI, 0.75);
  const ruta = `${uid}/${id}.jpg`;
  const miniatura = `${uid}/${id}-mini.jpg`;
  for (const [path, blob] of [[ruta, grande.blob], [miniatura, mini.blob]] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
  }
  return { ruta, miniatura, ancho: grande.ancho, alto: grande.alto };
}

/** Enlaces temporales (1 hora) para ver las fotos privadas. */
export async function enlacesFotos(rutas: string[]): Promise<Record<string, string>> {
  if (!supabase || rutas.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, 3600);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const x of data ?? []) if (x.path && x.signedUrl) out[x.path] = x.signedUrl;
  return out;
}

export async function borrarArchivos(rutas: string[]) {
  if (!supabase || rutas.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(rutas);
  if (error) throw error;
}
