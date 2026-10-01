// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '../../lib/model';

/**
 * Servidor falso con la misma semántica que la función SQL save_document
 * (compare-and-swap por versión + historial de revisiones).
 */
interface FakeServer {
  doc: { version: number; data: AppData; updated_at: string; device: string | null } | null;
  revisions: { version: number; data: AppData }[];
  online: boolean;
}
const g = globalThis as unknown as { server: FakeServer };

vi.mock('../remote', () => {
  const check = () => {
    if (!g.server.online) throw new Error('Failed to fetch');
  };
  return {
    cloudEnabled: true,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'yo@example.com' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
    fetchDoc: async () => {
      check();
      return g.server.doc ? structuredClone(g.server.doc) : null;
    },
    saveDoc: async (base: number, data: AppData, device: string) => {
      check();
      const cur = g.server.doc;
      if ((cur?.version ?? 0) !== base) {
        return cur ? { ok: false, ...structuredClone(cur) } : { ok: false, version: 0, data: null };
      }
      const version = base + 1;
      g.server.doc = { version, data: structuredClone(data), updated_at: new Date().toISOString(), device };
      g.server.revisions.push({ version, data: structuredClone(data) });
      return { ok: true, version };
    },
  };
});

/** Crea un "dispositivo": motor nuevo con su propia IndexedDB. */
async function device() {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  const { engine } = await import('../engine');
  const local = await import('../local');
  const { emptyData } = await import('../../lib/model');
  await engine.init();
  await settle(); // init lanza una primera sincronización
  return { engine, local, emptyData };
}

const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
  g.server = { doc: null, revisions: [], online: true };
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => g.server.online });
});

describe('motor de sincronización', () => {
  it('sube los datos y confirma la versión', async () => {
    const { engine, emptyData } = await device();
    await engine.start(emptyData());
    await engine.push();
    expect(g.server.doc?.version).toBe(1);
    engine.update((d) => void (d.piso.precio = 7_500_000));
    await engine.push();
    expect(g.server.doc?.version).toBe(2);
    expect(g.server.doc?.data.piso.precio).toBe(7_500_000);
    expect(engine.getState().dirty).toBe(false);
    expect(g.server.revisions).toHaveLength(2);
  });

  it('sin conexión el cambio queda guardado en el dispositivo y se sube después', async () => {
    const A = await device();
    await A.engine.start(A.emptyData());
    await A.engine.push();
    g.server.online = false;
    A.engine.update((d) => void (d.piso.precio = 123_00));
    await A.engine.push();
    await A.engine.flush();
    expect(A.engine.getState().dirty).toBe(true);
    const saved = await A.local.loadLocal();
    expect(saved?.data?.piso.precio).toBe(123_00);
    expect(saved?.dirty).toBe(true);
    g.server.online = true;
    await A.engine.sync();
    await settle();
    expect(g.server.doc?.data.piso.precio).toBe(123_00);
    expect(A.engine.getState().dirty).toBe(false);
  });

  it('un segundo dispositivo descarga los datos al entrar', async () => {
    const A = await device();
    await A.engine.start(A.emptyData());
    A.engine.update((d) => void (d.hipoteca.banco = 'Santander'));
    await A.engine.push();
    await settle();
    const B = await device();
    await B.engine.sync();
    expect(B.engine.getState().data?.hipoteca.banco).toBe('Santander');
    expect(B.engine.getState().baseVersion).toBe(g.server.doc?.version);
  });

  it('ediciones simultáneas: no sobrescribe, abre conflicto y conserva ambas versiones', async () => {
    const A = await device();
    await A.engine.start(A.emptyData());
    await A.engine.push();
    await settle();
    expect(g.server.doc!.version).toBe(1);

    const B = await device();
    expect(B.engine.getState().baseVersion).toBe(1);
    B.engine.update((d) => void d.notas.push({ id: 'b', fecha: '2026-10-01', texto: 'desde B' }));
    await B.engine.push();
    expect(g.server.doc!.version).toBe(2);

    // A sigue en la versión 1 y edita sin saber nada de B
    A.engine.update((d) => void d.notas.push({ id: 'a', fecha: '2026-10-01', texto: 'desde A' }));
    await A.engine.push();

    expect(g.server.doc!.version).toBe(2); // el servidor NO se ha tocado
    expect(g.server.doc!.data.notas[0].texto).toBe('desde B');
    expect(A.engine.getState().conflict).not.toBeNull();
    expect(A.engine.getState().status).toBe('conflict');

    // Elegir la local: se sube encima; la remota queda en el historial y como instantánea
    await A.engine.resolveConflict('local');
    expect(g.server.doc!.version).toBe(3);
    expect(g.server.doc!.data.notas[0].texto).toBe('desde A');
    expect(g.server.revisions.some((r) => r.data.notas[0]?.texto === 'desde B')).toBe(true);
    const snaps = await A.local.listSnapshots();
    expect(snaps.some((s) => s.data.notas[0]?.texto === 'desde B')).toBe(true);
  });

  it('elegir la versión de la nube guarda la local como instantánea', async () => {
    g.server.online = false;
    const A = await device();
    await A.engine.start({ ...A.emptyData(), piso: { ...A.emptyData().piso, tipoVivienda: 'local' } });
    await settle();
    const nube = A.emptyData();
    nube.piso.tipoVivienda = 'nube';
    g.server.doc = { version: 5, data: nube, updated_at: new Date().toISOString(), device: 'Mac' };
    g.server.online = true;
    await A.engine.sync();
    expect(A.engine.getState().conflict).not.toBeNull();
    expect(g.server.doc.data.piso.tipoVivienda).toBe('nube');
    await A.engine.resolveConflict('remote');
    expect(A.engine.getState().data?.piso.tipoVivienda).toBe('nube');
    expect(A.engine.getState().dirty).toBe(false);
    const snaps = await A.local.listSnapshots();
    expect(snaps[0].data.piso.tipoVivienda).toBe('local');
  });

  it('importar/restablecer guarda antes una instantánea', async () => {
    const A = await device();
    await A.engine.start({ ...A.emptyData(), notas: [{ id: 'x', fecha: '', texto: 'importante' }] });
    await A.engine.replaceAll(A.emptyData(), 'Restablecer todo');
    const snaps = await A.local.listSnapshots();
    expect(snaps[0].reason).toContain('Restablecer');
    expect(snaps[0].data.notas[0].texto).toBe('importante');
  });
});
