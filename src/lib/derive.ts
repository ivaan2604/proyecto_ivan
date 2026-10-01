import { addMonths, calendario, mesesRestantes, pmt, type Calendario } from './finance';
import { currentMonthKey, daysBetween, fmtEur, fmtMonthKey, todayISO } from './format';
import { BASE_KEYS, uid, type AppData, type BaseKey, type Estado, type Linea, type LoanKind, type Mes } from './model';

/* ───────────── Gastos de compra ───────────── */

export const BASE_LABELS: Record<BaseKey, string> = {
  senal: 'Señal',
  arras: 'Arras',
  restoPrecio: 'Resto del precio (en escritura)',
  itp: 'ITP',
  notaria: 'Notaría',
  registro: 'Registro',
  gestoria: 'Gestoría',
  tasacion: 'Tasación bancaria',
  comision: 'Comisión inmobiliaria',
  reforma: 'Reforma',
};

export interface FilaGasto {
  key: string;
  base: boolean;
  concepto: string;
  fecha: string;
  fechaDerivada: boolean;
  importe: number;
  estado: Estado;
  nota: string;
}

export function importeBase(d: AppData, k: BaseKey): number {
  switch (k) {
    case 'senal': return d.hitos.senal;
    case 'arras': return d.hitos.arras;
    case 'restoPrecio': return Math.max(0, d.piso.precio - d.hitos.senal - d.hitos.arras);
    case 'itp': return Math.round((d.piso.precio * d.piso.itpPct) / 100);
    case 'notaria': return d.gastos.notaria;
    case 'registro': return d.gastos.registro;
    case 'gestoria': return d.gastos.gestoria;
    case 'tasacion': return d.gastos.tasacion;
    case 'comision': return d.gastos.comision;
    case 'reforma': return d.gastos.reforma;
  }
}

function fechaDerivadaBase(d: AppData, k: BaseKey): string {
  switch (k) {
    case 'senal': return d.hitos.senalFecha;
    case 'arras': return d.hitos.arrasFecha;
    case 'tasacion': return d.gastos.tasacionFecha;
    case 'restoPrecio':
    case 'itp':
    case 'notaria':
    case 'registro':
    case 'gestoria':
      return d.hitos.escrituraFecha;
    default:
      return '';
  }
}

export function filasGastos(d: AppData): FilaGasto[] {
  const base = BASE_KEYS.map((k): FilaGasto => {
    const st = d.gastosBase[k];
    return {
      key: k,
      base: true,
      concepto: k === 'itp' ? `ITP (${d.piso.itpPct.toLocaleString('es-ES')} %)` : BASE_LABELS[k],
      fecha: st.fecha || fechaDerivadaBase(d, k),
      fechaDerivada: !st.fecha,
      importe: importeBase(d, k),
      estado: st.estado,
      nota: st.nota,
    };
  });
  const extra = d.gastosExtra.map((g): FilaGasto => ({
    key: g.id, base: false, concepto: g.concepto, fecha: g.fecha, fechaDerivada: false,
    importe: g.importe, estado: g.estado, nota: g.nota,
  }));
  return [...base, ...extra];
}

export function totalesGastos(d: AppData) {
  const filas = filasGastos(d);
  const total = filas.reduce((s, f) => s + f.importe, 0);
  const pagado = filas.filter((f) => f.estado === 'pagado').reduce((s, f) => s + f.importe, 0);
  return { filas, total, pagado, pendiente: total - pagado };
}

/* ───────────── Meses ───────────── */

export function sumLineas(l: Linea[]): number {
  return l.reduce((s, x) => s + x.importe, 0);
}

export function totalesMes(m: Mes) {
  const ingresos = sumLineas(m.ingresos);
  const gastos = sumLineas(m.gastos);
  return { ingresos, gastos, beneficio: ingresos - gastos };
}

export function mesesOrdenados(d: AppData): string[] {
  return Object.keys(d.meses).sort();
}

export function cuotaHipotecaPrevista(d: AppData): number {
  return pmt(d.hipoteca.importe, d.hipoteca.tinPct, d.hipoteca.plazoAnios);
}

/** Conceptos por defecto de un mes nuevo, calculados a partir de Compra y financiación. */
export function mesPrevision(d: AppData): Mes {
  const r = d.recurrentes;
  const l = (concepto: string, importe: number): Linea => ({ id: uid(), concepto, importe, estado: 'pendiente' });
  const ingresos: Linea[] = [];
  if (r.alquiler) ingresos.push(l('Alquiler', r.alquiler));
  const gastos: Linea[] = [];
  const hip = cuotaHipotecaPrevista(d);
  if (hip) gastos.push(l(`Cuota hipoteca${d.hipoteca.banco ? ` (${d.hipoteca.banco})` : ''}`, hip));
  if (d.familiar.cuota) gastos.push(l('Cuota préstamo familiar', d.familiar.cuota));
  if (r.edificioAnual) gastos.push(l('Cuota edificio (prorrateo)', Math.round(r.edificioAnual / 12)));
  if (r.ibiAnual) gastos.push(l('IBI (prorrateo)', Math.round(r.ibiAnual / 12)));
  if (r.seguroHogarAnual) gastos.push(l('Seguro de hogar (prorrateo)', Math.round(r.seguroHogarAnual / 12)));
  if (r.seguroVidaAnual) gastos.push(l('Seguro de vida (prorrateo)', Math.round(r.seguroVidaAnual / 12)));
  if (r.mantenimientoMensual) gastos.push(l('Mantenimiento', r.mantenimientoMensual));
  return { ingresos, gastos };
}

/** Copia los conceptos e importes de un mes; el estado vuelve a "Pendiente". */
export function duplicarMes(m: Mes): Mes {
  const c = (x: Linea): Linea => ({ ...x, id: uid(), estado: 'pendiente' });
  return { ingresos: m.ingresos.map(c), gastos: m.gastos.map(c) };
}

/* ───────────── Préstamos ───────────── */

export function cuotaPactada(d: AppData, kind: LoanKind): number {
  return kind === 'hipoteca' ? cuotaHipotecaPrevista(d) : d.familiar.cuota;
}

export function calendarioDe(d: AppData, kind: LoanKind): Calendario {
  const p = kind === 'hipoteca' ? d.hipoteca : d.familiar;
  return calendario(p.importe, p.tinPct, cuotaPactada(d, kind), d.cuotas[kind]);
}

/* ───────────── Recuperación de la inversión ───────────── */

export interface PuntoAcumulado {
  key: string;
  beneficio: number;
  acumulado: number;
}

export function seguimientoGlobal(d: AppData, invertido: number) {
  const keys = mesesOrdenados(d);
  let acc = 0;
  let ingresado = 0;
  let gastado = 0;
  let recuperadoEn: string | null = null;
  const serie: PuntoAcumulado[] = keys.map((key) => {
    const t = totalesMes(d.meses[key]);
    ingresado += t.ingresos;
    gastado += t.gastos;
    acc += t.beneficio;
    if (!recuperadoEn && invertido > 0 && acc >= invertido) recuperadoEn = key;
    return { key, beneficio: t.beneficio, acumulado: acc };
  });
  const media = keys.length ? acc / keys.length : 0;
  let proyeccionMeses: number | null = null;
  let proyeccionKey: string | null = null;
  if (!recuperadoEn && invertido > 0 && media > 0 && keys.length) {
    proyeccionMeses = Math.ceil((invertido - acc) / media);
    proyeccionKey = addMonths(keys[keys.length - 1], proyeccionMeses);
  }
  return {
    serie, ingresado, gastado, beneficio: acc, media, invertido,
    recuperadoEn: recuperadoEn as string | null, proyeccionMeses, proyeccionKey,
    pctRecuperado: invertido > 0 ? Math.max(0, Math.min(1, acc / invertido)) : 0,
  };
}

/* ───────────── Línea de tiempo ───────────── */

export interface Hito {
  id: string;
  titulo: string;
  fecha: string;
  importe?: number;
  detalle?: string;
  estado: 'hecho' | 'programado' | 'pendiente';
}

export function lineaTiempo(d: AppData): Hito[] {
  const hoy = todayISO();
  const raw: Omit<Hito, 'estado'>[] = [
    { id: 'senal', titulo: 'Señal', fecha: d.hitos.senalFecha, importe: d.hitos.senal || undefined },
    { id: 'contrato', titulo: 'Contrato de compraventa', fecha: d.hitos.contratoFecha },
    { id: 'arras', titulo: 'Arras', fecha: d.hitos.arrasFecha, importe: d.hitos.arras || undefined },
    { id: 'viabilidad', titulo: 'Viabilidad de la hipoteca', fecha: d.hipoteca.viabilidadFecha, detalle: d.hipoteca.banco || undefined },
    { id: 'tasacion', titulo: 'Tasación', fecha: d.gastos.tasacionFecha, importe: d.gastos.tasacion || undefined },
    { id: 'escritura', titulo: 'Escritura', fecha: d.hitos.escrituraFecha },
  ];
  return raw
    .map((h) => ({ ...h, estado: !h.fecha ? 'pendiente' : h.fecha <= hoy ? 'hecho' : 'programado' } as Hito))
    .sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha.localeCompare(b.fecha);
    });
}

/* ───────────── Avisos ───────────── */

export type Nivel = 'alerta' | 'aviso' | 'info';
export type SectionId = 'resumen' | 'compra' | 'gastos' | 'meses' | 'hipoteca' | 'familiar' | 'notas' | 'copia';

export interface Aviso {
  id: string;
  nivel: Nivel;
  titulo: string;
  detalle?: string;
  ir?: SectionId;
}

export const BACKUP_DIAS = 30;

export function avisos(d: AppData): Aviso[] {
  const hoy = todayISO();
  const out: Aviso[] = [];

  // Escritura
  if (!d.hitos.escrituraFecha) {
    out.push({ id: 'escritura', nivel: 'info', titulo: 'Fecha de escritura pendiente', detalle: 'Aún no hay fecha de firma ante notario.', ir: 'compra' });
  } else if (d.hitos.escrituraFecha > hoy) {
    const dias = daysBetween(hoy, d.hitos.escrituraFecha);
    out.push({ id: 'escritura', nivel: dias <= 14 ? 'aviso' : 'info', titulo: `Escritura en ${dias} ${dias === 1 ? 'día' : 'días'}`, ir: 'compra' });
  }

  // Gastos de compra pendientes
  const g = totalesGastos(d);
  const pendientes = g.filas.filter((f) => f.estado === 'pendiente' && f.importe > 0);
  const vencidos = pendientes.filter((f) => f.fecha && f.fecha < hoy);
  if (vencidos.length) {
    out.push({
      id: 'gastos-vencidos', nivel: 'alerta',
      titulo: `${vencidos.length} ${vencidos.length === 1 ? 'gasto de compra con fecha pasada' : 'gastos de compra con fecha pasada'} sin pagar`,
      detalle: vencidos.map((f) => f.concepto).join(', '), ir: 'gastos',
    });
  }
  if (pendientes.length) {
    out.push({
      id: 'gastos-pendientes', nivel: 'aviso',
      titulo: `${pendientes.length} gastos de compra pendientes · ${fmtEur(g.pendiente)}`,
      detalle: pendientes.slice(0, 5).map((f) => f.concepto).join(', ') + (pendientes.length > 5 ? '…' : ''), ir: 'gastos',
    });
  }

  // Cuotas sin fecha / desviadas
  (['hipoteca', 'familiar'] as const).forEach((kind) => {
    const nombre = kind === 'hipoteca' ? 'hipoteca' : 'préstamo familiar';
    const cal = calendarioDe(d, kind);
    const sinFecha = cal.filas.filter((f) => !f.fecha && !f.liquidado);
    if (sinFecha.length) {
      out.push({
        id: `sin-fecha-${kind}`, nivel: 'aviso',
        titulo: `${sinFecha.length} ${sinFecha.length === 1 ? 'cuota' : 'cuotas'} de ${nombre} sin fecha`,
        detalle: `Cuota nº ${sinFecha.map((f) => f.n).join(', ')}`, ir: kind,
      });
    }
    if (kind === 'hipoteca') {
      const desv = cal.filas.filter((f) => !f.liquidado && Math.abs(f.cuota - f.cuotaAuto) > 100);
      if (desv.length) {
        out.push({
          id: 'hipoteca-desviada', nivel: 'aviso',
          titulo: `${desv.length} ${desv.length === 1 ? 'cuota de hipoteca se desvía' : 'cuotas de hipoteca se desvían'} de la prevista`,
          detalle: desv.map((f) => `nº ${f.n}: ${fmtEur(f.cuota)} (prevista ${fmtEur(f.cuotaAuto)})`).join(' · '), ir: 'hipoteca',
        });
      }
    }
  });

  // Meses con conceptos sin pagar (hasta el mes actual)
  const actual = currentMonthKey();
  const mesesPend = mesesOrdenados(d)
    .filter((k) => k <= actual)
    .map((k) => ({ k, n: [...d.meses[k].ingresos, ...d.meses[k].gastos].filter((l) => l.estado === 'pendiente').length }))
    .filter((x) => x.n > 0);
  if (mesesPend.length) {
    out.push({
      id: 'meses-pendientes', nivel: 'aviso',
      titulo: `Conceptos sin marcar como pagados en ${mesesPend.length} ${mesesPend.length === 1 ? 'mes' : 'meses'}`,
      detalle: mesesPend.map((x) => `${fmtMonthKey(x.k)} (${x.n})`).join(', '), ir: 'meses',
    });
  }

  // Hipoteca sin escritura pero con viabilidad: recordatorio de condiciones
  if (d.hipoteca.notas && !d.hitos.escrituraFecha && d.hipoteca.importe) {
    out.push({ id: 'hipoteca-notas', nivel: 'info', titulo: `Hipoteca ${d.hipoteca.banco}: ${d.hipoteca.notas}`, ir: 'compra' });
  }

  // Copia de seguridad
  if (!d.meta.lastExportAt) {
    out.push({ id: 'backup', nivel: 'aviso', titulo: 'Nunca has exportado una copia de seguridad', ir: 'copia' });
  } else {
    const dias = daysBetween(d.meta.lastExportAt.slice(0, 10), hoy);
    if (dias >= BACKUP_DIAS) {
      out.push({ id: 'backup', nivel: 'aviso', titulo: `Hace ${dias} días de la última copia de seguridad`, ir: 'copia' });
    }
  }

  const peso: Record<Nivel, number> = { alerta: 0, aviso: 1, info: 2 };
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

/* ───────────── Coste total y rentabilidad ───────────── */

export interface CostePrestamo {
  nombre: string;
  importe: number;
  cuota: number;
  meses: number | null;
  /** Total pagado en toda la vida del préstamo sin amortizar antes (null si la cuota no lo liquida) */
  total: number | null;
  intereses: number | null;
}

/** Coste de un préstamo pagado entero sin amortizaciones anticipadas: cuota × nº de cuotas. */
function costePrestamo(nombre: string, importe: number, cuota: number, meses: number | null): CostePrestamo {
  if (importe <= 0) return { nombre, importe, cuota, meses: 0, total: 0, intereses: 0 };
  if (meses === null || cuota <= 0) return { nombre, importe, cuota, meses: null, total: null, intereses: null };
  const total = cuota * meses;
  return { nombre, importe, cuota, meses, total, intereses: Math.max(0, total - importe) };
}

export function costesPrestamos(d: AppData): CostePrestamo[] {
  const hip = costePrestamo('Hipoteca', d.hipoteca.importe, cuotaHipotecaPrevista(d), Math.round(d.hipoteca.plazoAnios * 12));
  // El préstamo familiar no tiene plazo: sin interés no genera coste; con interés, el plazo
  // es el que tarda la cuota pactada en liquidarlo.
  const f = d.familiar;
  const nombre = 'Préstamo familiar';
  if (f.tinPct <= 0 || f.importe <= 0) return [hip, { nombre, importe: f.importe, cuota: f.cuota, meses: null, total: f.importe, intereses: 0 }];
  const meses = mesesRestantes(f.importe, f.tinPct, f.cuota);
  if (meses === null) return [hip, costePrestamo(nombre, f.importe, f.cuota, null)];
  // La última cuota es menor: se suman los intereses mes a mes en lugar de cuota × meses
  const r = f.tinPct / 100 / 12;
  let pend = f.importe;
  let intereses = 0;
  for (let i = 0; i < meses && pend > 0; i++) {
    const int = Math.round(pend * r);
    intereses += int;
    pend -= Math.min(pend, f.cuota - int);
  }
  return [hip, { nombre, importe: f.importe, cuota: f.cuota, meses, total: f.importe + intereses, intereses }];
}

export interface Rentabilidad {
  /* A) Coste total a largo plazo */
  gastosCompra: number;
  prestamos: CostePrestamo[];
  intereses: number;
  /** Algún préstamo con interés cuya cuota nunca lo liquida: la cifra de intereses no es completa */
  interesesIncompletos: boolean;
  costeTotal: number;
  /* B) Rentabilidad del activo (teórica) */
  inversionActivo: number;
  alquilerAnual: number;
  gastosRecurrentesAnuales: number;
  brutaPct: number | null;
  netaPct: number | null;
  /* C) Rentabilidad sobre el dinero propio (real) */
  capitalPropio: number;
  mesesConDatos: number;
  /** Beneficio de los últimos 12 meses, o promedio mensual × 12 si hay menos de 12 */
  beneficioAnual: number | null;
  proyectado: boolean;
  cashOnCashPct: number | null;
}

/**
 * Coste total estimado y rentabilidad. Ojo: en esta app el «total de gastos de compra»
 * YA incluye el precio del piso (señal + arras + resto del precio), así que la inversión
 * del activo es ese total, sin volver a sumar el precio.
 */
export function rentabilidad(d: AppData): Rentabilidad {
  const g = totalesGastos(d);
  const prestamos = costesPrestamos(d);
  const intereses = prestamos.reduce((s, p) => s + (p.intereses ?? 0), 0);
  const interesesIncompletos = prestamos.some((p) => p.intereses === null);

  const r = d.recurrentes;
  const alquilerAnual = r.alquiler * 12;
  const gastosRecurrentesAnuales = r.ibiAnual + r.seguroHogarAnual + r.seguroVidaAnual + r.edificioAnual + r.mantenimientoMensual * 12;
  const inversionActivo = g.total;
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

  // Meses reales: hasta el mes en curso y con algún concepto (los meses futuros creados por adelantado no cuentan)
  const actual = currentMonthKey();
  const reales = mesesOrdenados(d).filter((k) => k <= actual && (d.meses[k].ingresos.length || d.meses[k].gastos.length));
  const ultimos = reales.slice(-12);
  const suma = ultimos.reduce((s, k) => s + totalesMes(d.meses[k]).beneficio, 0);
  const proyectado = reales.length > 0 && reales.length < 12;
  const beneficioAnual = reales.length === 0 ? null : proyectado ? Math.round((suma / reales.length) * 12) : suma;

  return {
    gastosCompra: g.total,
    prestamos,
    intereses,
    interesesIncompletos,
    costeTotal: g.total + intereses,
    inversionActivo,
    alquilerAnual,
    gastosRecurrentesAnuales,
    brutaPct: pct(alquilerAnual, inversionActivo),
    netaPct: pct(alquilerAnual - gastosRecurrentesAnuales, inversionActivo),
    capitalPropio: g.pagado,
    mesesConDatos: reales.length,
    beneficioAnual,
    proyectado,
    cashOnCashPct: beneficioAnual === null ? null : pct(beneficioAnual, g.pagado),
  };
}
