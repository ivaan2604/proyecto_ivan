import { useMemo, useState } from 'react';
import { buildBackup, downloadJson } from '../lib/backup';
import { mesesOrdenados, totalesGastos } from '../lib/derive';
import { fmtDateTime, fmtEur } from '../lib/format';
import type { AppData } from '../lib/model';
import { useEngine } from '../store';
import { engine, type EngineState } from '../sync/engine';
import { Modal } from './dialogs';
import { go } from '../router';

export function statusText(s: EngineState): string {
  switch (s.status) {
    case 'loading': return 'Cargando…';
    case 'local': return 'Solo este dispositivo';
    case 'signed-out': return 'Sin sesión · guardado local';
    case 'synced': return 'Sincronizado';
    case 'pending': return 'Cambios pendientes de subir';
    case 'syncing': return 'Sincronizando…';
    case 'offline': return s.dirty ? 'Sin conexión · guardado local' : 'Sin conexión';
    case 'error': return 'Error de sincronización';
    case 'conflict': return 'Conflicto: elige versión';
  }
}

export function SyncPill() {
  const s = useEngine();
  return (
    <a
      href="#/copia"
      className={`sync-pill ${s.status}`}
      title={s.error ?? statusText(s)}
      onClick={(e) => {
        e.preventDefault();
        go('copia');
      }}
    >
      <span className="led" />
      <span>{statusText(s)}</span>
    </a>
  );
}

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form"
      style={{ gridTemplateColumns: '1fr' }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await engine.signIn(email.trim(), pass);
        } catch (e) {
          const m = (e as Error).message;
          setErr(/invalid/i.test(m) ? 'Email o contraseña incorrectos.' : m);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input className="input" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
      </label>
      {err && <p className="neg" style={{ margin: 0, fontSize: 13 }}>{err}</p>}
      <div>
        <button className="btn primary" disabled={busy}>{busy ? 'Entrando…' : 'Iniciar sesión'}</button>
      </div>
    </form>
  );
}

function resumen(d: AppData) {
  const g = totalesGastos(d);
  const meses = mesesOrdenados(d);
  return [
    ['Aportado (pagado)', fmtEur(g.pagado)],
    ['Gastos de compra', fmtEur(g.total)],
    ['Meses', `${meses.length}${meses.length ? ` (último ${meses[meses.length - 1]})` : ''}`],
    ['Cuotas hipoteca', String(d.cuotas.hipoteca.length)],
    ['Cuotas préstamo familiar', String(d.cuotas.familiar.length)],
    ['Notas', String(d.notas.length)],
  ];
}

/** Aparece si otro dispositivo guardó cambios a la vez que este. Nada se pierde. */
export function ConflictModal() {
  const s = useEngine();
  const c = s.conflict;
  const local = s.data;
  const rows = useMemo(() => (c && local ? { l: resumen(local), r: resumen(c.remote.data) } : null), [c, local]);
  const [busy, setBusy] = useState(false);
  if (!c || !local || !rows) return null;
  const pick = async (k: 'local' | 'remote') => {
    setBusy(true);
    await engine.resolveConflict(k);
    setBusy(false);
  };
  return (
    <Modal
      title="Hay cambios en dos dispositivos"
      wide
      actions={
        <>
          <button className="btn ghost" onClick={() => downloadJson({ local: buildBackup(local), nube: buildBackup(c.remote.data) }, 'conflicto_ambas_versiones.json')}>
            Descargar ambas
          </button>
          <button className="btn" disabled={busy} onClick={() => pick('remote')}>Usar la de la nube</button>
          <button className="btn primary" disabled={busy} onClick={() => pick('local')}>Mantener la de este dispositivo</button>
        </>
      }
    >
      <p className="body" style={{ color: 'var(--ink-2)' }}>
        Mientras editabas aquí, se guardó otra versión desde <b>{c.remote.device ?? 'otro dispositivo'}</b>
        {c.remote.updated_at ? ` (${fmtDateTime(c.remote.updated_at)})` : ''}. Elige con cuál quedarte: la otra se
        guarda como instantánea en «Copia y ajustes → Historial», así que no se pierde nada.
      </p>
      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th />
              <th className="r">Este dispositivo</th>
              <th className="r">Nube (v{c.remote.version})</th>
            </tr>
          </thead>
          <tbody>
            {rows.l.map(([k, v], i) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="amount">{v}</td>
                <td className="amount" style={{ fontWeight: v !== rows.r[i][1] ? 700 : undefined }}>{rows.r[i][1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
