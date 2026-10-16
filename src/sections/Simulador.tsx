import { useMemo, useState } from 'react';
import { simularAmortizacion, type OpcionesAmortizacion } from '../lib/derive';
import { fmtEur, fmtMonthKey } from '../lib/format';
import type { AppData } from '../lib/model';
import { Field, MoneyInput, NumberInput, Segmented } from '../ui/fields';

const anios = (m: number) => {
  const a = Math.floor(m / 12);
  const r = m % 12;
  return [a ? `${a} ${a === 1 ? 'año' : 'años'}` : '', r ? `${r} ${r === 1 ? 'mes' : 'meses'}` : ''].filter(Boolean).join(' y ') || '0 meses';
};

/** Qué pasa si amortizas parte de la hipoteca: reduciendo plazo o cuota, una vez o cada año. No guarda nada. */
export function SimuladorAmortizacion({ d }: { d: AppData }) {
  const [importe, setImporte] = useState(300000);
  const [anio, setAnio] = useState(2);
  const [cadaAnio, setCadaAnio] = useState(false);
  const base: OpcionesAmortizacion = { importe: 0, trasCuota: 1, cadaAnio: false, modo: 'plazo' };
  const opc = { importe, trasCuota: Math.max(1, Math.round(anio) * 12), cadaAnio };
  const sin = useMemo(() => simularAmortizacion(d, base), [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const plazo = useMemo(() => simularAmortizacion(d, { ...opc, modo: 'plazo' }), [d, importe, anio, cadaAnio]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuota = useMemo(() => simularAmortizacion(d, { ...opc, modo: 'cuota' }), [d, importe, anio, cadaAnio]); // eslint-disable-line react-hooks/exhaustive-deps
  const ahorro = (x: typeof sin) => sin.intereses - x.intereses - x.comision;
  const col = (titulo: string, x: typeof sin, destaca?: boolean) => (
    <div className={`sim-col${destaca ? ' destaca' : ''}`}>
      <div className="sim-title">{titulo}</div>
      <dl>
        <div>
          <dt>Intereses en total</dt>
          <dd className="num">{fmtEur(x.intereses)}</dd>
        </div>
        <div>
          <dt>Te ahorras</dt>
          <dd className={`num ${ahorro(x) > 0 ? 'pos' : ''}`}>{x === sin ? '—' : fmtEur(ahorro(x))}</dd>
        </div>
        <div>
          <dt>Terminas</dt>
          <dd>
            {x.fin ? fmtMonthKey(x.fin) : `en ${anios(x.meses)}`}
            {x !== sin && x.meses < sin.meses && <small>{anios(sin.meses - x.meses)} antes</small>}
          </dd>
        </div>
        <div>
          <dt>Cuota al final</dt>
          <dd className="num">{fmtEur(x.cuotaFinal)}</dd>
        </div>
      </dl>
    </div>
  );

  return (
    <section className="card simulador" aria-labelledby="h-sim">
      <div className="card-head">
        <h2 id="h-sim">Simulador de amortización</h2>
        <span className="hint">prueba sin guardar nada</span>
      </div>
      <div className="form">
        <Field label="Cuánto amortizas">
          <MoneyInput value={importe} onChange={setImporte} />
        </Field>
        <Field label="Cuándo" hint={`Tras la cuota nº ${opc.trasCuota}`}>
          <NumberInput value={anio} onChange={(v) => setAnio(Math.max(1, Math.min(25, Math.round(v) || 1)))} suffix="º año" />
        </Field>
        <Field label="¿Cuántas veces?">
          <Segmented
            value={cadaAnio ? 'cada' : 'una'}
            options={[{ value: 'una', label: 'Una vez' }, { value: 'cada', label: 'Cada año' }]}
            onChange={(v) => setCadaAnio(v === 'cada')}
            ariaLabel="Repetición"
          />
        </Field>
      </div>
      <div className="sim-grid">
        {col('Sin amortizar', sin)}
        {col('Reduciendo plazo', plazo, ahorro(plazo) >= ahorro(cuota))}
        {col('Reduciendo cuota', cuota, ahorro(cuota) > ahorro(plazo))}
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
        {plazo.amortizado > 0 &&
          `Amortizas ${fmtEur(plazo.amortizado)} en total${plazo.amortizado !== cuota.amortizado ? ` (${fmtEur(cuota.amortizado)} reduciendo cuota)` : ''}. `}
        Reducir plazo ahorra más intereses; reducir cuota te deja más dinero libre cada mes.
        {d.hipoteca.fein.comisionAmortPct > 0
          ? ` Incluye la comisión del ${d.hipoteca.fein.comisionAmortPct} %.`
          : ' Tu hipoteca no cobra comisión por amortizar una parte.'}{' '}
        Avisa al banco por escrito con un mes de antelación y di qué prefieres (si no, reducen la cuota). Ten en cuenta que
        con menos intereses también desgravas menos en el IRPF del alquiler.
      </p>
    </section>
  );
}
