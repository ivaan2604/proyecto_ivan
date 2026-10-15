import type { Cuota } from './model';

/**
 * Cuota mensual con el sistema de amortización francés (PMT), en céntimos.
 *   cuota = P · r / (1 − (1 + r)^−n),  r = TIN/12,  n = meses
 */
export function pmt(principalCents: number, tinPct: number, years: number): number {
  return pmtMeses(principalCents, tinPct, Math.round(years * 12));
}

/** Igual que `pmt`, con el plazo en meses. */
export function pmtMeses(principalCents: number, tinPct: number, n: number): number {
  if (principalCents <= 0 || n <= 0) return 0;
  const r = tinPct / 100 / 12;
  if (r === 0) return Math.round(principalCents / n);
  return Math.round((principalCents * r) / (1 - Math.pow(1 + r, -n)));
}

export interface FilaCuota {
  n: number;
  id: string;
  fecha: string;
  cuota: number;
  interes: number;
  capital: number;
  anticipada: number;
  pendiente: number;
  /** Valores que se usarían si el campo estuviera en automático */
  cuotaAuto: number;
  interesAuto: number;
  /** El préstamo ya estaba liquidado antes de esta cuota: todo se muestra a 0 */
  liquidado: boolean;
}

export interface Calendario {
  filas: FilaCuota[];
  pendiente: number;
  totalIntereses: number;
  totalCapital: number;
  totalAnticipado: number;
  totalPagado: number;
}

/** Tramo inicial a otro tipo: sus cuotas usan `tinPct`/`cuota`; al acabar, la cuota se recalcula. */
export interface TramoInicial {
  meses: number;
  tinPct: number;
  cuota: number;
  /** Plazo total en meses, para recalcular la cuota del resto con lo que quede pendiente */
  plazoMeses: number;
}

/**
 * Recorre las cuotas registradas. La cuota pactada se mantiene fija; la amortización
 * anticipada resta directamente del capital pendiente (se acorta el plazo). Al llegar
 * el capital a 0, las cuotas siguientes quedan a 0.
 */
export function calendario(principal: number, tinPct: number, cuotaPactada: number, cuotas: Cuota[], tramo?: TramoInicial): Calendario {
  let pend = Math.max(0, principal);
  const filas: FilaCuota[] = [];
  let totalIntereses = 0;
  let totalCapital = 0;
  let totalAnticipado = 0;
  let totalPagado = 0;

  let cuotaB = cuotaPactada;
  cuotas.forEach((c, i) => {
    const enA = !!tramo && i < tramo.meses;
    // Al empezar el segundo tramo, la cuota se recalcula con lo que quede (refleja las amortizaciones)
    if (tramo && i === tramo.meses) cuotaB = pmtMeses(pend, tinPct, tramo.plazoMeses - tramo.meses);
    const r = (enA ? tramo!.tinPct : tinPct) / 100 / 12;
    const pactada = enA ? tramo!.cuota : cuotaB;
    if (pend <= 0) {
      filas.push({
        n: i + 1, id: c.id, fecha: c.fecha, cuota: 0, interes: 0, capital: 0, anticipada: 0,
        pendiente: 0, cuotaAuto: 0, interesAuto: 0, liquidado: true,
      });
      return;
    }
    const interesAuto = Math.round(pend * r);
    const interes = Math.max(0, c.interes ?? interesAuto);
    const cuotaAuto = Math.min(pactada, pend + interes);
    const cuota = Math.max(0, c.cuota ?? cuotaAuto);
    const capital = Math.min(Math.max(0, cuota - interes), pend);
    const trasCuota = pend - capital;
    const anticipada = Math.min(Math.max(0, c.anticipada), trasCuota);
    pend = trasCuota - anticipada;

    totalIntereses += interes;
    totalCapital += capital;
    totalAnticipado += anticipada;
    totalPagado += cuota + anticipada;
    filas.push({
      n: i + 1, id: c.id, fecha: c.fecha, cuota, interes, capital, anticipada, pendiente: pend,
      cuotaAuto, interesAuto, liquidado: false,
    });
  });

  return { filas, pendiente: pend, totalIntereses, totalCapital, totalAnticipado, totalPagado };
}

/** Meses que faltan para liquidar `pendiente` pagando `cuota` fija. null si nunca se liquida. */
export function mesesRestantes(pendiente: number, tinPct: number, cuota: number): number | null {
  if (pendiente <= 0) return 0;
  if (cuota <= 0) return null;
  const r = tinPct / 100 / 12;
  if (r === 0) return Math.ceil(pendiente / cuota);
  const x = 1 - (pendiente * r) / cuota;
  if (x <= 0) return null;
  // Tolerancia: el redondeo de la cuota a céntimos no debe sumar un mes extra por unos céntimos
  return Math.ceil(-Math.log(x) / Math.log(1 + r) - 0.02);
}

/** Capital pendiente tras pagar `k` cuotas fijas. */
export function saldoTras(principal: number, tinPct: number, cuota: number, k: number): number {
  const r = tinPct / 100 / 12;
  const s = r === 0 ? principal - cuota * k : principal * Math.pow(1 + r, k) - (cuota * (Math.pow(1 + r, k) - 1)) / r;
  return Math.max(0, Math.round(s));
}

/** Meses de `desde` a `hasta` (claves "YYYY-MM"). */
export function mesesEntre(desde: string, hasta: string): number {
  const [y1, m1] = desde.split('-').map(Number);
  const [y2, m2] = hasta.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Suma n meses a una clave "YYYY-MM" */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
