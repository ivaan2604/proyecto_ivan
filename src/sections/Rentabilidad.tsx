import { useMemo } from 'react';
import { rentabilidad } from '../lib/derive';
import { fmtEur, fmtInt } from '../lib/format';
import type { AppData } from '../lib/model';

const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`);
const cls = (v: number | null) => (v === null ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '');

function Fila({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`rent-row${strong ? ' strong' : ''}`}>
      <span>{k}</span>
      <b className="num">{v}</b>
    </div>
  );
}

/** Coste total a largo plazo y rentabilidad (complementa al seguimiento de la recuperación). */
export function PanelRentabilidad({ d }: { d: AppData }) {
  const r = useMemo(() => rentabilidad(d), [d]);

  return (
    <section className="card" style={{ marginTop: 18 }} aria-labelledby="h-rent">
      <div className="card-head">
        <h2 id="h-rent">Coste total y rentabilidad</h2>
        <span className="hint">qué rinde mientras tanto y qué cuesta todo</span>
      </div>

      <div className="rent">
        <div className="rent-block">
          <h3>Coste total estimado</h3>
          <div className="rent-big">{fmtEur(r.costeTotal, { compact: true })}</div>
          <Fila k="Total gastos de compra" v={fmtEur(r.gastosCompra)} />
          {r.prestamos.map((p) => (
            <Fila
              key={p.nombre}
              k={`Intereses ${p.nombre.toLowerCase()}${p.meses ? ` (${fmtInt(p.meses)} cuotas)` : ''}`}
              v={p.intereses === null ? 'no se liquida' : fmtEur(p.intereses)}
            />
          ))}
          <Fila k="Coste total con intereses" v={fmtEur(r.costeTotal)} strong />
          <p className="rent-note">
            Estimación en el peor caso: pagando todos los préstamos enteros (cuota × nº de cuotas) sin
            amortizar nada antes. Bajará si amortizas anticipadamente.
            {r.interesesIncompletos && ' La cuota del préstamo familiar no llega a cubrir sus intereses: no se incluyen.'}
          </p>
        </div>

        <div className="rent-block">
          <h3>Rentabilidad del piso</h3>
          <div className="rent-pair">
            <div>
              <div className="k">Bruta</div>
              <div className={`rent-big ${cls(r.brutaPct)}`}>{pct(r.brutaPct)}</div>
            </div>
            <div>
              <div className="k">Neta</div>
              <div className={`rent-big ${cls(r.netaPct)}`}>{pct(r.netaPct)}</div>
            </div>
          </div>
          <Fila k="Alquiler anual previsto" v={fmtEur(r.alquilerAnual)} />
          <Fila k="Gastos recurrentes anuales" v={fmtEur(-r.gastosRecurrentesAnuales)} />
          <Fila k="Inversión total del activo" v={fmtEur(r.inversionActivo)} strong />
          <p className="rent-note">
            Teórica, con los datos previstos de «Compra y financiación» e independiente de cómo se
            financie. Inversión = precio + gastos de compra. Los gastos recurrentes son IBI, seguros,
            cuota del edificio y mantenimiento, sin hipoteca ni préstamo.
          </p>
        </div>

        <div className="rent-block">
          <h3>Rentabilidad sobre tu dinero</h3>
          {r.beneficioAnual === null ? (
            <>
              <div className="rent-big">—</div>
              <p className="rent-warn">Hace falta al menos un mes con datos en «Meses» para calcularla.</p>
            </>
          ) : (
            <>
              <div className={`rent-big ${cls(r.cashOnCashPct)}`}>{pct(r.cashOnCashPct)}</div>
              {r.proyectado && (
                <p className="rent-warn">
                  Proyección con {r.mesesConDatos} {r.mesesConDatos === 1 ? 'mes' : 'meses'} de datos: aún no es un año completo.
                </p>
              )}
            </>
          )}
          <Fila
            k={r.proyectado ? 'Beneficio neto anual (proyectado)' : 'Beneficio neto últimos 12 meses'}
            v={r.beneficioAnual === null ? '—' : fmtEur(r.beneficioAnual, { sign: true })}
          />
          <Fila k="Capital propio invertido" v={fmtEur(r.capitalPropio)} strong />
          <p className="rent-note">
            Real, con los meses registrados hasta hoy (beneficio después de cuotas y gastos). El capital
            propio es lo aportado de tu bolsillo, igual que en la recuperación de la inversión.
          </p>
        </div>
      </div>
    </section>
  );
}
