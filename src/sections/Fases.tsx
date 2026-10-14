import { useMemo } from 'react';
import { fasesResultado, type Fase } from '../lib/derive';
import { addMonths } from '../lib/finance';
import { fmtEur, fmtMonthKey } from '../lib/format';
import type { AppData } from '../lib/model';

const mes = (k: string) => fmtMonthKey(k);

function periodo(f: Fase, fases: Fase[]): string {
  const ini = fases[1].desde;
  const fin = fases[1].hasta;
  switch (f.id) {
    case 'espera':
      return ini ? `Hasta ${mes(addMonths(ini, -1))}` : 'Hasta que empiece el alquiler (sin fecha todavía)';
    case 'devolviendo':
      if (ini && fin && fin < ini) return `No llega a darse: el préstamo familiar acaba en ${mes(fin)}, antes del alquiler`;
      return `${ini ? `Desde ${mes(ini)}` : 'Desde el inicio del alquiler'} · ${fin ? `hasta ${mes(fin)}` : 'hasta la última cuota (sin fecha: falta la escritura)'}`;
    case 'libre':
      return f.desde ? `Desde ${mes(f.desde)}` : 'Tras la última cuota del préstamo familiar';
  }
}

/** Resultado mensual previsto en las tres fases de la operación. */
export function PanelFases({ d }: { d: AppData }) {
  const fases = useMemo(() => fasesResultado(d), [d]);
  return (
    <section className="card fases" aria-labelledby="h-fases">
      <div className="card-head">
        <h2 id="h-fases">Resultado mensual por fases</h2>
        <span className="hint">previsto, con los datos de «Compra y financiación»</span>
      </div>
      <div className="fases-grid">
        {fases.map((f) => (
          <div key={f.id} className={`fase fase-${f.id}`}>
            <div className="fase-title">{f.titulo}</div>
            <div className={`fase-figure ${f.resultado > 0 ? 'pos' : f.resultado < 0 ? 'neg' : ''}`}>
              {fmtEur(f.resultado, { sign: true })}
              <small>/mes</small>
            </div>
            <div className="fase-when">{periodo(f, fases)}</div>
            <ul className="fase-lines">
              {f.lineas.map((l) => (
                <li key={l.concepto}>
                  <span>{l.concepto}</span>
                  <b className="num">{fmtEur(l.importe, { sign: true })}</b>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
        Antes de alquilar, todo sale de tu bolsillo. Los gastos fijos incluyen el mantenimiento que pongas en «Compra y
        financiación»; los meses reales que registres en «Meses» son los que cuentan para la rentabilidad.
        {d.hipoteca.provisional && ' La cuota de la hipoteca es provisional hasta la FEIN.'}
      </p>
    </section>
  );
}
