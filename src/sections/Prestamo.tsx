import { useMemo } from 'react';
import { eurRow, LineChart } from '../charts/charts';
import { calendarioDe, cuotaPactada } from '../lib/derive';
import { addMonths, mesesRestantes } from '../lib/finance';
import { fmtDate, fmtEur } from '../lib/format';
import { uid, type Cuota, type LoanKind } from '../lib/model';
import { update, useData } from '../store';
import { useDialogs } from '../ui/dialogs';
import { DateInput, MoneyInput, OptionalMoneyInput } from '../ui/fields';
import { IconPlus, IconTrash } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { go } from '../router';

export function Prestamo({ kind }: { kind: LoanKind }) {
  const d = useData();
  const { confirm } = useDialogs();
  const cal = useMemo(() => calendarioDe(d, kind), [d, kind]);
  const p = kind === 'hipoteca' ? d.hipoteca : d.familiar;
  const pactada = cuotaPactada(d, kind);
  const cuotas = d.cuotas[kind];
  const restantes = mesesRestantes(cal.pendiente, p.tinPct, pactada);
  const plazoOriginal = kind === 'hipoteca' ? Math.round(d.hipoteca.plazoAnios * 12) : pactada ? Math.ceil(p.importe / pactada) : 0;
  const cuotasPagadas = cal.filas.filter((f) => !f.liquidado).length;
  const ahorroMeses = restantes !== null && plazoOriginal ? plazoOriginal - cuotasPagadas - restantes : 0;
  const titulo = kind === 'hipoteca' ? 'Hipoteca' : 'Préstamo familiar';
  const sinInteres = p.tinPct === 0;

  const mod = (id: string, patch: Partial<Cuota>) =>
    update((x) => {
      Object.assign(x.cuotas[kind].find((c) => c.id === id)!, patch);
    });

  const add = () =>
    update((x) => {
      const list = x.cuotas[kind];
      const prev = list[list.length - 1];
      // Fecha sugerida: un mes después de la cuota anterior
      let fecha = '';
      if (prev?.fecha) fecha = `${addMonths(prev.fecha.slice(0, 7), 1)}-${prev.fecha.slice(8, 10)}`;
      list.push({ id: uid(), fecha, cuota: null, interes: null, anticipada: 0 });
    });

  const del = async (c: Cuota, n: number) => {
    const ok = await confirm({
      title: `Eliminar cuota nº ${n}`,
      body: 'Las cuotas posteriores se renumerarán y el capital pendiente se recalculará.',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (ok)
      update((x) => {
        x.cuotas[kind] = x.cuotas[kind].filter((y) => y.id !== c.id);
      });
  };

  return (
    <div className="page">
      <PageHead
        folio={kind === 'hipoteca' ? '06' : '07'}
        title={kind === 'hipoteca' ? `Hipoteca${d.hipoteca.banco ? ` · ${d.hipoteca.banco}` : ''}` : 'Préstamo familiar'}
        subtitle={
          <>
            Cuota pactada fija de <b className="num">{fmtEur(pactada)}</b>
            {sinInteres ? ', sin interés' : ` al ${p.tinPct.toLocaleString('es-ES')} % TIN`}. La amortización
            anticipada reduce el plazo, no la cuota.{' '}
            <a href="#/compra" className="no-print" onClick={(e) => (e.preventDefault(), go('compra'))}>Editar condiciones</a>
          </>
        }
        actions={
          <button className="btn primary" onClick={add} disabled={!p.importe}>
            <IconPlus /> Añadir cuota
          </button>
        }
      />

      <div className="stats stagger" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="k">Capital pendiente</div>
          <div className="v">{fmtEur(cal.pendiente)}</div>
          <div className="d">de {fmtEur(p.importe)}</div>
        </div>
        <div className="stat">
          <div className="k">Amortizado</div>
          <div className="v">{fmtEur(cal.totalCapital + cal.totalAnticipado)}</div>
          <div className="d">{cal.totalAnticipado ? `${fmtEur(cal.totalAnticipado)} anticipado` : `${cuotas.length} cuotas`}</div>
        </div>
        <div className="stat">
          <div className="k">Intereses pagados</div>
          <div className="v">{fmtEur(cal.totalIntereses)}</div>
          <div className="d">hasta la fecha</div>
        </div>
        <div className="stat">
          <div className="k">Plazo restante</div>
          <div className="v">{restantes === null ? '—' : cal.pendiente === 0 && cuotas.length ? 'Liquidado' : `${restantes} meses`}</div>
          <div className="d">
            {[
              restantes !== null && restantes > 0 ? `≈ ${(restantes / 12).toLocaleString('es-ES', { maximumFractionDigits: 1 })} años` : '',
              ahorroMeses > 0 ? `${ahorroMeses} meses antes de lo previsto` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>

      {!p.importe ? (
        <div className="empty">
          Configura el importe del {titulo.toLowerCase()} en{' '}
          <a href="#/compra" onClick={(e) => (e.preventDefault(), go('compra'))}>Compra y financiación</a>.
        </div>
      ) : (
        <>
          <section className="card flush">
            <div className="card-head">
              <h2>Cuotas</h2>
              <span className="hint">Deja «cuota» o «interés» vacíos para usar el valor calculado</span>
            </div>
            <div className="table-wrap">
              <table className="ledger stack">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Fecha</th>
                    <th className="r">Cuota pagada</th>
                    <th className="r">Interés</th>
                    <th className="r">Capital amortizado</th>
                    <th className="r">Amort. anticipada</th>
                    <th className="r">Capital pendiente</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cal.filas.length === 0 && (
                    <tr>
                      <td colSpan={8} className="full">
                        <div className="empty">Aún no hay cuotas. Añádelas una a una según las vayas pagando.</div>
                      </td>
                    </tr>
                  )}
                  {cal.filas.map((f, i) => {
                    const c = cuotas[i];
                    return (
                      <tr key={f.id} className={f.liquidado ? 'liquidado' : undefined}>
                        <td data-label="Nº" className="num">{f.n}</td>
                        <td data-label="Fecha" style={{ minWidth: 150 }}>
                          <DateInput value={c.fecha} onChange={(v) => mod(c.id, { fecha: v })} ariaLabel="Fecha" />
                        </td>
                        <td data-label="Cuota pagada" className="amount" style={{ minWidth: 130 }}>
                          {f.liquidado ? fmtEur(0) : (
                            <OptionalMoneyInput value={c.cuota} auto={f.cuotaAuto} onChange={(v) => mod(c.id, { cuota: v })} ariaLabel="Cuota pagada" />
                          )}
                        </td>
                        <td data-label="Interés" className="amount" style={{ minWidth: 120 }}>
                          {f.liquidado || sinInteres && c.interes === null ? fmtEur(f.interes) : (
                            <OptionalMoneyInput value={c.interes} auto={f.interesAuto} onChange={(v) => mod(c.id, { interes: v })} ariaLabel="Interés" />
                          )}
                        </td>
                        <td data-label="Capital amortizado" className="amount">{fmtEur(f.capital)}</td>
                        <td data-label="Amort. anticipada" className="amount" style={{ minWidth: 130 }}>
                          {f.liquidado ? fmtEur(0) : (
                            <MoneyInput value={c.anticipada} onChange={(v) => mod(c.id, { anticipada: v })} ariaLabel="Amortización anticipada" placeholder="—" />
                          )}
                        </td>
                        <td data-label="Pendiente" className="amount"><b>{fmtEur(f.pendiente)}</b></td>
                        <td className="row-actions">
                          <button className="icon-btn" aria-label={`Eliminar cuota ${f.n}`} onClick={() => del(c, f.n)}>
                            <IconTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {cal.filas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={2}>Totales</td>
                      <td className="amount" data-label="Pagado en cuotas">{fmtEur(cal.filas.reduce((s, f) => s + f.cuota, 0))}</td>
                      <td className="amount" data-label="Intereses">{fmtEur(cal.totalIntereses)}</td>
                      <td className="amount" data-label="Capital">{fmtEur(cal.totalCapital)}</td>
                      <td className="amount" data-label="Anticipado">{fmtEur(cal.totalAnticipado)}</td>
                      <td className="amount" data-label="Pendiente">{fmtEur(cal.pendiente)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="card-head">
              <h2>Evolución del capital pendiente</h2>
            </div>
            <LineChart
              ariaLabel={`Capital pendiente del ${titulo.toLowerCase()}`}
              color="var(--terracotta)"
              data={[
                { label: 'Inicio', title: 'Capital inicial', value: p.importe, rows: [eurRow('Pendiente', p.importe)] },
                ...cal.filas.map((f) => ({
                  label: `nº ${f.n}`,
                  title: `Cuota nº ${f.n}${f.fecha ? ` · ${fmtDate(f.fecha)}` : ''}`,
                  value: f.pendiente,
                  rows: [
                    eurRow('Cuota', f.cuota),
                    eurRow('Interés', f.interes),
                    eurRow('Capital', f.capital),
                    ...(f.anticipada ? [eurRow('Anticipada', f.anticipada)] : []),
                    eurRow('Pendiente', f.pendiente),
                  ],
                })),
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
