import { useMemo, useState, type CSSProperties } from 'react';
import {
  aportacion, avisos, bolsilloReal, dineroPropio, fasesResultado, lineaTiempo, patrimonio, recuperacionPrevista, sinReforma, totalesGastos,
} from '../lib/derive';
import { daysBetween, fmtDate, fmtEur, fmtInt, fmtMonthKey, todayISO } from '../lib/format';
import { useData } from '../store';
import { engine } from '../sync/engine';
import { Segmented } from '../ui/fields';
import { AzaharMark, IconArrow } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { Counter, useChangeFlash, useCountUp } from '../ui/motion';
import { go } from '../router';
import type { Fase } from '../lib/derive';
import { useConReforma } from './useConReforma';

/** «dic 2026 – ene 2027» o «desde ago 2029» */
function periodoCorto(f: Fase): string {
  if (!f.desde) return '';
  const m = (k: string) => fmtMonthKey(k, true);
  if (!f.hasta) return `desde ${m(f.desde)}`;
  return f.desde === f.hasta ? m(f.desde) : `${m(f.desde)} – ${m(f.hasta)}`;
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
  const pct = g.total ? g.pagado / g.total : 0;
  const financiado = d.hipoteca.importe + d.familiar.importe;
  const recibido = g.pagado - dineroPropio(d).propio;
  const ap = useMemo(() => aportacion(d), [d]);
  const fases = useMemo(() => fasesResultado(d), [d]);
  const recPrev = useMemo(() => recuperacionPrevista(d), [d]);
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
      <section className={`kpis previo${intro ? ' intro' : ''}`} aria-label="Cifras principales">
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
          {(recPrev?.mes || ap.quedan > 0) && (
            <p className="hero-prev">
              {ap.quedan > 0 && <>Te quedan por poner <b className="num">{fmtEur(ap.quedan)}</b> hasta la escritura. </>}
              {recPrev?.mes && bol.falta > 0 && <>Previsión: lo recuperas todo en <b>{fmtMonthKey(recPrev.mes)}</b>.</>}
            </p>
          )}
        </article>

        <article className="kpi kpi-mes" aria-labelledby="h-mes">
          <div className="kpi-label" id="h-mes">Cada mes, de tu sueldo</div>
          {fases.length && fases.some((f) => f.desde) ? (
            <ul className="mes-list">
              {fases.map((f) => (
                <li key={f.key} className={`etapa-${f.id}`}>
                  <span className="mes-cuando">{periodoCorto(f)}</span>
                  <span className="mes-que">
                    {f.id === 'espera' ? 'Antes de alquilar (reforma)' : f.id === 'devolviendo' ? 'Alquilado, pagando a tus padres' : 'El piso se paga solo'}
                  </span>
                  <b className={`num ${f.resultado < 0 ? 'neg' : 'pos'}`}>
                    {f.resultado < 0 ? `−${fmtEur(-f.resultado)}` : `+${fmtEur(f.resultado)}`}/mes
                  </b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Pon la fecha de escritura y la de inicio del alquiler para ver cuánto pones cada mes.{' '}
              <a href="#/compra" onClick={(e) => (e.preventDefault(), go('compra'))}>Poner fechas</a>
            </p>
          )}
          {ap.sueldoTotal !== null && (
            <p className="mes-total">
              En total, <b className="num">{fmtEur(ap.sueldoTotal)}</b> de tu sueldo hasta que el piso se paga solo.{' '}
              <a href="#/analisis" onClick={(e) => (e.preventDefault(), go('analisis'))}>Ver el detalle</a>
            </p>
          )}
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
      </section>

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
    </div>
  );
}
