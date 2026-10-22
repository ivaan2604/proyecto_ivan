import { useMemo, useState, type CSSProperties } from 'react';
import { eurRow, LineChart, ProfitBars } from '../charts/charts';
import {
  bolsilloReal, capitalDevuelto, enReforma, recuperacionPrevista, rentabilidad, seguimientoGlobal, sinReforma, totalesMes,
} from '../lib/derive';
import { fmtDate, fmtEur, fmtMonthKey } from '../lib/format';
import { useData } from '../store';
import { engine } from '../sync/engine';
import { Segmented } from '../ui/fields';
import { IconTrendDown, IconTrendUp } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { Counter, InView, useChangeFlash } from '../ui/motion';
import { go } from '../router';
import { PanelRentabilidad } from './Rentabilidad';
import { PanelFases } from './Fases';
import { useConReforma } from './useConReforma';

const eur0 = (c: number) => fmtEur(c, { compact: true });
const pct2 = (hundredths: number) =>
  `${(hundredths / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

/** Mini gráfica del beneficio acumulado para la tarjeta (sin ejes: solo la forma). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 36;
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <line className="spark-zero" x1="0" x2={w} y1={y(0)} y2={y(0)} />
      <path className="spark-line" pathLength={1} d={line} />
      <circle className={`spark-dot ${last >= 0 ? 'up' : 'down'}`} cx={x(values.length - 1)} cy={y(last)} r="3" />
    </svg>
  );
}

/** La entrada completa (barras que se llenan, flor, mini gráfica) solo la primera vez por sesión. */
let primeraVisita = true;

export function Analisis() {
  const real = useData();
  const [conReforma, setConReforma] = useConReforma();
  const hayReforma = real.gastos.reforma > 0 || real.reforma.partidas.length > 0;
  const d = useMemo(() => (conReforma || !hayReforma ? real : sinReforma(real)), [real, conReforma, hayReforma]);
  const [intro] = useState(() => {
    const v = primeraVisita;
    primeraVisita = false;
    return v;
  });
  const seg = useMemo(() => seguimientoGlobal(d), [d]);
  const r = useMemo(() => rentabilidad(d), [d]);
  const reforma = enReforma(d);
  // Gráfica mes a mes: todos los meses; recuperación: solo los de alquiler (seg.serie)
  const keys = Object.keys(d.meses).sort();
  const keysAlquiler = seg.serie.map((p) => p.key);
  // Hasta el primer mes de alquiler, los bloques de beneficio, rentabilidad y recuperación estarían vacíos
  const alquilando = keysAlquiler.length > 0;
  const recPrev = useMemo(() => recuperacionPrevista(d), [d]);
  const capDevuelto = useMemo(() => capitalDevuelto(d), [d]);
  const bol = useMemo(() => bolsilloReal(d), [d]);

  const pctDevuelto = bol.aportado ? Math.min(1, bol.devuelto / bol.aportado) : 0;
  const flashBeneficio = useChangeFlash(seg.beneficio, 'beneficio');
  // Recuperación: el mismo criterio que «Aportado de tu bolsillo» (lo puesto frente a lo que te devuelve el piso)
  const flashRecup = useChangeFlash(pctDevuelto, 'recup');

  const recupPrevTexto =
    !keysAlquiler.length && recPrev?.mes && recPrev.mesesDesdeAlquiler
      ? `Previsión: recuperas lo invertido en ≈ ${(recPrev.mesesDesdeAlquiler / 12).toLocaleString('es-ES', { maximumFractionDigits: 1 })} años de alquiler · ${fmtMonthKey(recPrev.mes)}`
      : null;
  // Con pocos meses reales (o mientras devuelves a tus padres) la media no sirve: manda la previsión por etapas
  const previsionRecup = recPrev?.mes ? `Previsión: lo recuperas todo en ${fmtMonthKey(recPrev.mes)}` : null;
  const recupTexto = recupPrevTexto ?? (bol.aportado > 0 && bol.falta === 0
    ? 'Ya has recuperado todo lo que pusiste'
    : seg.recuperadoEn
      ? `Recuperado en ${fmtMonthKey(seg.recuperadoEn)}`
      : previsionRecup
        ?? (seg.proyeccionKey
          ? `Al ritmo actual, en ≈ ${seg.proyeccionMeses} meses · ${fmtMonthKey(seg.proyeccionKey)}`
          : bol.aportado > 0
            ? keysAlquiler.length
              ? 'Sin beneficio medio positivo todavía'
              : reforma
                ? `En reforma: empieza a contar con el primer alquiler (${fmtDate(d.recurrentes.inicioAlquiler)})`
                : 'Empezará a contar con el primer mes de alquiler'
            : 'Aún no hay nada aportado'));

  return (
    <div className="page resumen analisis">
      <PageHead
        folio="02"
        title="Análisis"
        subtitle="Rentabilidad, recuperación y el detalle mes a mes. Las cuentas para mirar con calma."
        actions={
          <div className="resumen-acciones no-print">
            {hayReforma && (
              <Segmented
                value={conReforma ? 'con' : 'sin'}
                options={[{ value: 'sin', label: 'Sin reforma' }, { value: 'con', label: 'Con reforma' }]}
                onChange={(v) => setConReforma(v === 'con')}
                ariaLabel="Ver con o sin la reforma"
              />
            )}
            <button className="btn" onClick={() => engine.enterSandbox()} title="Prueba cambios sin tocar tus datos reales">
              Probar un supuesto
            </button>
          </div>
        }
      />
      {hayReforma && !conReforma && (
        <p className="muted resumen-nota">Viendo la compra y la hipoteca sin la reforma, que va aparte.</p>
      )}

      <section className={`kpis analisis${intro ? ' intro' : ''}`} aria-label="Cifras del alquiler">
        {alquilando && (
          <>
        <article className={`kpi kpi-tile${flashBeneficio ? ` flash-${flashBeneficio}` : ''}`} aria-labelledby="h-benef">
          <div className="kpi-label" id="h-benef">Beneficio acumulado</div>
          <div className={`kpi-figure ${seg.beneficio > 0 ? 'pos' : seg.beneficio < 0 ? 'neg' : ''}`}>
            {seg.beneficio !== 0 && (seg.beneficio > 0 ? <IconTrendUp className="trend" /> : <IconTrendDown className="trend" />)}
            <Counter id="beneficio" value={seg.beneficio} format={(v) => fmtEur(v, { compact: true, sign: true })} />
          </div>
          <div className="kpi-row">
            <div className="kpi-sub">
              {keysAlquiler.length
                ? `${keysAlquiler.length} ${keysAlquiler.length === 1 ? 'mes' : 'meses'} de alquiler · media ${fmtEur(Math.round(seg.media), { sign: true })}/mes`
                : reforma
                  ? 'En reforma: aún sin meses de alquiler'
                  : 'Sin meses de alquiler registrados'}
            </div>
            <Sparkline values={seg.serie.map((p) => p.acumulado)} />
          </div>
          {capDevuelto > 0 && (
            <div className="kpi-split">
              <span>
                Capital devuelto de los préstamos <b className="num pos">{fmtEur(capDevuelto)}</b> · es ahorro, no gasto
              </span>
            </div>
          )}
        </article>

        <article className="kpi kpi-tile" aria-labelledby="h-roi">
          <div className="kpi-label" id="h-roi">Rentabilidad sobre tu dinero</div>
          {r.cashOnCashPct === null ? (
            <div className="kpi-figure muted-figure">—</div>
          ) : (
            <div className={`kpi-figure ${r.cashOnCashPct > 0 ? 'pos' : r.cashOnCashPct < 0 ? 'neg' : ''}`}>
              <Counter id="roi" value={Math.round(r.cashOnCashPct * 100)} format={pct2} />
              {r.proyectado && <span className="tag">proyección</span>}
            </div>
          )}
          <div className="kpi-sub">
            {r.cashOnCashPct === null
              ? r.enReforma
                ? 'Se calculará con el primer mes de alquiler'
                : 'Necesita al menos un mes de alquiler'
              : `${fmtEur(r.beneficioAnual ?? 0, { compact: true, sign: true })} al año sobre ${eur0(r.capitalPropio)}`}
          </div>
          <div className="kpi-split">
            <span>
              Bruta del piso <b className="num">{r.brutaPct === null ? '—' : pct2(Math.round(r.brutaPct * 100))}</b>
            </span>
            <span>
              Neta <b className="num">{r.netaPct === null ? '—' : pct2(Math.round(r.netaPct * 100))}</b>
            </span>
          </div>
        </article>
          </>
        )}
        {alquilando && (
        <article className={`kpi kpi-recovery${flashRecup ? ` flash-${flashRecup}` : ''}`} aria-labelledby="h-recup">
          <div className="recovery-head">
            <div>
              <div className="kpi-label" id="h-recup">Recuperación de la inversión</div>
              <div className="recovery-figure">
                <Counter id="recup" value={Math.round(pctDevuelto * 1000)} format={(v) => `${Math.round(v / 10)} %`} />
              </div>
            </div>
            <p className="recovery-text">{recupTexto}</p>
          </div>
          <div
            className="meter recovery-meter"
            role="progressbar"
            aria-label="Inversión recuperada"
            aria-valuenow={Math.round(pctDevuelto * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ '--p': pctDevuelto } as CSSProperties} />
            <i style={{ left: '25%' }} />
            <i style={{ left: '50%' }} />
            <i style={{ left: '75%' }} />
          </div>
          <dl className="recovery-foot">
            <div>
              <dt>Aportado</dt>
              <dd className="num">{fmtEur(bol.aportado)}</dd>
              {bol.mesesNegativos !== 0 && (
                <small>
                  {eur0(bol.compra)} compra + {eur0(bol.mesesNegativos)} meses
                </small>
              )}
            </div>
            <div>
              <dt>Te ha devuelto</dt>
              <dd className={`num ${bol.devuelto > 0 ? 'pos' : ''}`}>{fmtEur(bol.devuelto)}</dd>
            </div>
            <div>
              <dt>Falta</dt>
              <dd className="num">{fmtEur(bol.falta)}</dd>
            </div>
          </dl>
        </article>
        )}
        {!alquilando && (
          <p className="kpi kpi-luego muted">
            {recupPrevTexto ?? 'El beneficio, la rentabilidad real y la recuperación aparecerán aquí con el primer mes de alquiler registrado en «Meses».'}
          </p>
        )}
      </section>

      <div className="resumen-fases">
        <PanelFases d={d} />
      </div>

      {alquilando && (
        <>
      {/* ───── Gráficas ───── */}
      <InView className={intro ? 'reveal' : 'settled'}>
        <section className="card" aria-labelledby="h-pyg">
          <div className="card-head">
            <h2 id="h-pyg">Beneficio mes a mes</h2>
            <span className="hint">{keys.length ? `${keys.length} meses` : ''}</span>
          </div>
          {keys.length === 0 ? (
            <div className="empty invite">
              <b>Aún no hay meses</b>
              <span>Crea el primero y la app lo rellena con la previsión: cuotas, gastos fijos y alquiler si ya ha empezado. Luego solo marcas lo pagado.</span>
              <button className="btn primary" onClick={() => go('meses')}>Crear el primer mes</button>
            </div>
          ) : (
            <ProfitBars
              data={keys.map((k) => {
                const t = totalesMes(d.meses[k]);
                return {
                  key: k,
                  label: fmtMonthKey(k, true),
                  title: fmtMonthKey(k),
                  value: t.beneficio,
                  rows: [eurRow('Ingresos', t.ingresos), eurRow('Gastos', t.gastos), eurRow('Resultado', t.beneficio, true)],
                };
              })}
            />
          )}
        </section>
      </InView>

      <InView className={intro ? 'reveal' : 'settled'}>
        <section className="card" aria-labelledby="h-global">
          <div className="card-head">
            <h2 id="h-global">Seguimiento global</h2>
            <span className="hint">beneficio acumulado frente a lo invertido</span>
          </div>
          {reforma && (
            <p className="rent-warn" style={{ marginBottom: 14 }}>
              En reforma: la recuperación empezará a contar con el primer alquiler ({fmtDate(d.recurrentes.inicioAlquiler)}).
              Mientras tanto, lo que pagas cada mes se suma a lo invertido como coste de la espera.
            </p>
          )}
          <div className="stats" style={{ marginBottom: 18 }}>
            <div className="stat">
              <div className="k">Aportado</div>
              <div className="v">{eur0(bol.aportado)}</div>
              <div className="d">
                {bol.mesesNegativos ? `${eur0(bol.compra)} compra + ${eur0(bol.mesesNegativos)} meses en negativo` : 'de tu bolsillo'}
              </div>
            </div>
            <div className="stat">
              <div className="k">Ingresado</div>
              <div className="v">{eur0(seg.ingresado)}</div>
              <div className="d">meses de alquiler</div>
            </div>
            <div className="stat">
              <div className="k">Gastado</div>
              <div className="v">{eur0(seg.gastado)}</div>
              <div className="d">meses de alquiler</div>
            </div>
            <div className="stat">
              <div className="k">Capital devuelto</div>
              <div className="v pos">{eur0(capDevuelto)}</div>
              <div className="d">de los préstamos: es ahorro, no gasto</div>
            </div>
          </div>
          {keysAlquiler.length > 0 ? (
            <LineChart
              ariaLabel="Beneficio acumulado frente a lo invertido"
              color="var(--data)"
              data={seg.serie.map((p) => ({
                label: fmtMonthKey(p.key, true),
                title: fmtMonthKey(p.key),
                value: p.acumulado,
                rows: [eurRow('Mes', p.beneficio, true), eurRow('Acumulado', p.acumulado, true), eurRow('Invertido', seg.invertido)],
              }))}
              reference={{ value: seg.invertido, label: `Invertido · ${eur0(seg.invertido)}` }}
              projection={
                seg.proyeccionMeses && seg.proyeccionKey && seg.proyeccionMeses <= 360
                  ? { steps: seg.proyeccionMeses, value: seg.invertido, label: `Proyección · ${fmtMonthKey(seg.proyeccionKey, true)}` }
                  : undefined
              }
              legend={
                <>
                  <span><i className="line" style={{ background: 'var(--data)' }} />Beneficio acumulado</span>
                  <span><i className="dash" />Nivel invertido</span>
                  {seg.proyeccionKey && <span><i className="line" style={{ background: 'repeating-linear-gradient(90deg, var(--data) 0 2px, transparent 2px 6px)' }} />Proyección al ritmo medio</span>}
                </>
              }
            />
          ) : (
            <div className="empty invite">
              <b>La curva de recuperación empieza con el primer alquiler</b>
              <span>
                {d.recurrentes.inicioAlquiler
                  ? `Desde ${fmtDate(d.recurrentes.inicioAlquiler)} verás aquí el beneficio acumulado acercándose a lo invertido.`
                  : 'Pon la fecha prevista de inicio del alquiler para separar los meses de reforma de los de alquiler.'}
              </span>
              {!d.recurrentes.inicioAlquiler && <button className="btn" onClick={() => go('compra')}>Poner la fecha</button>}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
            «Invertido» es tu dinero propio (gastos de compra pagados menos lo pagado con los préstamos) más el
            coste de la espera: el saldo de los meses anteriores al inicio del alquiler. La proyección es lineal al
            beneficio medio de los meses de alquiler.
          </p>
        </section>
      </InView>

        </>
      )}

      <InView className={intro ? 'reveal' : 'settled'}>
        <PanelRentabilidad d={d} />
      </InView>
    </div>
  );
}
