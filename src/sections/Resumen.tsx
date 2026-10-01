import { useMemo } from 'react';
import { eurRow, LineChart, ProfitBars } from '../charts/charts';
import { avisos, enReforma, lineaTiempo, seguimientoGlobal, totalesGastos, totalesMes } from '../lib/derive';
import { fmtDate, fmtEur, fmtInt, fmtMonthKey } from '../lib/format';
import { useData } from '../store';
import { IconArrow } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { go } from '../router';
import { PanelRentabilidad } from './Rentabilidad';

export function Resumen() {
  const d = useData();
  const g = useMemo(() => totalesGastos(d), [d]);
  const av = useMemo(() => avisos(d), [d]);
  const hitos = useMemo(() => lineaTiempo(d), [d]);
  const seg = useMemo(() => seguimientoGlobal(d), [d]);
  const reforma = enReforma(d);
  // Gráfica mes a mes: todos los meses; recuperación: solo los de alquiler (seg.serie)
  const keys = Object.keys(d.meses).sort();
  const keysAlquiler = seg.serie.map((p) => p.key);
  const pct = g.total ? g.pagado / g.total : 0;
  const euros = Math.trunc(seg.propio / 100);
  const cents = String(Math.abs(seg.propio % 100)).padStart(2, '0');
  const financiado = d.hipoteca.importe + d.familiar.importe;
  const recibido = g.pagado - seg.propio;

  return (
    <div className="page">
      <PageHead folio="01" title="Resumen" subtitle={d.piso.tipoVivienda || 'Seguimiento de la compra y el alquiler'} />

      <div className="grid g-hero stagger">
        <section className="card hero" aria-labelledby="h-aportado">
          <div className="label" id="h-aportado">Aportado de tu bolsillo</div>
          <div className="big">
            {fmtInt(euros)}
            <span className="cents">,{cents} €</span>
          </div>
          <div className="sub">
            {recibido > 0
              ? `Pagado ${fmtEur(g.pagado)} − ${fmtEur(recibido)} con dinero prestado`
              : 'Gastos de compra pagados (aún no has marcado ningún préstamo como recibido)'}
          </div>
          <div className="tilebar" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="tilebar-legend">
            <span>Pagado el {Math.round(pct * 100)} % de la compra</span>
            <span className="num">{fmtEur(g.total)}</span>
          </div>
          <div className="hero-foot">
            <div>
              <span>Pendiente</span>
              <b>{fmtEur(g.pendiente)}</b>
            </div>
            <div>
              <span>Precio</span>
              <b>{fmtEur(d.piso.precio)}</b>
            </div>
            {financiado > 0 && (
              <div>
                <span>Financiación</span>
                <b>{fmtEur(financiado)}</b>
              </div>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="h-avisos">
          <div className="card-head">
            <h2 id="h-avisos">Avisos</h2>
            <span className="hint">{av.length ? `${av.length} activos` : 'Todo en orden'}</span>
          </div>
          {av.length === 0 ? (
            <div className="empty">Nada pendiente. Buen trabajo.</div>
          ) : (
            <ul className="alerts">
              {av.map((a) => (
                <li key={a.id} className={`alert ${a.nivel}`}>
                  <span className="ico" aria-hidden>{a.nivel === 'info' ? 'i' : '!'}</span>
                  <div>
                    <div className="t">{a.titulo}</div>
                    {a.detalle && <div className="d">{a.detalle}</div>}
                  </div>
                  {a.ir && (
                    <button className="icon-btn no-print" style={{ color: 'inherit' }} aria-label="Ir" onClick={() => go(a.ir!)}>
                      <IconArrow />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid g-2 stagger" style={{ marginTop: 18 }}>
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

        <section className="card" aria-labelledby="h-pyg">
          <div className="card-head">
            <h2 id="h-pyg">Beneficio mes a mes</h2>
            <span className="hint">{keys.length ? `${keys.length} meses` : ''}</span>
          </div>
          {keys.length === 0 ? (
            <div className="empty">
              Aún no has creado ningún mes.{' '}
              <a href="#/meses" onClick={(e) => (e.preventDefault(), go('meses'))}>
                Crear el primero
              </a>
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
      </div>

      <section className="card" style={{ marginTop: 18 }} aria-labelledby="h-global">
        <div className="card-head">
          <h2 id="h-global">Seguimiento global y recuperación de la inversión</h2>
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
            <div className="v">{fmtEur(seg.invertido, { compact: true })}</div>
            <div className="d">
              {seg.costeEspera
                ? `${fmtEur(seg.propio, { compact: true })} propio + ${fmtEur(seg.costeEspera, { compact: true })} espera`
                : 'dinero propio'}
            </div>
          </div>
          <div className="stat">
            <div className="k">Ingresado</div>
            <div className="v">{fmtEur(seg.ingresado, { compact: true })}</div>
            <div className="d">meses de alquiler</div>
          </div>
          <div className="stat">
            <div className="k">Gastado</div>
            <div className="v">{fmtEur(seg.gastado, { compact: true })}</div>
            <div className="d">meses de alquiler</div>
          </div>
          <div className="stat">
            <div className="k">Beneficio acumulado</div>
            <div className={`v ${seg.beneficio > 0 ? 'pos' : seg.beneficio < 0 ? 'neg' : ''}`}>{fmtEur(seg.beneficio, { compact: true, sign: true })}</div>
            <div className="d">media {fmtEur(Math.round(seg.media))}/mes</div>
          </div>
          <div className="stat">
            <div className="k">Recuperación</div>
            <div className="v">{Math.round(seg.pctRecuperado * 100)} %</div>
            <div className="d">
              {seg.recuperadoEn
                ? `Recuperado en ${fmtMonthKey(seg.recuperadoEn)}`
                : seg.proyeccionKey
                  ? `≈ ${seg.proyeccionMeses} meses más · ${fmtMonthKey(seg.proyeccionKey)}`
                  : seg.invertido > 0
                    ? keysAlquiler.length
                      ? 'Sin beneficio medio positivo aún'
                      : reforma
                        ? 'En reforma'
                        : 'Sin meses de alquiler'
                    : 'Aún no hay nada aportado'}
            </div>
          </div>
        </div>
        {keysAlquiler.length > 0 ? (
          <LineChart
            ariaLabel="Beneficio acumulado frente a lo invertido"
            data={seg.serie.map((p) => ({
              label: fmtMonthKey(p.key, true),
              title: fmtMonthKey(p.key),
              value: p.acumulado,
              rows: [eurRow('Mes', p.beneficio, true), eurRow('Acumulado', p.acumulado, true), eurRow('Invertido', seg.invertido)],
            }))}
            reference={{ value: seg.invertido, label: `Invertido · ${fmtEur(seg.invertido, { compact: true })}` }}
            projection={
              seg.proyeccionMeses && seg.proyeccionKey && seg.proyeccionMeses <= 360
                ? { steps: seg.proyeccionMeses, value: seg.invertido, label: `Proyección · ${fmtMonthKey(seg.proyeccionKey, true)}` }
                : undefined
            }
            legend={
              <>
                <span><i className="line" style={{ background: 'var(--chart-blue)' }} />Beneficio acumulado</span>
                <span><i className="dash" />Nivel invertido (aportado)</span>
                {seg.proyeccionKey && <span><i className="line" style={{ background: 'repeating-linear-gradient(90deg, var(--chart-blue) 0 2px, transparent 2px 6px)' }} />Proyección al ritmo medio</span>}
              </>
            }
          />
        ) : (
          <div className="empty">La gráfica aparecerá cuando registres meses de alquiler{reforma ? ', después de la reforma' : ''}.</div>
        )}
        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
          «Invertido» es tu dinero propio (gastos de compra pagados menos lo pagado con los préstamos) más el
          coste de la espera: el saldo de los meses anteriores al inicio del alquiler. La proyección es lineal al
          beneficio medio de los meses de alquiler.
        </p>
      </section>

      <PanelRentabilidad d={d} />
    </div>
  );
}
