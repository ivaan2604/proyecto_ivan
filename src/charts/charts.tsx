import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { fmtEur } from '../lib/format';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Escala "bonita" para el eje Y */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    max = min + 1;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function compactEur(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k`;
  return v.toLocaleString('es-ES', { maximumFractionDigits: 0 });
}

export interface TooltipRow {
  label: string;
  value: string;
}

function Tooltip({ x, y, title, rows }: { x: number; y: number; title: string; rows: TooltipRow[] }) {
  return (
    <div className="tooltip" style={{ left: x, top: y }}>
      <div className="tt-title">{title}</div>
      {rows.map((r) => (
        <div className="tt-row" key={r.label}>
          <span>{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Barras de beneficio / pérdida ───────────── */

export interface BarDatum {
  key: string;
  label: string;
  title: string;
  value: number;
  rows: TooltipRow[];
}

export function ProfitBars({ data, height = 220 }: { data: BarDatum[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const vals = data.map((d) => d.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const ih = height - pad.t - pad.b;
  const iw = width - pad.l - pad.r;
  const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const band = iw / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(40, band * 0.62));
  const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 46)));
  const y0 = y(0);

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label="Beneficio o pérdida por mes">
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'zero-line' : 'grid-line'} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {compactEur(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const top = y(Math.max(0, d.value));
          const h = Math.max(1, Math.abs(y(d.value) - y0));
          const r = Math.min(4, bw / 2, h);
          const pos = d.value >= 0;
          // Barra con el extremo de datos redondeado y la base recta sobre el eje
          const x0 = cx - bw / 2;
          const path = pos
            ? `M${x0},${y0} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${y0} Z`
            : `M${x0},${y0} V${y0 + h - r} Q${x0},${y0 + h} ${x0 + r},${y0 + h} H${x0 + bw - r} Q${x0 + bw},${y0 + h} ${x0 + bw},${y0 + h - r} V${y0} Z`;
          return (
            <g key={d.key}>
              <path d={path} fill={pos ? 'var(--pos)' : 'var(--neg)'} opacity={hover === null || hover === i ? 1 : 0.45} />
              {i % every === 0 && (
                <text className="axis-label" x={cx} y={height - 8} textAnchor="middle">
                  {d.label}
                </text>
              )}
              <rect
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip
          x={Math.min(Math.max(pad.l + band * hover + band / 2, 80), width - 80)}
          y={y(Math.max(0, data[hover].value))}
          title={data[hover].title}
          rows={data[hover].rows}
        />
      )}
      <div className="legend">
        <span><i style={{ background: 'var(--pos)' }} />Beneficio</span>
        <span><i style={{ background: 'var(--neg)' }} />Pérdida</span>
      </div>
    </div>
  );
}

/* ───────────── Línea (acumulado, capital pendiente) ───────────── */

export interface LinePoint {
  label: string;
  title: string;
  value: number;
  rows: TooltipRow[];
}

export function LineChart({
  data, height = 240, reference, projection, color = 'var(--chart-blue)', area = true, ariaLabel, legend,
}: {
  data: LinePoint[];
  height?: number;
  reference?: { value: number; label: string };
  /** Tramo proyectado desde el último punto (n pasos después) hasta `value` */
  projection?: { steps: number; value: number; label: string };
  color?: string;
  area?: boolean;
  ariaLabel: string;
  legend?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pad = { l: 48, r: 14, t: 16, b: 26 };
  const steps = data.length - 1 + (projection?.steps ?? 0);
  const vals = [...data.map((d) => d.value), reference?.value ?? 0, projection?.value ?? 0, 0];
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const ih = height - pad.t - pad.b;
  const iw = width - pad.l - pad.r;
  const x = (i: number) => pad.l + (steps <= 0 ? iw / 2 : (i / steps) * iw);
  const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const areaPath = pts.length ? `${line} L${pts[pts.length - 1][0]},${y(Math.max(lo, 0))} L${pts[0][0]},${y(Math.max(lo, 0))} Z` : '';
  // Etiquetas del eje X separadas al menos 56 px (también cuando hay tramo proyectado)
  const stepPx = steps > 0 ? iw / steps : iw;
  const labelEvery = Math.max(1, Math.ceil(56 / stepPx));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    const i = Math.round(rel * steps);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'zero-line' : 'grid-line'} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {compactEur(t)}
            </text>
          </g>
        ))}
        {reference && reference.value > 0 && (
          <g>
            <line className="ref-line" x1={pad.l} x2={width - pad.r} y1={y(reference.value)} y2={y(reference.value)} />
            <text className="ref-label" x={pad.l + 4} y={y(reference.value) - 6} textAnchor="start">
              {reference.label}
            </text>
          </g>
        )}
        {area && pts.length > 1 && <path d={areaPath} fill={`url(#${gid})`} />}
        {pts.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />}
        {projection && pts.length > 0 && (
          <g>
            <path
              d={`M${pts[pts.length - 1][0]},${pts[pts.length - 1][1]} L${x(steps)},${y(projection.value)}`}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="2 5"
              strokeLinecap="round"
            />
            <circle cx={x(steps)} cy={y(projection.value)} r={5} fill="var(--surface)" stroke={color} strokeWidth={2} />
            <text className="axis-label" x={x(steps) - 8} y={y(projection.value) + 24} textAnchor="end">
              {projection.label}
            </text>
          </g>
        )}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={i} className="axis-label" x={x(i)} y={height - 8} textAnchor={i === 0 && steps > 0 ? 'start' : 'middle'}>
              {d.label}
            </text>
          ) : null,
        )}
        {pts.length === 1 && <circle cx={pts[0][0]} cy={pts[0][1]} r={4} fill={color} />}
        {hover !== null && pts[hover] && (
          <g>
            <line className="crosshair" x1={pts[hover][0]} x2={pts[hover][0]} y1={pad.t} y2={pad.t + ih} />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={pad.l}
          y={pad.t}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
        />
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip
          x={Math.min(Math.max(pts[hover][0], 80), width - 80)}
          y={pts[hover][1]}
          title={data[hover].title}
          rows={data[hover].rows}
        />
      )}
      {legend && <div className="legend">{legend}</div>}
    </div>
  );
}

export const eurRow = (label: string, cents: number, sign = false): TooltipRow => ({
  label,
  value: fmtEur(cents, { sign }),
});
