import { useMemo } from 'react';
import { amortizacionesHipoteca } from '../lib/derive';
import { fmtDate, fmtEur, fmtMonthKey } from '../lib/format';
import type { AppData } from '../lib/model';

const tiempo = (m: number) => {
  const a = Math.floor(m / 12);
  const r = m % 12;
  return [a ? `${a} ${a === 1 ? 'año' : 'años'}` : '', r ? `${r} ${r === 1 ? 'mes' : 'meses'}` : ''].filter(Boolean).join(' y ') || '0 meses';
};

/** Lo que llevas amortizado por adelantado en la hipoteca y lo que te ha ahorrado, en total y una a una. */
export function MisAmortizaciones({ d }: { d: AppData }) {
  const r = useMemo(() => amortizacionesHipoteca(d), [d]);
  return (
    <section className="card amortizaciones" aria-labelledby="h-amort">
      <div className="card-head">
        <h2 id="h-amort">Tus amortizaciones anticipadas</h2>
        <span className="hint">Reduciendo plazo, con la misma cuota</span>
      </div>
      {r.lista.length === 0 ? (
        <div className="empty">
          Aún no has amortizado nada. Cuando lo hagas, apunta el importe en la columna «Amort. anticipada» de la cuota de ese mes y
          aquí verás cuánto llevas amortizado, los intereses que te ahorras y cuánto antes terminas.
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="k">Amortizado por adelantado</div>
              <div className="v">{fmtEur(r.total)}</div>
              <div className="d">
                en {r.lista.length} {r.lista.length === 1 ? 'vez' : 'veces'}
                {r.comision > 0 ? ` · ${fmtEur(r.comision)} de comisión` : ''}
              </div>
            </div>
            <div className="stat">
              <div className="k">Intereses que te ahorras</div>
              <div className="v pos">{fmtEur(r.ahorro)}</div>
              <div className="d">{r.total > 0 ? `${(r.ahorro / r.total).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € por cada euro amortizado` : ''}</div>
            </div>
            <div className="stat">
              <div className="k">Tiempo que te ahorras</div>
              <div className="v">{tiempo(r.meses)}</div>
              <div className="d">{r.meses} {r.meses === 1 ? 'cuota menos' : 'cuotas menos'}</div>
            </div>
            <div className="stat">
              <div className="k">Terminas de pagar</div>
              <div className="v">{r.finCon ? fmtMonthKey(r.finCon) : '—'}</div>
              <div className="d">{r.finSin ? `en vez de ${fmtMonthKey(r.finSin)}` : ''}</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="ledger stack">
              <thead>
                <tr>
                  <th>Cuota</th>
                  <th>Fecha</th>
                  <th className="r">Amortizado</th>
                  <th className="r">Intereses ahorrados</th>
                  <th className="r">Tiempo ahorrado</th>
                </tr>
              </thead>
              <tbody>
                {r.lista.map((x) => (
                  <tr key={x.n}>
                    <td data-label="Cuota" className="num">nº {x.n}</td>
                    <td data-label="Fecha">{x.fecha ? fmtDate(x.fecha) : '—'}</td>
                    <td data-label="Amortizado" className="amount">{fmtEur(x.importe)}</td>
                    <td data-label="Intereses ahorrados" className="amount pos">{fmtEur(x.ahorro)}</td>
                    <td data-label="Tiempo ahorrado" className="amount">{tiempo(x.meses)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="amount" data-label="Amortizado">{fmtEur(r.total)}</td>
                  <td className="amount pos" data-label="Intereses ahorrados">{fmtEur(r.ahorro)}</td>
                  <td className="amount" data-label="Tiempo ahorrado">{tiempo(r.meses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
