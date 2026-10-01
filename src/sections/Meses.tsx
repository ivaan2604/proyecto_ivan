import { useEffect, useState } from 'react';
import { duplicarMes, mesesOrdenados, mesPrevision, sumLineas, totalesMes } from '../lib/derive';
import { addMonths } from '../lib/finance';
import { currentMonthKey, fmtEur, fmtMonthKey, monthName } from '../lib/format';
import { uid, type Linea } from '../lib/model';
import { update, useData } from '../store';
import { useDialogs } from '../ui/dialogs';
import { EstadoToggle, MoneyInput, TextInput } from '../ui/fields';
import { IconChevron, IconCopy, IconPlus, IconTrash } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { Counter } from '../ui/motion';

type Lado = 'ingresos' | 'gastos';

export function Meses() {
  const d = useData();
  const { confirm, toast } = useDialogs();
  const keys = mesesOrdenados(d);
  const last = keys[keys.length - 1];

  const sugerido = last ? addMonths(last, 1) : currentMonthKey();
  const [nuevoAnio, setNuevoAnio] = useState(Number(sugerido.slice(0, 4)));
  const [nuevoMes, setNuevoMes] = useState(Number(sugerido.slice(5, 7)));
  const nuevoKey = `${nuevoAnio}-${String(nuevoMes).padStart(2, '0')}`;

  const [sel, setSel] = useState<string | null>(last ?? null);
  const [anio, setAnio] = useState(Number((last ?? currentMonthKey()).slice(0, 4)));
  useEffect(() => {
    if (sel && !d.meses[sel]) setSel(mesesOrdenados(d).at(-1) ?? null);
  }, [d, sel]);

  const delAnio = keys.filter((k) => k.startsWith(`${anio}-`));
  const resumenAnio = delAnio.map((k) => ({ k, ...totalesMes(d.meses[k]) }));
  const totAnio = resumenAnio.reduce(
    (a, r) => ({ ingresos: a.ingresos + r.ingresos, gastos: a.gastos + r.gastos, beneficio: a.beneficio + r.beneficio }),
    { ingresos: 0, gastos: 0, beneficio: 0 },
  );

  const crear = (modo: 'prevision' | 'duplicar') => {
    if (d.meses[nuevoKey]) {
      toast(`${cap(fmtMonthKey(nuevoKey))} ya existe.`, { error: true });
      return;
    }
    if (modo === 'duplicar' && !last) return;
    update((x) => {
      x.meses[nuevoKey] = modo === 'prevision' ? mesPrevision(x, nuevoKey) : duplicarMes(x.meses[last!]);
    });
    setSel(nuevoKey);
    setAnio(nuevoAnio);
    const next = addMonths(nuevoKey, 1);
    setNuevoAnio(Number(next.slice(0, 4)));
    setNuevoMes(Number(next.slice(5, 7)));
    toast(`${cap(fmtMonthKey(nuevoKey))} creado${modo === 'duplicar' ? ` a partir de ${fmtMonthKey(last!)}` : ' con la previsión'}.`);
  };

  const borrarMes = async (k: string) => {
    const ok = await confirm({
      title: `Eliminar ${fmtMonthKey(k)}`,
      body: 'Se borrarán todos los ingresos y gastos de este mes. Quedará una copia en el historial de versiones.',
      confirmText: 'Eliminar mes',
      danger: true,
    });
    if (ok) {
      update((x) => {
        delete x.meses[k];
      });
      toast(`${cap(fmtMonthKey(k))} eliminado.`);
    }
  };

  const years = Array.from(new Set(keys.map((k) => Number(k.slice(0, 4)))));

  return (
    <div className="page">
      <PageHead
        folio="05"
        title="Meses e ingresos"
        subtitle="Tú decides cuándo crear cada mes. Los conceptos se rellenan al crearlo y luego son totalmente libres."
      />

      <section className="card no-print" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2>Nuevo mes</h2>
          <span className="hint">{last ? `Último creado: ${fmtMonthKey(last)}` : 'Aún no hay meses'}</span>
        </div>
        <div className="month-toolbar">
          <label className="field" style={{ width: 110 }}>
            <span>Año</span>
            <input
              className="input numeric"
              type="number"
              inputMode="numeric"
              value={nuevoAnio}
              onChange={(e) => setNuevoAnio(Number(e.target.value) || nuevoAnio)}
            />
          </label>
          <label className="field" style={{ width: 160 }}>
            <span>Mes</span>
            <select className="select input" value={nuevoMes} onChange={(e) => setNuevoMes(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {cap(monthName(i + 1))}
                  {d.meses[`${nuevoAnio}-${String(i + 1).padStart(2, '0')}`] ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={() => crear('prevision')} disabled={!!d.meses[nuevoKey]}>
            <IconPlus /> Añadir mes (previsión)
          </button>
          <button className="btn" onClick={() => crear('duplicar')} disabled={!last || !!d.meses[nuevoKey]}>
            <IconCopy /> Duplicar último mes
          </button>
        </div>
        {d.meses[nuevoKey] && <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>{cap(fmtMonthKey(nuevoKey))} ya existe.</p>}
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <div className="year-nav">
            <button className="btn ghost sm" aria-label="Año anterior" onClick={() => setAnio(anio - 1)}>
              <IconChevron dir="left" />
            </button>
            <span className="y">{anio}</span>
            <button className="btn ghost sm" aria-label="Año siguiente" onClick={() => setAnio(anio + 1)}>
              <IconChevron />
            </button>
          </div>
          {years.length > 1 && (
            <div className="month-chips no-print">
              {years.map((y) => (
                <button key={y} className="chip" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setAnio(y)}>
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
        {delAnio.length === 0 ? (
          <div className="empty">No hay meses creados en {anio}.</div>
        ) : (
          <div className="month-chips">
            {delAnio.map((k) => {
              const t = totalesMes(d.meses[k]);
              return (
                <button key={k} className={`month-chip ${t.beneficio >= 0 ? 'up' : 'down'}`} aria-pressed={sel === k} onClick={() => setSel(k)}>
                  <div className="m">{monthName(Number(k.slice(5)))}</div>
                  <div className={`b ${t.beneficio >= 0 ? 'pos' : 'neg'}`}>{fmtEur(t.beneficio, { compact: true, sign: true })}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {sel && d.meses[sel] && <MesDetalle key={sel} k={sel} onDelete={() => borrarMes(sel)} />}

      <section className="card flush" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>Resumen de {anio}</h2>
        </div>
        {resumenAnio.length === 0 ? (
          <div style={{ padding: '0 22px 22px' }}>
            <div className="empty">Sin datos en {anio}.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="ledger" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="r">Ingresos</th>
                  <th className="r">Gastos</th>
                  <th className="r">Beneficio</th>
                </tr>
              </thead>
              <tbody>
                {resumenAnio.map((r) => (
                  <tr key={r.k} style={{ cursor: 'pointer' }} onClick={() => setSel(r.k)}>
                    <td style={{ textTransform: 'capitalize' }}>{monthName(Number(r.k.slice(5)))}</td>
                    <td className="amount">{fmtEur(r.ingresos)}</td>
                    <td className="amount">{fmtEur(r.gastos)}</td>
                    <td className={`amount ${r.beneficio >= 0 ? 'pos' : 'neg'}`}>{fmtEur(r.beneficio, { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total {anio}</td>
                  <td className="amount">{fmtEur(totAnio.ingresos)}</td>
                  <td className="amount">{fmtEur(totAnio.gastos)}</td>
                  <td className={`amount ${totAnio.beneficio >= 0 ? 'pos' : 'neg'}`}>{fmtEur(totAnio.beneficio, { sign: true })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MesDetalle({ k, onDelete }: { k: string; onDelete: () => void }) {
  const d = useData();
  const m = d.meses[k];
  const t = totalesMes(m);
  return (
    <section className="card month-detail" aria-label={fmtMonthKey(k)}>
      <div className="card-head">
        <h2 style={{ textTransform: 'capitalize', fontSize: 26 }}>{fmtMonthKey(k)}</h2>
        <button className="btn ghost sm no-print" onClick={onDelete} style={{ color: 'var(--neg-ink)' }}>
          <IconTrash /> Eliminar mes
        </button>
      </div>
      <div className="lines-grid">
        <Lineas k={k} lado="ingresos" lineas={m.ingresos} />
        <Lineas k={k} lado="gastos" lineas={m.gastos} />
      </div>
      <div className="month-result">
        <span>Resultado del mes</span>
        <b className={t.beneficio >= 0 ? 'pos' : 'neg'}>
          <Counter id={`mes-${k}`} duration={600} value={t.beneficio} format={(v) => fmtEur(v, { sign: true })} />
        </b>
      </div>
    </section>
  );
}

function Lineas({ k, lado, lineas }: { k: string; lado: Lado; lineas: Linea[] }) {
  const { confirm } = useDialogs();
  const mod = (id: string, patch: Partial<Linea>) =>
    update((x) => {
      Object.assign(x.meses[k][lado].find((l) => l.id === id)!, patch);
    });
  const add = () =>
    update((x) => {
      x.meses[k][lado].push({ id: uid(), concepto: '', importe: 0, estado: 'pendiente' });
    });
  const del = async (l: Linea) => {
    if (l.concepto || l.importe) {
      const ok = await confirm({ title: 'Eliminar concepto', body: `¿Eliminar «${l.concepto || 'sin nombre'}»?`, confirmText: 'Eliminar', danger: true });
      if (!ok) return;
    }
    update((x) => {
      x.meses[k][lado] = x.meses[k][lado].filter((y) => y.id !== l.id);
    });
  };
  return (
    <div className="line-col">
      <h3>
        {lado === 'ingresos' ? 'Ingresos' : 'Gastos'}
        <span className={`num ${lado === 'ingresos' ? 'pos' : 'neg'}`}>{fmtEur(sumLineas(lineas))}</span>
      </h3>
      <table className="ledger stack">
        <thead>
          <tr>
            <th>Concepto</th>
            <th className="r">Importe</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.id}>
              <td className="full">
                <TextInput value={l.concepto} onChange={(v) => mod(l.id, { concepto: v })} placeholder="Concepto" ariaLabel="Concepto" />
              </td>
              <td className="amount" style={{ width: 140 }}>
                <MoneyInput value={l.importe} onChange={(v) => mod(l.id, { importe: v })} ariaLabel="Importe" />
              </td>
              <td style={{ width: 1 }}>
                <EstadoToggle value={l.estado} onChange={(v) => mod(l.id, { estado: v })} />
              </td>
              <td className="row-actions">
                <button className="icon-btn" aria-label="Eliminar concepto" onClick={() => del(l)}>
                  <IconTrash />
                </button>
              </td>
            </tr>
          ))}
          {lineas.length === 0 && (
            <tr>
              <td colSpan={4} className="muted full" style={{ fontSize: 13 }}>
                Sin conceptos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button className="btn ghost sm no-print" style={{ marginTop: 8 }} onClick={add}>
        <IconPlus /> Añadir {lado === 'ingresos' ? 'ingreso' : 'gasto'}
      </button>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
