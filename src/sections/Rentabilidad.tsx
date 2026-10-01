import { useMemo } from 'react';
import { rentabilidad } from '../lib/derive';
import { fmtDate, fmtEur, fmtInt } from '../lib/format';
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
          <div className="rent-big">{fmtEur(r.costeTotalConAmort, { compact: true })}</div>
          <Fila k="Total gastos de compra" v={fmtEur(r.gastosCompra)} />
          {r.prestamos.map((p) => (
            <Fila
              key={p.nombre}
              k={`Intereses ${p.nombre.toLowerCase()}${p.meses ? ` (${fmtInt(p.meses)} cuotas)` : ''}`}
              v={p.intereses === null ? 'no se liquida' : fmtEur(p.intereses)}
            />
          ))}
          <Fila k="Coste total sin amortizar" v={fmtEur(r.costeTotal)} strong />

          <div className="rent-sub">
            <h4>Con tus amortizaciones</h4>
            {r.hayAmortizaciones ? (
              <>
                {r.prestamos
                  .filter((p) => p.anticipado > 0)
                  .map((p) => (
                    <div key={p.nombre}>
                      <Fila k={`${p.nombre}: amortizado antes`} v={fmtEur(p.anticipado)} />
                      <Fila
                        k={`Intereses ${p.nombre.toLowerCase()}${p.mesesConAmort ? ` (${fmtInt(p.mesesConAmort)} cuotas)` : ''}`}
                        v={p.interesesConAmort === null ? 'no se liquida' : fmtEur(p.interesesConAmort)}
                      />
                    </div>
                  ))}
                <Fila k="Coste total con amortizaciones" v={fmtEur(r.costeTotalConAmort)} strong />
                <div className="rent-save">
                  <span>Te ahorras</span>
                  <b className="num">{fmtEur(r.ahorro)}</b>
                  <small>
                    {r.prestamos
                      .filter((p) => p.anticipado > 0 && p.mesesAhorro)
                      .map((p) => `${p.nombre}: ${fmtInt(p.mesesAhorro!)} ${p.mesesAhorro === 1 ? 'mes' : 'meses'} antes`)
                      .join(' · ')}
                  </small>
                </div>
              </>
            ) : (
              <p className="rent-note" style={{ marginTop: 0 }}>
                Cuando apuntes una amortización anticipada en «Hipoteca» o «Préstamo familiar» verás aquí el
                coste total recalculado y cuánto te ahorras en intereses.
              </p>
            )}
          </div>
          <p className="rent-note">
            «Sin amortizar» es el peor caso: todos los préstamos pagados enteros (cuota × nº de cuotas).
            «Con amortizaciones» suma los intereses ya pagados y los que quedan sobre lo que debes hoy,
            con la misma cuota (se acorta el plazo).
            {r.interesesIncompletos && ' La cuota de algún préstamo no llega a cubrir sus intereses: no se incluyen.'}
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
              <p className="rent-warn">
                {r.enReforma
                  ? `En reforma: se calculará con el primer mes de alquiler (${fmtDate(d.recurrentes.inicioAlquiler)}).`
                  : 'Hace falta al menos un mes de alquiler con datos en «Meses» para calcularla.'}
              </p>
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
          <Fila k="Dinero propio" v={fmtEur(r.dineroPropio)} />
          {r.costeEspera !== 0 && <Fila k="Coste de la espera (meses de reforma)" v={fmtEur(r.costeEspera)} />}
          <Fila k="Capital propio invertido" v={fmtEur(r.capitalPropio)} strong />
          <p className="rent-note">
            Real, con los meses de alquiler registrados hasta hoy (beneficio después de cuotas y gastos). El
            dinero propio es lo pagado de la compra menos lo pagado con los préstamos; la espera es el saldo de
            los meses anteriores al alquiler. Es lo mismo que «Invertido» en la recuperación.
          </p>
        </div>
      </div>
    </section>
  );
}
