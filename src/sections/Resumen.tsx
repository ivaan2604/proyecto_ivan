import { useMemo, useState, type CSSProperties } from 'react';
import { eurRow, LineChart, ProfitBars } from '../charts/charts';
import {
  aportacion, avisos, bolsilloReal, patrimonio, capitalDevuelto, enReforma, lineaTiempo, recuperacionPrevista, rentabilidad, seguimientoGlobal,
  sinReforma, totalesGastos, totalesMes,
} from '../lib/derive';
import { daysBetween, fmtDate, fmtEur, fmtInt, fmtMonthKey, todayISO } from '../lib/format';
import { useData } from '../store';
import { engine } from '../sync/engine';
import { Segmented } from '../ui/fields';
import { AzaharMark, IconArrow, IconTrendDown, IconTrendUp } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { Counter, InView, useChangeFlash, useCountUp } from '../ui/motion';
import { go } from '../router';
import { PanelRentabilidad } from './Rentabilidad';
import { PanelFases } from './Fases';

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

/** Preferencia de este dispositivo: ver el Resumen con o sin la reforma. */
function useConReforma(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem('resumen-reforma') === 'con';
    } catch {
      return false;
    }
  });
  return [
    v,
    (x: boolean) => {
      setV(x);
      try {
        localStorage.setItem('resumen-reforma', x ? 'con' : 'sin');
      } catch {
        /* sin almacenamiento: solo para esta visita */
      }
    },
  ];
}

/** La entrada completa (barras que se llenan, flor, mini gráfica) solo la primera vez por sesión. */
let primeraVisita = true;

export function Resumen() {
  const real = useData();
  const [conReforma, setConReforma] = useConReforma();
  const hayReforma = real.gastos.reforma > 0 || real.reforma.partidas.length > 0;
  const d = useMemo(() => (conReforma || !hayReforma ? real : sinReforma(real)), [real, conReforma, hayReforma]);
  const [intro] = useState(() => {
    const v = primeraVisita;
    primeraVisita = false;
    return v;
  });
  const g = useMemo(() => totalesGastos(d), [d]);
  const av = useMemo(() => avisos(d), [d]);
  const hitos = useMemo(() => lineaTiempo(d), [d]);
  const seg = useMemo(() => seguimientoGlobal(d), [d]);
  const r = useMemo(() => rentabilidad(d), [d]);
  const reforma = enReforma(d);
  // Gráfica mes a mes: todos los meses; recuperación: solo los de alquiler (seg.serie)
  const keys = Object.keys(d.meses).sort();
  const keysAlquiler = seg.serie.map((p) => p.key);
  // Hasta el primer mes de alquiler, los bloques de beneficio, rentabilidad y recuperación estarían vacíos
  const alquilando = keysAlquiler.length > 0;
  const pct = g.total ? g.pagado / g.total : 0;
  const financiado = d.hipoteca.importe + d.familiar.importe;
  const recibido = g.pagado - seg.propio;
  const falta = Math.max(0, seg.invertido - seg.beneficio);
  const ap = useMemo(() => aportacion(d), [d]);
  const recPrev = useMemo(() => recuperacionPrevista(d), [d]);
  const capDevuelto = useMemo(() => capitalDevuelto(d), [d]);
  const bol = useMemo(() => bolsilloReal(d), [d]);
  const pat = useMemo(() => patrimonio(d), [d]);
  const fein = d.hipoteca.fein;
  const diasFein = fein.validaHasta ? daysBetween(todayISO(), fein.validaHasta) : null;

  // Cifra principal: cuenta hasta el valor y se parte en euros y céntimos
  const propioAnim = Math.round(useCountUp(bol.aportado, 1100, 'propio'));
  const euros = Math.trunc(propioAnim / 100);
  const cents = String(Math.abs(propioAnim % 100)).padStart(2, '0');
  const flashPropio = useChangeFlash(bol.aportado, 'propio');
  const pctDevuelto = bol.aportado ? Math.min(1, bol.devuelto / bol.aportado) : 0;
  const flashBeneficio = useChangeFlash(seg.beneficio, 'beneficio');
  const flashRecup = useChangeFlash(seg.pctRecuperado, 'recup');

  const recupPrevTexto =
    !keysAlquiler.length && recPrev?.mes && recPrev.mesesDesdeAlquiler
      ? `Previsión: recuperas lo invertido en ≈ ${(recPrev.mesesDesdeAlquiler / 12).toLocaleString('es-ES', { maximumFractionDigits: 1 })} años de alquiler · ${fmtMonthKey(recPrev.mes)}`
      : null;
  const recupTexto = recupPrevTexto ?? (seg.recuperadoEn
    ? `Recuperado en ${fmtMonthKey(seg.recuperadoEn)}`
    : seg.proyeccionKey
      ? `Al ritmo actual, en ≈ ${seg.proyeccionMeses} meses · ${fmtMonthKey(seg.proyeccionKey)}`
      : seg.invertido > 0
        ? keysAlquiler.length
          ? 'Sin beneficio medio positivo todavía'
          : reforma
            ? `En reforma: empieza a contar con el primer alquiler (${fmtDate(d.recurrentes.inicioAlquiler)})`
            : 'Empezará a contar con el primer mes de alquiler'
        : 'Aún no hay nada aportado');

  return (
    <div className="page resumen">
      <PageHead
        folio="01"
        title="Resumen"
        subtitle={d.piso.tipoVivienda || 'Seguimiento de la compra y el alquiler'}
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

      {/* ───── Cifras protagonistas ───── */}
      <section className={`kpis${intro ? ' intro' : ''}${alquilando ? '' : ' previo'}`} aria-label="Cifras principales">
        <article className={`kpi kpi-hero${flashPropio ? ` flash-${flashPropio}` : ''}`} aria-labelledby="h-aportado">
          <AzaharMark className="hero-blossom" size={260} />
          <div className="kpi-label" id="h-aportado">Aportado de tu bolsillo</div>
          <div className="hero-figure" aria-label={fmtEur(bol.aportado)}>
            <span aria-hidden>
              {fmtInt(euros)}
              <span className="cents">,{cents} €</span>
            </span>
          </div>
          <div className="hero-sub">
            {bol.mesesNegativos > 0
              ? `Compra ${fmtEur(bol.compra)} + meses en negativo ${fmtEur(bol.mesesNegativos)}`
              : recibido > 0
                ? `Pagado ${fmtEur(g.pagado)} − ${fmtEur(recibido)} con dinero prestado`
                : 'Lo pagado de la compra con tu dinero. Cada mes en negativo se sumará aquí.'}
          </div>
          <div className="meter tejas" role="progressbar" aria-label="Recuperado" aria-valuenow={Math.round(pctDevuelto * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ '--p': pctDevuelto } as CSSProperties} />
          </div>
          <div className="meter-legend">
            <span>Te ha devuelto el piso {fmtEur(bol.devuelto)}</span>
            <span className="num">{bol.ganancia > 0 ? `ya ganas ${fmtEur(bol.ganancia)}` : `te falta ${fmtEur(bol.falta)}`}</span>
          </div>
          <dl className="hero-foot">
            <div>
              <dt>Compra pagada</dt>
              <dd className="num">{Math.round(pct * 100)} %</dd>
            </div>
            <div>
              <dt>Pendiente</dt>
              <dd className="num">{fmtEur(g.pendiente)}</dd>
            </div>
            {financiado > 0 && (
              <div>
                <dt>Financiación</dt>
                <dd className="num">{fmtEur(financiado)}</dd>
              </div>
            )}
          </dl>
        </article>

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

        <article className="kpi kpi-pones" aria-labelledby="h-pones">
          <div className="pones-entrada">
            <div className="kpi-label" id="h-pones">Lo que pones tú · al principio</div>
            <div className="pones-figure">
              <Counter id="pones-quedan" value={ap.quedan} format={(v) => fmtEur(v)} />
            </div>
            <div className="kpi-sub">
              {ap.quedan > 0 ? 'te quedan por poner hasta la escritura' : 'entrada completa'} · de {fmtEur(ap.entrada)} de entrada, ya
              has pagado {fmtEur(ap.pagado)}
            </div>
            <div className="meter pones-meter" role="progressbar" aria-label="Entrada pagada" aria-valuenow={Math.round((ap.entrada ? ap.pagado / ap.entrada : 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ '--p': ap.entrada ? ap.pagado / ap.entrada : 0 } as CSSProperties} />
            </div>
            <small className="pones-calc">
              Compra {fmtEur(ap.total, { compact: true })} − préstamos {fmtEur(ap.prestamos, { compact: true })}
              {d.hipoteca.provisional && <span className="chip provisional mini">hipoteca provisional</span>}
            </small>
          </div>
          <div className="pones-sueldo">
            <div className="kpi-label">Después, de tu sueldo</div>
            <ul>
              {ap.etapas.map((e, i) => (
                <li key={e.key} className={`etapa-${e.id}`}>
                  <span className="pones-etapa">Etapa {i + 1}</span>
                  <span className="pones-que">
                    {e.id === 'espera' ? 'Antes de alquilar' : e.id === 'devolviendo' ? 'Alquilado, devolviendo a tus padres' : 'El piso se paga solo'}
                    {e.subtitulo && <small className="pones-sub">{e.subtitulo}</small>}
                  </span>
                  <b className={`num ${e.resultado < 0 ? 'neg' : 'pos'}`}>
                    {e.resultado < 0 ? `${fmtEur(-e.resultado)}/mes` : `+${fmtEur(e.resultado)}/mes`}
                  </b>
                  <small>{e.id === 'libre' ? 'te deja' : e.meses !== null ? `${e.meses} ${e.meses === 1 ? 'mes' : 'meses'}` : 'sin fechas'}</small>
                </li>
              ))}
            </ul>
            {ap.sueldoTotal !== null ? (
              <p className="pones-total">
                En total, <b className="num">{fmtEur(ap.sueldoTotal)}</b> de tu sueldo hasta que el piso se paga solo.
                {recPrev && (
                  <>
                    {' '}De tu bolsillo, con la entrada: <b className="num">{fmtEur(ap.entrada + ap.sueldoTotal)}</b>
                    {recPrev.mes && (
                      <>
                        {' '}· lo recuperas todo en <b>{fmtMonthKey(recPrev.mes)}</b>
                      </>
                    )}
                    .
                  </>
                )}
              </p>
            ) : (
              <p className="pones-total muted">
                Pon la fecha de escritura y la de inicio del alquiler para ver cuántos meses dura cada etapa y el total.{' '}
                <a href="#/compra" onClick={(e) => (e.preventDefault(), go('compra'))}>Poner fechas</a>
              </p>
            )}
          </div>
        </article>

        <article className="kpi kpi-patrimonio" aria-labelledby="h-patrimonio">
          <div className="kpi-label" id="h-patrimonio">Tu patrimonio en el piso</div>
          <div className="kpi-sub">
            Lo que vale ({fmtEur(pat.valor, { compact: true })}{pat.estimado ? ', precio de compra' : ''}) menos lo que aún debes. Cada cuota lo
            hace crecer: es dinero que pasa a ser tuyo. Sin contar que el piso suba de valor.
          </div>
          {pat.actual !== null && (
            <div className="pones-figure">
              <Counter id="patrimonio" value={pat.actual} format={(v) => fmtEur(v)} />
              <small> hoy</small>
            </div>
          )}
          <ul className="patrimonio-list">
            {pat.puntos.map((p) => (
              <li key={p.titulo}>
                <span>
                  {p.titulo}
                  {p.mes && <small>{fmtMonthKey(p.mes)}</small>}
                </span>
                <span className="patrimonio-bar" aria-hidden>
                  <i style={{ width: `${Math.max(0, Math.min(100, (p.neto / pat.valor) * 100))}%` }} />
                </span>
                <b className="num">{fmtEur(p.neto, { compact: true })}</b>
              </li>
            ))}
          </ul>
        </article>

        {fein.validaHasta && diasFein !== null && (
          <article className={`kpi kpi-fein${diasFein <= 7 ? ' urgente' : ''}`} aria-label="Oferta de la FEIN">
            <div className="kpi-label">Oferta FEIN · {d.hipoteca.banco || 'hipoteca'}</div>
            <div className="fein-figure">
              {diasFein >= 0 ? (
                <>
                  <b>{diasFein}</b> {diasFein === 1 ? 'día' : 'días'} para que caduque
                </>
              ) : (
                <b>Caducada</b>
              )}
            </div>
            <div className="kpi-sub">
              Válida hasta {fmtDate(fein.validaHasta)}
              {fein.taePct !== null && ` · TAE ${fein.taePct.toLocaleString('es-ES')} %`}
            </div>
          </article>
        )}

        {alquilando && (
        <article className={`kpi kpi-recovery${flashRecup ? ` flash-${flashRecup}` : ''}`} aria-labelledby="h-recup">
          <div className="recovery-head">
            <div>
              <div className="kpi-label" id="h-recup">Recuperación de la inversión</div>
              <div className="recovery-figure">
                <Counter id="recup" value={Math.round(seg.pctRecuperado * 1000)} format={(v) => `${Math.round(v / 10)} %`} />
              </div>
            </div>
            <p className="recovery-text">{recupTexto}</p>
          </div>
          <div
            className="meter recovery-meter"
            role="progressbar"
            aria-label="Inversión recuperada"
            aria-valuenow={Math.round(seg.pctRecuperado * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ '--p': seg.pctRecuperado } as CSSProperties} />
            <i style={{ left: '25%' }} />
            <i style={{ left: '50%' }} />
            <i style={{ left: '75%' }} />
          </div>
          <dl className="recovery-foot">
            <div>
              <dt>Invertido</dt>
              <dd className="num">{fmtEur(seg.invertido)}</dd>
              {seg.costeEspera !== 0 && (
                <small>
                  {eur0(seg.propio)} propio + {eur0(seg.costeEspera)} espera
                </small>
              )}
            </div>
            <div>
              <dt>Recuperado</dt>
              <dd className={`num ${seg.beneficio > 0 ? 'pos' : seg.beneficio < 0 ? 'neg' : ''}`}>{fmtEur(seg.beneficio, { sign: true })}</dd>
            </div>
            <div>
              <dt>Falta</dt>
              <dd className="num">{fmtEur(falta)}</dd>
            </div>
          </dl>
        </article>
        )}
        {!alquilando && recupPrevTexto && <p className="kpi kpi-luego muted">{recupPrevTexto}</p>}
      </section>

      <div className="resumen-fases">
        <PanelFases d={d} />
      </div>

      {/* ───── Avisos y proceso ───── */}
      <div className="grid g-2 duo">
        <section className="card" aria-labelledby="h-avisos">
          <div className="card-head">
            <h2 id="h-avisos">Avisos</h2>
            <span className="hint">{av.length ? `${av.length} activos` : 'Todo en orden'}</span>
          </div>
          {av.length === 0 ? (
            <div className="empty">Nada pendiente. Buen trabajo.</div>
          ) : (
            <ul className="alerts">
              {av.map((a, i) => (
                <li key={a.id} className={`alert ${a.nivel}`} style={{ '--i': i } as CSSProperties}>
                  <span className="ico" aria-hidden>{a.nivel === 'info' ? 'i' : '!'}</span>
                  <div>
                    <div className="t">{a.titulo}</div>
                    {a.detalle && <div className="d">{a.detalle}</div>}
                  </div>
                  {a.ir && (
                    <button className="icon-btn no-print" aria-label="Ir" onClick={() => go(a.ir!)}>
                      <IconArrow />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="h-proceso">
          <div className="card-head">
            <h2 id="h-proceso">Proceso de compra</h2>
            <span className="hint">
              {hitos.filter((h) => h.estado === 'hecho').length} de {hitos.length} hitos
            </span>
          </div>
          <ol className="timeline">
            {hitos.map((h) => (
              <li key={h.id} className={h.estado}>
                <span className="dot" aria-hidden />
                <div>
                  <div className="tt">{h.titulo}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {[h.importe ? fmtEur(h.importe) : null, h.detalle].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="when">
                  {h.fecha ? fmtDate(h.fecha) : <span className="chip ochre">Pendiente</span>}
                  {h.estado === 'programado' && (
                    <div>
                      <span className="chip cobalt">Programado</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
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
              <div className="k">Invertido</div>
              <div className="v">{eur0(seg.invertido)}</div>
              <div className="d">
                {seg.costeEspera ? `${eur0(seg.propio)} propio + ${eur0(seg.costeEspera)} espera` : 'dinero propio'}
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

      <InView className={intro ? 'reveal' : 'settled'}>
        <PanelRentabilidad d={d} />
      </InView>
        </>
      )}
    </div>
  );
}
