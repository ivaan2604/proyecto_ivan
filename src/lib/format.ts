/** Utilidades de formato (es-ES). Los importes llegan en céntimos. */

const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // En es-ES los números de 4 cifras no se agrupan por defecto; para importes se lee mejor 7.772 €
  useGrouping: 'always',
} as Intl.NumberFormatOptions);
const eur0 = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  useGrouping: 'always',
} as Intl.NumberFormatOptions);
const num2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtEur(cents: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  const v = cents / 100;
  const s = opts.compact ? eur0.format(v) : eur.format(v);
  return opts.sign && cents > 0 ? `+${s}` : s;
}

/** Céntimos → texto editable "1234,56" */
export function centsToInput(cents: number): string {
  if (!cents) return '';
  return num2.format(cents / 100).replace(/\./g, '');
}

/**
 * Texto introducido por el usuario → céntimos. Acepta "1.234,56", "1234.56", "1234,5", "72".
 * Devuelve null si no es un número.
 */
export function parseMoney(raw: string): number | null {
  let s = raw.trim().replace(/[€\s]/g, '');
  if (s === '') return 0;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // El último separador es el decimal
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1) {
    // Formato español: "1.234" o "1.234.567" son miles; "12.5" o "272.25" es decimal.
    const parts = s.split('.');
    if (parts.length > 2 || parts[1].length === 3) s = s.replace(/\./g, '');
  }
  if (!/^\d*(\.\d*)?$/.test(s) || s === '.') return null;
  const v = Math.round(parseFloat(s || '0') * 100);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

export function parsePct(raw: string): number | null {
  const s = raw.trim().replace('%', '').replace(',', '.');
  if (s === '') return 0;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

const int = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions);
export function fmtInt(n: number): string {
  return int.format(n);
}

export function fmtPct(v: number): string {
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: 3 })} %`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function monthName(m: number): string {
  return MESES[m - 1];
}

export function fmtMonthKey(key: string, short = false): string {
  const [y, m] = key.split('-').map(Number);
  return short ? `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}` : `${MESES[m - 1]} ${y}`;
}

export function fmtDate(iso: string, opts: { long?: boolean } = {}): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  if (opts.long) return `${d} de ${MESES[m - 1]} de ${y}`;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function daysBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 86_400_000);
}
