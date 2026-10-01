import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppData } from '../lib/model';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const cloudEnabled = !!supabase;

export interface RemoteDoc {
  version: number;
  data: AppData;
  updated_at: string;
  device: string | null;
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; version: number; data: AppData | null; updated_at?: string; device?: string | null };

export interface RevisionInfo {
  id: number;
  version: number;
  created_at: string;
  device: string | null;
  reason: string | null;
}

function client(): SupabaseClient {
  if (!supabase) throw new Error('Sincronización en la nube no configurada');
  return supabase;
}

export async function fetchDoc(): Promise<RemoteDoc | null> {
  const { data, error } = await client().from('documents').select('version,data,updated_at,device').maybeSingle();
  if (error) throw error;
  return (data as RemoteDoc | null) ?? null;
}

/** Guardado atómico con control de versión (compare-and-swap en el servidor). */
export async function saveDoc(baseVersion: number, data: AppData, device: string, reason: string): Promise<SaveResult> {
  const { data: res, error } = await client().rpc('save_document', {
    p_base_version: baseVersion,
    p_data: data,
    p_device: device,
    p_reason: reason,
  });
  if (error) throw error;
  return res as SaveResult;
}

export async function listRevisions(limit = 60): Promise<RevisionInfo[]> {
  const { data, error } = await client()
    .from('revisions')
    .select('id,version,created_at,device,reason')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RevisionInfo[];
}

export async function fetchRevision(id: number): Promise<AppData> {
  const { data, error } = await client().from('revisions').select('data').eq('id', id).single();
  if (error) throw error;
  return (data as { data: AppData }).data;
}
