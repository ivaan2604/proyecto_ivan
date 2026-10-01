import { useMemo, type CSSProperties } from 'react';
import { totalesReforma } from '../lib/derive';
import { fmtEur, todayISO } from '../lib/format';
import { uid, type PagoReforma, type PartidaReforma, type TipoObra } from '../lib/model';
import { update, useData } from '../store';
import { useDialogs } from '../ui/dialogs';
import { DateInput, EstadoToggle, MoneyInput, Segmented, TextInput } from '../ui/fields';
import { IconPlus, IconTrash } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { Counter } from '../ui/motion';

const TIPOS: { value: TipoObra; label: string }[] = [
  { value: 'mejora', label: 'Mejora' },
  { value: 'reparacion', label: 'Reparación' },
];

function partida(x: ReturnType<typeof useData>, id: string): PartidaReforma {
  return x.reforma.partidas.find((p) => p.id === id)!;
}

export function Reforma() {
  const d = useData();
  const { confirm, toast } = useDialogs();
  const t = useMemo(() => totalesReforma(d), [d]);
  const partidas = d.reforma.partidas;

  const setPartida = (id: string, patch: Partial<Omit<PartidaReforma, 'id' | 'pagos'>>) =>
    update((x) => {
      Object.assign(partida(x, id), patch);
    });
  const setPago = (pid: string, id: string, patch: Partial<Omit<PagoReforma, 'id'>>) =>
    update((x) => {
      Object.assign(partida(x, pid).pagos.find((p) => p.id === id)!, patch);
    });

  const addPartida = () =>
    update((x) => {
      x.reforma.partidas.push({ id: uid(), concepto: 'Nueva partida', presupuesto: 0, tipo: 'mejora', pagos: [] });
    });
  const addPago = (pid: string) =>
    update((x) => {
      partida(x, pid).pagos.push({ id: uid(), fecha: todayISO(), importe: 0, estado: 'pendiente', factura: '', nota: '' });
    });

  const delPartida = async (p: PartidaReforma) => {
    const ok = await confirm({
      title: `Eliminar «${p.concepto}»`,
      body: p.pagos.length ? `Se borrarán también sus ${p.pagos.length} pagos.` : '¿Eliminar esta partida?',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (ok) update((x) => void (x.reforma.partidas = x.reforma.partidas.filter((q) => q.id !== p.id)));
  };
  const delPago = async (pid: string, id: string) => {
    if (await confirm({ title: 'Eliminar pago', body: '¿Eliminar este pago?', confirmText: 'Eliminar', danger: true })) {
      update((x) => {
        const p = partida(x, pid);
        p.pagos = p.pagos.filter((q) => q.id !== id);
      });
    }
  };

  /** Pasa el importe único de «Compra y financiación» a una partida (solo si el usuario lo pide). */
  const convertir = () => {
    update((x) => {
      const pagado = x.gastosBase.reforma.estado === 'pagado';
      x.reforma.partidas.push({
        id: uid(),
        concepto: 'Reforma',
        presupuesto: x.gastos.reforma,
        tipo: 'mejora',
        pagos: pagado
          ? [{ id: uid(), fecha: x.gastosBase.reforma.fecha, importe: x.gastos.reforma, estado: 'pagado', factura: '', nota: '' }]
          : [],
      });
    });
    toast('Presupuesto convertido en una partida. Ya puedes desglosarlo.');
  };

  return (
    <div className="page">
      <PageHead
        folio="04"
        title="Reforma"
        subtitle="Presupuesto por partidas y cada pago con su fecha. Todo cuenta como inversión en el piso, no como gasto del mes."
        actions={
          <button className="btn primary" onClick={addPartida}>
            <IconPlus /> Añadir partida
          </button>
        }
      />

      {partidas.length === 0 && d.gastos.reforma > 0 && (
        <section className="card" style={{ marginBottom: 18 }}>
          <p style={{ marginTop: 0 }}>
            En «Compra y financiación» tienes un presupuesto de reforma de <b className="num">{fmtEur(d.gastos.reforma)}</b> como
            un único importe. Puedes convertirlo en una partida y desglosarlo desde aquí.
          </p>
          <button className="btn" onClick={convertir}>Convertir en partida</button>
        </section>
      )}

      {partidas.length > 0 && (
        <div className="stats" style={{ marginBottom: 18 }}>
          <div className="stat">
            <div className="k">Presupuesto</div>
            <div className="v">{fmtEur(t.presupuesto, { compact: true })}</div>
            <div className="d">{partidas.length} {partidas.length === 1 ? 'partida' : 'partidas'}</div>
          </div>
          <div className="stat">
            <div className="k">Pagado</div>
            <div className="v pos">
              <Counter id="reforma-pagado" duration={700} value={t.pagado} format={(v) => fmtEur(v, { compact: true })} />
            </div>
            <div className="d">{t.previsto ? `${Math.round((t.pagado / t.previsto) * 100)} % del coste previsto` : '—'}</div>
          </div>
          <div className="stat">
            <div className="k">Pendiente</div>
            <div className="v">{fmtEur(t.pendiente, { compact: true })}</div>
            <div className="d">coste previsto {fmtEur(t.previsto, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="k">Desviación</div>
            <div className={`v ${t.desviacion > 0 ? 'neg' : ''}`}>{t.desviacion > 0 ? `+${fmtEur(t.desviacion, { compact: true })}` : '0 €'}</div>
            <div className="d">{t.desviacion > 0 ? `+${Math.round(t.desviacionPct)} % sobre presupuesto` : 'dentro del presupuesto'}</div>
          </div>
        </div>
      )}

      {partidas.length === 0 && d.gastos.reforma === 0 && (
        <div className="card empty">Aún no hay partidas. Añade la primera (albañilería, cocina, baño…).</div>
      )}

      <div className="grid">
        {partidas.map((p, i) => {
          const tp = t.partidas[i];
          const pct = tp.previsto ? Math.min(1, tp.pagado / tp.previsto) : 0;
          return (
            <section key={p.id} className="card flush">
              <div className="partida-head">
                <TextInput value={p.concepto} onChange={(v) => setPartida(p.id, { concepto: v })} ariaLabel="Partida" />
                <Segmented value={p.tipo} options={TIPOS} onChange={(v) => setPartida(p.id, { tipo: v })} ariaLabel="Tipo de obra" />
                <label className="field partida-presu">
                  <span>Presupuesto</span>
                  <MoneyInput value={p.presupuesto} onChange={(v) => setPartida(p.id, { presupuesto: v })} ariaLabel="Presupuesto" />
                </label>
                <button className="icon-btn" aria-label={`Eliminar ${p.concepto}`} onClick={() => delPartida(p)}>
                  <IconTrash />
                </button>
              </div>

              {p.pagos.length > 0 && (
                <div className="table-wrap">
                  <table className="ledger stack">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th className="r">Importe</th>
                        <th>Estado</th>
                        <th>Factura</th>
                        <th>Notas</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {p.pagos.map((x) => (
                        <tr key={x.id}>
                          <td data-label="Fecha" style={{ minWidth: 150 }}>
                            <DateInput value={x.fecha} onChange={(v) => setPago(p.id, x.id, { fecha: v })} ariaLabel="Fecha" />
                          </td>
                          <td className="amount" data-label="Importe" style={{ minWidth: 130 }}>
                            <MoneyInput value={x.importe} onChange={(v) => setPago(p.id, x.id, { importe: v })} ariaLabel="Importe" />
                          </td>
                          <td data-label="Estado">
                            <EstadoToggle value={x.estado} onChange={(v) => setPago(p.id, x.id, { estado: v })} />
                          </td>
                          <td data-label="Factura" style={{ minWidth: 120 }}>
                            <TextInput value={x.factura} onChange={(v) => setPago(p.id, x.id, { factura: v })} placeholder="Nº" ariaLabel="Factura" />
                          </td>
                          <td data-label="Notas" style={{ minWidth: 160 }}>
                            <TextInput value={x.nota} onChange={(v) => setPago(p.id, x.id, { nota: v })} placeholder="—" ariaLabel="Notas" />
                          </td>
                          <td className="row-actions">
                            <button className="icon-btn" aria-label="Eliminar pago" onClick={() => delPago(p.id, x.id)}>
                              <IconTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="partida-foot">
                <button className="btn sm" onClick={() => addPago(p.id)}>
                  <IconPlus /> Añadir pago
                </button>
                <div className="partida-progress">
                  <div className={`meter partida-meter${tp.desviacion > 0 ? ' over' : ''}`} role="progressbar" aria-label={`Pagado de ${p.concepto}`} aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ '--p': pct } as CSSProperties} />
                  </div>
                  <span className="muted">
                    Pagado <b>{fmtEur(tp.pagado)}</b> de {fmtEur(tp.previsto)}
                    {tp.desviacion > 0 && <b className="neg"> · +{fmtEur(tp.desviacion)} sobre presupuesto</b>}
                  </span>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {partidas.length > 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          Mejoras: <b>{fmtEur(t.mejora)}</b> · Reparaciones: <b>{fmtEur(t.reparacion)}</b>. Para
          Hacienda, una <b>mejora</b> (cocina nueva, redistribución…) aumenta el valor del piso y se amortiza; una{' '}
          <b>reparación</b> o conservación se deduce como gasto. Guarda las facturas desglosadas y confírmalo con tu
          gestor. Cada pago aparece en «Gastos de compra»; lo que queda de presupuesto sin pagos se muestra allí como
          pendiente.
        </p>
      )}
    </div>
  );
}
