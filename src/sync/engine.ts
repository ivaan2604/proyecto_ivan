import type { Session } from '@supabase/supabase-js';
import type { AppData } from '../lib/model';
import { validateAppData } from '../lib/schema';
import { addSnapshot, deviceLabel, lastSnapshotAt, loadLocal, requestPersistence, sameData, saveLocal } from './local';
import { cloudEnabled, fetchDoc, saveDoc, supabase } from './remote';

/**
 * Motor de sincronización "local-first".
 *
 * Garantías:
 *  1. Cada cambio se escribe primero en IndexedDB (y queda marcado como pendiente) antes
 *     de intentar subirlo. Un fallo de red nunca pierde la edición.
 *  2. El servidor solo acepta un guardado si se basa en su versión actual
 *     (compare-and-swap). Si otro dispositivo guardó antes, NO se sobrescribe: se
 *     muestra un conflicto y el usuario elige. La versión descartada se guarda como
 *     instantánea local y además queda en el historial de revisiones del servidor.
 *  3. Antes de operaciones destructivas (importar, restablecer, restaurar, resolver
 *     conflictos) se guarda una instantánea local.
 */

export type SyncStatus =
  | 'loading'
  | 'local' // nube no configurada
  | 'signed-out' // nube configurada pero sin sesión
  | 'synced'
  | 'pending'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'conflict';

export interface Conflict {
  remote: { version: number; data: AppData; updated_at?: string; device?: string | null };
}

export interface EngineState {
  data: AppData | null;
  status: SyncStatus;
  baseVersion: number;
  dirty: boolean;
  lastSyncAt: string | null;
  error: string | null;
  conflict: Conflict | null;
  session: Session | null;
}

const PUSH_DEBOUNCE_MS = 1500;
const PULL_INTERVAL_MS = 60_000;
const AUTO_SNAPSHOT_MS = 30 * 60_000;

type Listener = () => void;

class SyncEngine {
  private state: EngineState = {
    data: null, status: 'loading', baseVersion: 0, dirty: false,
    lastSyncAt: null, error: null, conflict: null, session: null,
  };
  private listeners = new Set<Listener>();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private again = false;
  private edits = 0;
  private lastSnapshot = 0;
  private writeChain: Promise<void> = Promise.resolve();
  readonly device = deviceLabel();

  getState = () => this.state;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private persist(): Promise<void> {
    const { data, baseVersion, dirty } = this.state;
    // Escrituras serializadas: nunca se pisa una más nueva con otra más vieja.
    this.writeChain = this.writeChain
      .then(() => saveLocal({ data, baseVersion, dirty, updatedAt: new Date().toISOString() }))
      .catch((e) => this.set({ error: `No se pudo guardar en este dispositivo: ${msg(e)}` }));
    return this.writeChain;
  }

  private idleStatus(): SyncStatus {
    if (!cloudEnabled) return 'local';
    if (!this.state.session) return 'signed-out';
    if (this.state.conflict) return 'conflict';
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    return this.state.dirty ? 'pending' : 'synced';
  }

  async init() {
    void requestPersistence();
    const local = await loadLocal().catch(() => null);
    let data: AppData | null = null;
    if (local?.data) {
      try {
        data = validateAppData(local.data);
      } catch (e) {
        // Datos locales ilegibles: se conservan como instantánea en bruto y no se tocan.
        this.set({ error: `Los datos locales no son válidos: ${msg(e)}` });
        data = local.data;
      }
    }
    const last = await lastSnapshotAt().catch(() => null);
    this.lastSnapshot = last ? new Date(last).getTime() : 0;
    this.state = {
      ...this.state,
      data,
      baseVersion: local?.baseVersion ?? 0,
      dirty: local?.dirty ?? false,
    };

    if (supabase) {
      const { data: s } = await supabase.auth.getSession();
      this.state.session = s.session;
      supabase.auth.onAuthStateChange((_ev, session) => {
        const was = this.state.session?.user.id;
        this.set({ session, status: this.idleStatus() });
        if (session && session.user.id !== was) void this.sync();
      });
      window.addEventListener('online', () => void this.sync());
      window.addEventListener('offline', () => this.set({ status: this.idleStatus() }));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.sync();
      });
      setInterval(() => {
        if (document.visibilityState === 'visible') void this.sync();
      }, PULL_INTERVAL_MS);
    }
    this.set({ status: this.idleStatus() });
    // Al ocultar la pestaña se intenta subir lo pendiente (sin diálogos nativos: los datos
    // ya están a salvo en IndexedDB y se subirán en la próxima apertura si no da tiempo).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.state.dirty) void this.push();
    });
    if (this.state.session) void this.sync();
  }

  /** Aplica un cambio. `fn` recibe una copia y la modifica (o devuelve una nueva). */
  update(fn: (d: AppData) => AppData | void) {
    const cur = this.state.data;
    if (!cur) return;
    const draft = structuredClone(cur);
    const next = fn(draft) ?? draft;
    this.edits++;
    this.set({ data: next, dirty: true });
    if (this.state.status !== 'syncing') this.set({ status: this.idleStatus() });
    void this.persist();
    this.maybeAutoSnapshot(cur);
    this.schedulePush();
  }

  /** Sustituye todos los datos (importar, restablecer, restaurar). Guarda antes una instantánea. */
  async replaceAll(next: AppData, reason: string) {
    if (this.state.data) await addSnapshot(this.state.data, `Antes de: ${reason}`).catch(() => undefined);
    this.edits++;
    this.set({ data: next, dirty: true });
    this.set({ status: this.idleStatus() });
    await this.persist();
    this.schedulePush(0, reason);
  }

  private maybeAutoSnapshot(prev: AppData) {
    const now = Date.now();
    if (now - this.lastSnapshot > AUTO_SNAPSHOT_MS) {
      this.lastSnapshot = now;
      void addSnapshot(prev, 'Automática').catch(() => undefined);
    }
  }

  private pendingReason = 'Edición';
  private schedulePush(delay = PUSH_DEBOUNCE_MS, reason?: string) {
    if (reason) this.pendingReason = reason;
    if (!this.state.session) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.push(), delay);
  }

  /** Sube los cambios locales. Una sola subida a la vez. */
  async push(): Promise<void> {
    if (!this.state.session || !this.state.data || !this.state.dirty || this.state.conflict) return;
    if (this.busy) {
      this.again = true;
      return;
    }
    this.busy = true;
    const editsAtStart = this.edits;
    const sent = this.state.data;
    const reason = this.pendingReason;
    this.set({ status: 'syncing' });
    try {
      const res = await saveDoc(this.state.baseVersion, sent, this.device, reason);
      if (res.ok) {
        this.pendingReason = 'Edición';
        const stillDirty = this.edits !== editsAtStart;
        this.set({ baseVersion: res.version, dirty: stillDirty, lastSyncAt: new Date().toISOString(), error: null });
        await this.persist();
        if (stillDirty) this.again = true;
      } else if (res.data && sameData(res.data, sent)) {
        // El servidor ya tiene exactamente estos datos (p. ej. reintento): solo adoptamos su versión.
        this.set({ baseVersion: res.version, dirty: this.edits !== editsAtStart, error: null });
        await this.persist();
      } else {
        this.openConflict(res);
      }
    } catch (e) {
      this.set({ error: navigator.onLine ? `Error al sincronizar: ${msg(e)}` : null });
    } finally {
      this.busy = false;
      this.set({ status: this.state.error && navigator.onLine ? 'error' : this.idleStatus() });
      if (this.again) {
        this.again = false;
        this.schedulePush(300);
      }
    }
  }

  private openConflict(res: { version: number; data: AppData | null; updated_at?: string; device?: string | null }) {
    if (!res.data) {
      // El servidor no tiene documento pero creíamos tener versión base: reiniciamos la base.
      this.set({ baseVersion: 0 });
      void this.persist().then(() => this.schedulePush(0));
      return;
    }
    let remote: AppData;
    try {
      remote = validateAppData(res.data);
    } catch (e) {
      this.set({ error: `Los datos de la nube no son válidos: ${msg(e)}` });
      return;
    }
    this.set({ conflict: { remote: { version: res.version, data: remote, updated_at: res.updated_at, device: res.device } }, status: 'conflict' });
  }

  /** Comprueba si hay una versión más nueva en la nube y la aplica (o sube la local). */
  async sync(): Promise<void> {
    if (!this.state.session || this.busy || this.state.conflict) return;
    if (!navigator.onLine) {
      this.set({ status: 'offline' });
      return;
    }
    this.busy = true;
    this.set({ status: 'syncing' });
    let pushAfter = false;
    try {
      const doc = await fetchDoc();
      if (!doc) {
        if (this.state.data) {
          // Primera subida desde este dispositivo
          this.set({ baseVersion: 0, dirty: true });
          await this.persist();
          pushAfter = true;
        }
      } else if (doc.version !== this.state.baseVersion) {
        if (!this.state.dirty || !this.state.data) {
          const remote = validateAppData(doc.data);
          this.set({ data: remote, baseVersion: doc.version, dirty: false, lastSyncAt: new Date().toISOString() });
          await this.persist();
        } else if (sameData(doc.data, this.state.data)) {
          this.set({ baseVersion: doc.version, dirty: false });
          await this.persist();
        } else {
          this.busy = false;
          this.openConflict(doc);
          return;
        }
      } else {
        this.set({ lastSyncAt: new Date().toISOString() });
        pushAfter = this.state.dirty;
      }
      this.set({ error: null });
    } catch (e) {
      this.set({ error: `Error al sincronizar: ${msg(e)}` });
    } finally {
      this.busy = false;
      this.set({ status: this.state.error ? 'error' : this.idleStatus() });
    }
    if (pushAfter || this.again) {
      this.again = false;
      await this.push();
    }
  }

  /** Resuelve un conflicto quedándose con una versión. La otra se guarda como instantánea. */
  async resolveConflict(keep: 'local' | 'remote') {
    const c = this.state.conflict;
    if (!c) return;
    if (keep === 'local') {
      await addSnapshot(c.remote.data, `Conflicto: versión de la nube v${c.remote.version} descartada`).catch(() => undefined);
      this.pendingReason = 'Conflicto resuelto (se mantiene este dispositivo)';
      this.set({ conflict: null, baseVersion: c.remote.version, dirty: true });
      await this.persist();
      await this.push();
    } else {
      if (this.state.data) await addSnapshot(this.state.data, 'Conflicto: cambios de este dispositivo descartados').catch(() => undefined);
      this.edits++;
      this.set({ conflict: null, data: c.remote.data, baseVersion: c.remote.version, dirty: false, lastSyncAt: new Date().toISOString() });
      await this.persist();
      this.set({ status: this.idleStatus() });
    }
  }

  async signIn(email: string, password: string) {
    if (!supabase) throw new Error('Nube no configurada');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut() {
    if (!supabase) return;
    if (this.state.dirty) await this.push();
    await supabase.auth.signOut();
  }

  /** Crea los datos iniciales (vacíos) en un dispositivo sin datos. */
  async start(data: AppData) {
    this.edits++;
    this.set({ data, dirty: true });
    this.set({ status: this.idleStatus() });
    await this.persist();
    this.schedulePush(0, 'Inicio');
  }

  /** Espera a que las escrituras locales terminen (para tests/exportación). */
  flush() {
    return this.writeChain;
  }
}

function msg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

export const engine = new SyncEngine();
