import { openDB, type IDBPDatabase } from 'idb';
import type { AppData } from '../lib/model';

/** Estado persistido en el dispositivo. Es la copia de trabajo: la app siempre lee/escribe aquí primero. */
export interface LocalState {
  data: AppData | null;
  /** Versión del servidor sobre la que se basan los datos locales (0 = nunca sincronizado) */
  baseVersion: number;
  /** Hay cambios locales aún no confirmados por el servidor */
  dirty: boolean;
  updatedAt: string;
}

export interface Snapshot {
  id?: number;
  at: string;
  reason: string;
  data: AppData;
}

const DB_NAME = 'piso-castellon';
const MAX_SNAPSHOTS = 40;
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  dbp ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('kv');
      db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
    },
  });
  return dbp;
}

export async function loadLocal(): Promise<LocalState | null> {
  return ((await (await db()).get('kv', 'state')) as LocalState | undefined) ?? null;
}

export async function saveLocal(s: LocalState): Promise<void> {
  await (await db()).put('kv', s, 'state');
}

export async function addSnapshot(data: AppData, reason: string): Promise<void> {
  const d = await db();
  await d.add('snapshots', { at: new Date().toISOString(), reason, data } satisfies Snapshot);
  const keys = (await d.getAllKeys('snapshots')) as number[];
  if (keys.length > MAX_SNAPSHOTS) {
    const tx = d.transaction('snapshots', 'readwrite');
    for (const k of keys.slice(0, keys.length - MAX_SNAPSHOTS)) await tx.store.delete(k);
    await tx.done;
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const all = (await (await db()).getAll('snapshots')) as Snapshot[];
  return all.reverse();
}

export async function lastSnapshotAt(): Promise<string | null> {
  const d = await db();
  const cursor = await d.transaction('snapshots').store.openCursor(null, 'prev');
  return cursor ? (cursor.value as Snapshot).at : null;
}

/** Pide al navegador que no borre IndexedDB bajo presión de espacio. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

export function sameData(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  return `${os} · ${br}`;
}
