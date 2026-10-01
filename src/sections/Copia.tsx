import { useRef, useState } from 'react';
import { backupFileName, buildBackup, downloadJson, parseBackup } from '../lib/backup';
import { BACKUP_DIAS } from '../lib/derive';
import { daysBetween, fmtDateTime, todayISO } from '../lib/format';
import { emptyData, type AppData } from '../lib/model';
import { validateAppData } from '../lib/schema';
import { useData, useEngine } from '../store';
import { engine } from '../sync/engine';
import { listSnapshots, type Snapshot } from '../sync/local';
import { cloudEnabled, fetchRevision, listRevisions, type RevisionInfo } from '../sync/remote';
import type { Theme } from '../theme';
import { useDialogs } from '../ui/dialogs';
import { Segmented } from '../ui/fields';
import { IconDownload, IconUpload } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { SignInForm, statusText } from '../ui/sync';

export function Copia({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const d = useData();
  const st = useEngine();
  const { confirm, toast, alert } = useDialogs();
  const fileRef = useRef<HTMLInputElement>(null);
  const [revs, setRevs] = useState<RevisionInfo[] | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [loading, setLoading] = useState(false);

  const diasSinCopia = d.meta.lastExportAt ? daysBetween(d.meta.lastExportAt.slice(0, 10), todayISO()) : null;

  const exportar = () => {
    const now = new Date().toISOString();
    engine.update((x) => {
      x.meta.lastExportAt = now;
    });
    const data = engine.getState().data!;
    downloadJson(buildBackup(data), backupFileName());
    toast('Copia descargada.');
  };

  const importar = async (file: File) => {
    const text = await file.text();
    const r = parseBackup(text);
    if (!r.ok) {
      await alert({ title: 'No se puede importar', body: r.error, danger: true });
      return;
    }
    const ok = await confirm({
      title: 'Restaurar desde copia',
      body: `Archivo «${file.name}» (${r.origen === 'prototipo' ? 'formato del prototipo' : 'copia de esta app'}): ${r.resumen}.\n\nSustituirá TODOS los datos actuales. Antes se guardará automáticamente una instantánea de los datos actuales, que podrás recuperar desde el historial.`,
      confirmText: 'Sustituir datos',
      danger: true,
    });
    if (!ok) return;
    await engine.replaceAll(r.data, `Importación de ${file.name}`);
    toast('Datos importados correctamente.');
  };

  const restaurar = async (data: AppData, etiqueta: string) => {
    let valid: AppData;
    try {
      valid = validateAppData(data);
    } catch {
      await alert({ title: 'Versión no válida', body: 'Esa versión no tiene un formato válido.', danger: true });
      return;
    }
    const ok = await confirm({
      title: 'Restaurar versión',
      body: `Se restaurará la versión «${etiqueta}». Los datos actuales se guardarán antes como instantánea.`,
      confirmText: 'Restaurar',
    });
    if (!ok) return;
    await engine.replaceAll(valid, `Restaurar ${etiqueta}`);
    toast('Versión restaurada.');
  };

  const cargarHistorial = async () => {
    setLoading(true);
    try {
      setSnaps(await listSnapshots());
      if (cloudEnabled && st.session) setRevs(await listRevisions());
    } catch (e) {
      toast(`No se pudo cargar el historial: ${(e as Error).message}`, { error: true });
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const paso1 = await confirm({
      title: 'Restablecer todo',
      body: 'Esto borrará todos los datos de la app: compra, gastos, meses, cuotas y notas.\n\nTe recomendamos exportar antes una copia de seguridad.',
      confirmText: 'Continuar',
      danger: true,
    });
    if (!paso1) return;
    const paso2 = await confirm({
      title: '¿Seguro del todo?',
      body: 'Último paso. Se guardará una instantánea local y, si usas la nube, la versión anterior quedará en el historial, pero la app quedará vacía.',
      confirmText: 'Borrar todo',
      danger: true,
      typeToConfirm: 'BORRAR',
    });
    if (!paso2) return;
    await engine.replaceAll(emptyData(), 'Restablecer todo');
    toast('Datos restablecidos.');
  };

  return (
    <div className="page">
      <PageHead folio="08" title="Copia y ajustes" subtitle="Sincronización entre dispositivos, copias de seguridad, historial de versiones y apariencia." />

      <div className="grid g-2 stagger">
        <section className="card">
          <div className="card-head">
            <h2>Sincronización</h2>
            <span className={`sync-pill ${st.status}`}>
              <span className="led" /> {statusText(st)}
            </span>
          </div>
          {!cloudEnabled ? (
            <p className="muted" style={{ margin: 0 }}>
              Esta instalación funciona <b>solo en este dispositivo</b> (los datos se guardan en el navegador). Para
              ver los mismos datos en el móvil y el ordenador, configura Supabase siguiendo el README del proyecto.
            </p>
          ) : !st.session ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>Inicia sesión para sincronizar con la nube.</p>
              <SignInForm />
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                Conectado como <b>{st.session.user.email}</b>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>
                  Este dispositivo: {engine.device} · versión v{st.baseVersion}
                  {st.lastSyncAt ? ` · última comprobación ${fmtDateTime(st.lastSyncAt)}` : ''}
                </span>
              </p>
              {st.error && <p className="neg" style={{ fontSize: 13 }}>{st.error}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => void engine.sync()}>Sincronizar ahora</button>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    if (await confirm({ title: 'Cerrar sesión', body: 'Los datos seguirán en este dispositivo, pero dejarán de sincronizarse hasta que vuelvas a entrar.', confirmText: 'Cerrar sesión' }))
                      await engine.signOut();
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Copia de seguridad</h2>
            <span className={`chip ${diasSinCopia === null || diasSinCopia >= BACKUP_DIAS ? 'ochre' : 'pos'}`}>
              {diasSinCopia === null ? 'Nunca exportada' : diasSinCopia === 0 ? 'Exportada hoy' : `Hace ${diasSinCopia} días`}
            </span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Un archivo JSON con todos tus datos. Guárdalo fuera de la app (correo, nube, disco). También acepta las
            copias exportadas del prototipo.
          </p>
          <p style={{ fontSize: 13 }} className="muted">Última exportación: {fmtDateTime(d.meta.lastExportAt)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={exportar}>
              <IconDownload /> Exportar JSON
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <IconUpload /> Importar JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void importar(f);
              }}
            />
          </div>
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h2>Historial de versiones</h2>
            <button className="btn sm" onClick={cargarHistorial} disabled={loading}>
              {loading ? 'Cargando…' : revs || snaps ? 'Actualizar' : 'Ver historial'}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
            Nada se sobrescribe: {cloudEnabled ? 'cada guardado en la nube crea una revisión (se conservan las 300 últimas y una por día para siempre), y ' : ''}
            este dispositivo guarda instantáneas automáticas cada 30 minutos de uso y antes de cualquier importación,
            restauración o conflicto.
          </p>
          {(revs || snaps) && (
            <div className="grid g-2">
              {cloudEnabled && (
                <div>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>En la nube</h3>
                  {!st.session ? (
                    <div className="empty">Inicia sesión para verlo.</div>
                  ) : (
                    <VersionList
                      items={(revs ?? []).map((r) => ({
                        key: `r${r.id}`,
                        title: `v${r.version} · ${fmtDateTime(r.created_at)}`,
                        sub: [r.device, r.reason].filter(Boolean).join(' · '),
                        load: () => fetchRevision(r.id),
                      }))}
                      onRestore={restaurar}
                    />
                  )}
                </div>
              )}
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>En este dispositivo</h3>
                <VersionList
                  items={(snaps ?? []).map((s) => ({
                    key: `s${s.id}`,
                    title: fmtDateTime(s.at),
                    sub: s.reason,
                    load: async () => s.data,
                  }))}
                  onRestore={restaurar}
                />
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Apariencia</h2>
          </div>
          <Segmented
            ariaLabel="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'auto', label: 'Automático' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Oscuro' },
            ]}
          />
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Se guarda en cada dispositivo.</p>
        </section>

        <section className="card" style={{ borderColor: 'var(--neg)' }}>
          <div className="card-head">
            <h2 className="neg">Zona peligrosa</h2>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>Borra todos los datos. Pide confirmación en dos pasos.</p>
          <button className="btn" style={{ color: 'var(--neg-ink)', borderColor: 'var(--neg)' }} onClick={reset}>
            Restablecer todo…
          </button>
        </section>
      </div>
    </div>
  );
}

function VersionList({
  items, onRestore,
}: {
  items: { key: string; title: string; sub: string; load: () => Promise<AppData> }[];
  onRestore: (d: AppData, label: string) => void;
}) {
  const { toast } = useDialogs();
  if (!items.length) return <div className="empty">Sin versiones todavía.</div>;
  const run = async (it: (typeof items)[number], action: 'restore' | 'download') => {
    try {
      const data = await it.load();
      if (action === 'restore') onRestore(data, it.title);
      else downloadJson(buildBackup(data), `version_${it.key}.json`);
    } catch (e) {
      toast(`No se pudo cargar: ${(e as Error).message}`, { error: true });
    }
  };
  return (
    <ul className="alerts" style={{ maxHeight: 360, overflowY: 'auto' }}>
      {items.map((it) => (
        <li key={it.key} className="alert" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <div className="t num" style={{ fontSize: 13 }}>{it.title}</div>
            <div className="d">{it.sub}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn ghost sm" onClick={() => run(it, 'download')} aria-label="Descargar">
              <IconDownload />
            </button>
            <button className="btn sm" onClick={() => run(it, 'restore')}>Restaurar</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
