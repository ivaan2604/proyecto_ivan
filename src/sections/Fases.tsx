import { useMemo, type CSSProperties } from 'react';
import { fasesResultado, finPrestamoFamiliar, previsionMensual, type Fase } from '../lib/derive';
import { eurRow, ProfitBars, type BarBand } from '../charts/charts';
import { go } from '../router';
import { fmtEur, fmtMonthKey } from '../lib/format';
import type { AppData } from '../lib/model';

const mes = (k: string) => fmtMonthKey(k);

const ETAPA: Record<Fase['id'], { n: string; nombre: string }> = {
  espera: { n: '1', nombre: 'Esperando' },
  devolviendo: { n: '2', nombre: 'Devolviendo' },
  libre: { n: '3', nombre: 'Beneficio' },
};

/** Previsión mes a mes con las etapas como bandas y el fin del préstamo familiar marcado. */
function Prevision({ d }: { d: AppData }) {
  const prev = useMemo(() => previsionMensual(d), [d]);
  if (!prev) {
    const faltan = [!d.hitos.escrituraFecha && 'la fecha de escritura', !d.recurrentes.inicioAlquiler && 'la fecha de inicio del alquiler'].filter(Boolean);
    return (
      <div className="empty invite">
        <b>La previsión mes a mes aparecerá aquí</b>
        <span>Pon {faltan.join(' y ') || 'las fechas que faltan'} y verás cada etapa en el calendario, con el mes en que acaba la devolución a tus padres.</span>
        <button className="btn" onClick={() => go('compra')}>Poner fechas</button>
      </div>
    );
  }
  const bands: BarBand[] = [];
  prev.forEach((m, i) => {
    const last = bands[bands.length - 1];
    if (last && last.className === m.fase) last.to = i;
    else bands.push({ from: i, to: i, className: m.fase, label: `${ETAPA[m.fase].n} · ${ETAPA[m.fase].nombre}` });
  });
  const fin = finPrestamoFamiliar(d);
  const finIdx = prev.findIndex((m) => m.key === fin);
  return (
    <ProfitBars
      height={200}
      legend={bands.map((b) => (
        <span key={b.className}>
          <i className={`band-key ${b.className}`} />
          {b.label}
        </span>
      ))}
      bands={bands}
      markers={finIdx >= 0 ? [{ index: finIdx, label: `Última cuota a tus padres · ${fmtMonthKey(fin!, true)}` }] : undefined}
      data={prev.map((m) => ({
        key: m.key,
        label: fmtMonthKey(m.key, true),
        title: fmtMonthKey(m.key),
        value: m.resultado,
        rows: [{ label: 'Etapa', value: ETAPA[m.fase].nombre }, eurRow('Resultado previsto', m.resultado, true)],
      }))}
    />
  );
}

function periodo(f: Fase): string {
  const n = f.meses !== null ? ` · ${f.meses} ${f.meses === 1 ? 'mes' : 'meses'}` : '';
  if (f.desde && f.hasta) return f.desde === f.hasta ? `${mes(f.desde)}${n}` : `${mes(f.desde)} – ${mes(f.hasta)}${n}`;
  if (f.hasta) return `Hasta ${mes(f.hasta)}`;
  if (f.desde) return `Desde ${mes(f.desde)}`;
  switch (f.id) {
    case 'espera':
      return 'Hasta que empiece el alquiler (sin fecha todavía)';
    case 'devolviendo':
      return 'Desde el alquiler hasta la última cuota familiar (sin fechas todavía)';
    case 'libre':
      return 'Tras la última cuota del préstamo familiar';
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
      <div className="fases-grid" style={{ '--n': fases.length } as CSSProperties}>
        {fases.map((f, i) => (
          <div key={f.key} className={`fase fase-${f.id}`}>
            <div className="fase-band">
              <span>Etapa {i + 1}</span>
              {ETAPA[f.id].nombre}
            </div>
            <div className="fase-title">{f.titulo}</div>
            {f.subtitulo && <div className="fase-sub">{f.subtitulo}</div>}
            <div className={`fase-figure ${f.resultado > 0 ? 'pos' : f.resultado < 0 ? 'neg' : ''}`}>
              {fmtEur(f.resultado, { sign: true })}
              <small>/mes</small>
            </div>
            <div className="fase-when">{periodo(f)}</div>
            <div className="fase-eco" title="La parte de capital de las cuotas es deuda que dejas de deber: es ahorro, no gasto">
              <span>Resultado económico</span>
              <b className={`num ${f.economico > 0 ? 'pos' : f.economico < 0 ? 'neg' : ''}`}>≈ {fmtEur(f.economico, { sign: true })}/mes</b>
              <small>con {fmtEur(f.capital)} de capital devuelto</small>
            </div>
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
      <div className="fases-prevision">
        <Prevision d={d} />
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
        Las etapas 1 y 2 salen en negativo porque estás invirtiendo y devolviendo: es lo previsto, no una alarma. La cifra
        grande es la caja (lo que entra y sale de tu cuenta); el resultado económico suma el capital que devuelves, que es
        deuda que dejas de deber.
        Antes de alquilar, todo sale de tu bolsillo. Los gastos fijos incluyen el mantenimiento que pongas en «Compra y
        financiación»; los meses reales que registres en «Meses» son los que cuentan para la rentabilidad.
        {d.hipoteca.provisional && ' La cuota de la hipoteca es provisional hasta la FEIN.'}
      </p>
    </section>
  );
}
