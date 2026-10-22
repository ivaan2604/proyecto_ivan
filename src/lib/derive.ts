import { addMonths, calendario, mesesEntre, mesesRestantes, pmtMeses, saldoTras, type Calendario } from './finance';
import { currentMonthKey, daysBetween, fmtEur, fmtMonthKey, todayISO } from './format';
import { BASE_KEYS, uid, type AppData, type BaseKey, type Estado, type Linea, type LoanKind, type Mes, type Seguro } from './model';

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
  /** Fila generada desde la sección «Reforma» (se edita allí) */
  reforma?: true;
}

export function importeBase(d: AppData, k: BaseKey): number {
  // Con la liquidación final de la gestoría, manda esa cifra sobre la provisional
  return d.gastosBase[k].liquidacion ?? importeBaseSinLiquidar(d, k);
}

/** Importe previsto (provisión) de un gasto base, sin tener en cuenta la liquidación final. */
export function importeBaseSinLiquidar(d: AppData, k: BaseKey): number {
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
  const conPartidas = d.reforma.partidas.length > 0;
  const base = BASE_KEYS.filter((k) => !(conPartidas && k === 'reforma')).map((k): FilaGasto => {
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
  return [...base, ...filasReforma(d), ...extra];
}

/* ───────────── Reforma ───────────── */

/** Cada pago es una fila; lo que queda de presupuesto sin pagos asignados, una fila pendiente sin fecha. */
function filasReforma(d: AppData): FilaGasto[] {
  return d.reforma.partidas.flatMap((p) => {
    const nombre = `Reforma · ${p.concepto || 'Partida'}`;
    const filas = p.pagos.map((x): FilaGasto => ({
      key: `ref:${x.id}`, base: false, reforma: true, concepto: nombre, fecha: x.fecha, fechaDerivada: false,
      importe: x.importe, estado: x.estado, nota: [x.factura && `Factura ${x.factura}`, x.nota].filter(Boolean).join(' · '),
    }));
    const resto = p.presupuesto - sumPagos(p.pagos);
    if (resto > 0) {
      filas.push({
        key: `ref-resto:${p.id}`, base: false, reforma: true, concepto: `${nombre} (resto del presupuesto)`, fecha: '',
        fechaDerivada: false, importe: resto, estado: 'pendiente', nota: '',
      });
    }
    return filas;
  });
}

function sumPagos(pagos: { importe: number }[]): number {
  return pagos.reduce((s, x) => s + x.importe, 0);
}

export interface TotalesPartida {
  id: string;
  presupuesto: number;
  /** Suma de todos los pagos apuntados (pagados o no) */
  comprometido: number;
  pagado: number;
  /** Coste previsto: el presupuesto, o lo comprometido si ya lo supera */
  previsto: number;
  desviacion: number;
}

export function totalesReforma(d: AppData) {
  const partidas = d.reforma.partidas.map((p): TotalesPartida => {
    const comprometido = sumPagos(p.pagos);
    const pagado = sumPagos(p.pagos.filter((x) => x.estado === 'pagado'));
    return {
      id: p.id, presupuesto: p.presupuesto, comprometido, pagado,
      previsto: Math.max(p.presupuesto, comprometido), desviacion: Math.max(0, comprometido - p.presupuesto),
    };
  });
  const sum = (k: keyof Omit<TotalesPartida, 'id'>) => partidas.reduce((s, x) => s + x[k], 0);
  const presupuesto = sum('presupuesto');
  const previsto = sum('previsto');
  const pagado = sum('pagado');
  const desviacion = sum('desviacion');
  const mejora = d.reforma.partidas.reduce((s, p, i) => s + (p.tipo === 'mejora' ? partidas[i].previsto : 0), 0);
  return {
    partidas, presupuesto, previsto, pagado, pendiente: previsto - pagado, desviacion,
    desviacionPct: presupuesto > 0 ? (desviacion / presupuesto) * 100 : 0,
    mejora, reparacion: previsto - mejora,
  };
}

/* ───────────── Dinero propio y fase ───────────── */

/** Dinero de los préstamos que ya has recibido (con él se paga parte de los gastos de compra). */
export function financiacionRecibida(d: AppData): number {
  return (d.hipoteca.recibida ? d.hipoteca.importe : 0) + (d.familiar.recibido ? d.familiar.importe : 0);
}

/** Lo que ha salido de tu bolsillo: gastos de compra pagados menos lo pagado con dinero prestado. */
export function dineroPropio(d: AppData) {
  const g = totalesGastos(d);
  const financiado = Math.min(financiacionRecibida(d), g.pagado);
  return { pagado: g.pagado, financiado, propio: g.pagado - financiado, sinGastar: financiacionRecibida(d) - financiado };
}

/** Mes (YYYY-MM) del primer alquiler, o null si no hay fecha. */
export function inicioAlquilerMes(d: AppData): string | null {
  return d.recurrentes.inicioAlquiler ? d.recurrentes.inicioAlquiler.slice(0, 7) : null;
}

/** Hay fecha de alquiler y aún no ha llegado. */
export function enReforma(d: AppData): boolean {
  const ini = inicioAlquilerMes(d);
  return !!ini && ini > currentMonthKey();
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

/* ───────────── Hipoteca: tramos y rebajas ───────────── */

/** Seguros elegidos (los que cuentan en los gastos fijos y en las rebajas). */
export function segurosElegidos(d: AppData): Seguro[] {
  return d.seguros.filter((x) => x.elegido);
}

/** Rebaja del interés: nómina (+ Bizum) y seguros elegidos que la den, con el máximo de la FEIN. */
export function bonificacionHipoteca(d: AppData, seguros: Seguro[] = segurosElegidos(d), nominaBizum = d.hipoteca.nominaBizum) {
  const h = d.hipoteca;
  const nomina = nominaBizum ? h.bonifNominaPct : 0;
  const deSeguros = seguros.reduce((a, x) => a + x.bonifPct, 0);
  const bruto = nomina + deSeguros;
  const total = h.bonifMaxPct > 0 ? Math.min(h.bonifMaxPct, bruto) : bruto;
  return { nomina, seguros: deSeguros, total: Math.round(total * 1000) / 1000 };
}

export interface TramosHipoteca {
  /** Plazo total en meses */
  n: number;
  mesesA: number;
  tinA: number;
  cuotaA: number;
  /** TIN del tramo principal ya con la rebaja */
  tinB: number;
  cuotaB: number;
  bonif: number;
}

/**
 * Cuotas de la hipoteca por tramos. Sin tramo inicial, una sola cuota al TIN rebajado. Con tramo
 * inicial (p. ej. 6 meses al 3,29 %), su cuota se calcula a todo el plazo y, al acabar, la del resto
 * se recalcula con lo que queda pendiente, como hace el banco.
 */
export function tramosHipoteca(d: AppData, bonif = bonificacionHipoteca(d).total): TramosHipoteca {
  const h = d.hipoteca;
  const n = Math.round(h.plazoAnios * 12);
  const mesesA = Math.max(0, Math.min(n, Math.round(h.tramoAMeses)));
  const tinB = Math.max(0, h.tinPct - bonif);
  if (mesesA === 0) {
    const c = pmtMeses(h.importe, tinB, n);
    return { n, mesesA, tinA: tinB, cuotaA: c, tinB, cuotaB: c, bonif };
  }
  const cuotaA = pmtMeses(h.importe, h.tramoATinPct, n);
  const saldo = saldoTras(h.importe, h.tramoATinPct, cuotaA, mesesA);
  return { n, mesesA, tinA: h.tramoATinPct, cuotaA, tinB, cuotaB: pmtMeses(saldo, tinB, n - mesesA), bonif };
}

/** Cuota principal de la hipoteca (la del tramo largo). */
export function cuotaHipotecaPrevista(d: AppData): number {
  return tramosHipoteca(d).cuotaB;
}

/** Cuota de la hipoteca prevista en un mes concreto (0 antes de empezar o tras la última). */
export function cuotaHipotecaMes(d: AppData, key: string): number {
  const ini = inicioHipotecaMes(d);
  if (!ini || key < ini) return 0;
  const t = tramosHipoteca(d);
  const i = mesesEntre(ini, key);
  if (i >= t.n) return 0;
  return i < t.mesesA ? t.cuotaA : t.cuotaB;
}

/** Tramo de la hipoteca en un mes: 'A' (inicial) o 'B'; null sin tramos o fuera del plazo. */
function tramoMes(d: AppData, key: string): 'A' | 'B' | null {
  const ini = inicioHipotecaMes(d);
  const t = tramosHipoteca(d);
  if (!ini || key < ini || t.mesesA === 0) return null;
  return mesesEntre(ini, key) < t.mesesA ? 'A' : 'B';
}

/** Cuota al préstamo familiar prevista en un mes: la pactada y, la última, solo lo que quede. */
export function cuotaFamiliarMes(d: AppData, key: string): number {
  const f = d.familiar;
  const ini = inicioFamiliarMes(d);
  const fin = finPrestamoFamiliar(d);
  if (f.importe <= 0 || f.cuota <= 0 || !ini || key < ini || (fin && key > fin)) return 0;
  if (!fin || key !== fin) return f.cuota;
  const k = mesesEntre(ini, key);
  const pend = saldoTras(f.importe, f.tinPct, f.cuota, k);
  const resto = pend + Math.round(pend * (f.tinPct / 100 / 12));
  return Math.min(f.cuota, resto > 0 ? resto : f.cuota);
}

/** Seguros elegidos prorrateados al año (céntimos). */
export function segurosAnuales(d: AppData): number {
  return segurosElegidos(d).reduce((a, x) => a + x.primaAnual, 0) + d.recurrentes.seguroHogarAnual + d.recurrentes.seguroVidaAnual;
}

/** Conceptos por defecto de un mes nuevo, calculados a partir de Compra y financiación. */
/** El mes es anterior a la escritura (o aún no hay fecha): el piso todavía no es tuyo. */
export function mesSinPiso(d: AppData, key: string): boolean {
  const esc = d.hitos.escrituraFecha ? d.hitos.escrituraFecha.slice(0, 7) : null;
  return !esc || key < esc;
}

export function mesPrevision(d: AppData, key?: string): Mes {
  const r = d.recurrentes;
  const l = (concepto: string, importe: number): Linea => ({ id: uid(), concepto, importe, estado: 'pendiente' });
  const ingresos: Linea[] = [];
  // Antes de la escritura el piso aún no es tuyo: no hay gastos fijos, cuotas ni alquiler que proponer
  if (key && mesSinPiso(d, key)) return { ingresos, gastos: [] };
  // Sin fecha de alquiler, o antes de ella (reforma), el mes nuevo no lleva la línea de alquiler
  const ini = inicioAlquilerMes(d);
  const sinAlquiler = !!key && (!ini || key < ini);
  if (r.alquiler && !sinAlquiler) ingresos.push(l('Alquiler', r.alquiler));
  const gastos: Linea[] = [];
  const hip = key ? cuotaHipotecaMes(d, key) : tramosHipoteca(d).cuotaA;
  // Las cuotas solo se proponen en los meses en que tocan: la hipoteca desde el mes siguiente a la
  // escritura y el préstamo familiar desde su primera cuota hasta la última.
  const iniHip = inicioHipotecaMes(d);
  const iniFam = inicioFamiliarMes(d);
  const finFam = finPrestamoFamiliar(d);
  const tocaHip = !key || (!!iniHip && key >= iniHip);
  const tocaFam = !key || (!!iniFam && key >= iniFam && (!finFam || key <= finFam));
  if (hip && (key || tocaHip)) gastos.push({ ...l(`Cuota hipoteca${d.hipoteca.banco ? ` (${d.hipoteca.banco})` : ''}`, hip), vinculo: 'hipoteca' });
  const fam = key ? cuotaFamiliarMes(d, key) : d.familiar.cuota;
  if (fam && d.familiar.importe && tocaFam) gastos.push({ ...l('Cuota préstamo familiar', fam), vinculo: 'familiar' });
  if (r.edificioAnual) gastos.push(l('Cuota edificio (prorrateo)', Math.round(r.edificioAnual / 12)));
  if (r.ibiAnual) gastos.push(l('IBI (prorrateo)', Math.round(r.ibiAnual / 12)));
  if (r.seguroHogarAnual) gastos.push(l('Seguro de hogar (prorrateo)', Math.round(r.seguroHogarAnual / 12)));
  if (r.seguroVidaAnual) gastos.push(l('Seguro de vida (prorrateo)', Math.round(r.seguroVidaAnual / 12)));
  for (const x of segurosElegidos(d)) if (x.primaAnual) gastos.push(l(`${x.nombre || 'Seguro'} (prorrateo)`, Math.round(x.primaAnual / 12)));
  // Los prorrateos se redondean por separado: el último absorbe la diferencia para que sumen lo mismo que el total
  const prorrateos = gastos.filter((g) => g.concepto.endsWith('(prorrateo)'));
  if (prorrateos.length) {
    const total = Math.round((r.edificioAnual + r.ibiAnual + segurosAnuales(d)) / 12);
    prorrateos[prorrateos.length - 1].importe += total - prorrateos.reduce((a, g) => a + g.importe, 0);
  }
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
  if (kind === 'hipoteca') {
    const t = tramosHipoteca(d);
    const tramo = t.mesesA > 0 ? { meses: t.mesesA, tinPct: t.tinA, cuota: t.cuotaA, plazoMeses: t.n } : undefined;
    return calendario(d.hipoteca.importe, t.tinB, t.cuotaB, d.cuotas.hipoteca, tramo);
  }
  return calendario(d.familiar.importe, d.familiar.tinPct, d.familiar.cuota, d.cuotas.familiar);
}

/* ───────────── Recuperación de la inversión ───────────── */

export interface PuntoAcumulado {
  key: string;
  beneficio: number;
  acumulado: number;
}

/**
 * Recuperación de la inversión. Los meses anteriores al inicio del alquiler (reforma) no
 * cuentan como resultado del alquiler: su saldo negativo es «coste de la espera» y se suma
 * a lo invertido. Sin fecha de inicio, todos los meses cuentan como alquiler.
 */
export function seguimientoGlobal(d: AppData) {
  const { propio } = dineroPropio(d);
  const ini = inicioAlquilerMes(d);
  const todos = mesesOrdenados(d);
  const espera = ini ? todos.filter((k) => k < ini) : [];
  const keys = ini ? todos.filter((k) => k >= ini) : todos;
  const costeEspera = -espera.reduce((s, k) => s + totalesMes(d.meses[k]).beneficio, 0);
  const invertido = propio + costeEspera;

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
    serie, ingresado, gastado, beneficio: acc, media, invertido, propio, costeEspera, mesesEspera: espera.length,
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
    { id: 'fein', titulo: 'FEIN firmada', fecha: d.hipoteca.fein.firmadaFecha, detalle: d.hipoteca.fein.validaHasta ? `válida hasta ${fmtDia(d.hipoteca.fein.validaHasta)}` : undefined },
    { id: 'acta', titulo: 'Acta de transparencia', fecha: d.hitos.actaFecha, detalle: 'Firma previa de la hipoteca ante el notario' },
    { id: 'escritura', titulo: 'Escritura', fecha: d.hitos.escrituraFecha },
    { id: 'alquiler', titulo: 'Inicio del alquiler', fecha: d.recurrentes.inicioAlquiler, importe: d.recurrentes.alquiler || undefined },
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
export type SectionId = 'resumen' | 'compra' | 'gastos' | 'reforma' | 'meses' | 'hipoteca' | 'familiar' | 'irpf' | 'notas' | 'copia';

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

  // El acta de transparencia tiene que firmarse como tarde el día antes de la escritura
  if (d.hitos.actaFecha && d.hitos.escrituraFecha && d.hitos.actaFecha >= d.hitos.escrituraFecha) {
    out.push({ id: 'acta', nivel: 'alerta', titulo: 'El acta tiene que ser antes de la escritura', detalle: 'El acta de transparencia de la hipoteca se firma como tarde el día anterior a la escritura.', ir: 'compra' });
  } else if (d.hitos.actaFecha && d.hitos.actaFecha > hoy) {
    const dias = daysBetween(hoy, d.hitos.actaFecha);
    out.push({ id: 'acta-proxima', nivel: dias <= 7 ? 'aviso' : 'info', titulo: `Acta de transparencia en ${dias} ${dias === 1 ? 'día' : 'días'}`, detalle: `El ${fmtDia(d.hitos.actaFecha)} ante el notario. Lleva el DNI.`, ir: 'compra' });
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

  // Reforma por encima del presupuesto
  const ref = totalesReforma(d);
  if (ref.desviacion > 0) {
    out.push({
      id: 'reforma-desviacion', nivel: 'aviso',
      titulo: `Reforma ${fmtEur(ref.desviacion)} por encima del presupuesto (+${Math.round(ref.desviacionPct)} %)`,
      detalle: d.reforma.partidas.filter((_, i) => ref.partidas[i].desviacion > 0).map((p) => p.concepto).join(', '),
      ir: 'reforma',
    });
  }
  if (!d.recurrentes.inicioAlquiler && d.hitos.escrituraFecha && d.hitos.escrituraFecha <= hoy) {
    out.push({ id: 'inicio-alquiler', nivel: 'info', titulo: 'Indica la fecha prevista de inicio del alquiler', detalle: 'Separa los meses de reforma de los de alquiler en la rentabilidad.', ir: 'compra' });
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

  // FEIN pendiente: condiciones de la hipoteca provisionales
  if (d.hipoteca.importe && d.hipoteca.provisional && !d.hipoteca.fein.fechaEmision) {
    out.push({
      id: 'fein', nivel: 'aviso', titulo: 'FEIN pendiente',
      detalle: d.hipoteca.notas || 'Las condiciones de la hipoteca son provisionales hasta recibir la FEIN.', ir: 'compra',
    });
  }
  // Plazos de la FEIN: 10 días de reflexión desde que se entrega y fecha de caducidad de la oferta
  const fein = d.hipoteca.fein;
  if (fein.fechaEmision && d.hitos.escrituraFecha) {
    const desde = addDays(fein.fechaEmision, 10);
    if (d.hitos.escrituraFecha < desde) {
      out.push({ id: 'fein-reflexion', nivel: 'aviso', titulo: `La firma no puede ser antes del ${fmtDia(desde)}`, detalle: 'Hay 10 días de reflexión desde la entrega de la FEIN.', ir: 'compra' });
    }
  }
  if (fein.validaHasta && d.hitos.escrituraFecha && d.hitos.escrituraFecha > fein.validaHasta) {
    out.push({
      id: 'fein-caduca', nivel: 'alerta', titulo: `La FEIN caduca el ${fmtDia(fein.validaHasta)}, antes de la firma prevista`,
      detalle: 'Firma antes de esa fecha o pide al banco que la renueve (las condiciones pueden cambiar).', ir: 'compra',
    });
  }

  // Reforma como un único importe
  if (d.reforma.partidas.length === 0 && d.gastos.reforma > 0) {
    out.push({
      id: 'reforma-sin-desglosar', nivel: 'info', titulo: 'Reforma sin desglosar',
      detalle: `${fmtEur(d.gastos.reforma)} como un único importe. Desglósala en partidas para seguir pagos y desviaciones.`, ir: 'reforma',
    });
  }

  // Hipoteca sin escritura pero con viabilidad: recordatorio de condiciones (si no va ya en el aviso de la FEIN)
  if (d.hipoteca.notas && !d.hitos.escrituraFecha && d.hipoteca.importe && !d.hipoteca.provisional) {
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

function addDays(iso: string, n: number): string {
  const t = new Date(`${iso}T12:00:00`);
  t.setDate(t.getDate() + n);
  return t.toISOString().slice(0, 10);
}
const fmtDia = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

/* ───────────── Coste total y rentabilidad ───────────── */

export interface CostePrestamo {
  nombre: string;
  importe: number;
  cuota: number;
  /* Sin amortizar nada antes (peor caso). null = la cuota no llega a liquidarlo */
  meses: number | null;
  total: number | null;
  intereses: number | null;
  /* Con las amortizaciones anticipadas registradas */
  anticipado: number;
  interesesPagados: number;
  /** Intereses ya pagados + los que faltan sobre el capital pendiente actual */
  interesesConAmort: number | null;
  /** Comisión por amortización anticipada pagada sobre lo amortizado (0 si la comisión es 0 %) */
  comisionAmort: number;
  mesesConAmort: number | null;
  ahorro: number | null;
  mesesAhorro: number | null;
}

/** Intereses y nº de cuotas que faltan para liquidar `pend` pagando `cuota` fija. */
function simular(pend: number, tinPct: number, cuota: number): { intereses: number; meses: number } | null {
  const meses = mesesRestantes(pend, tinPct, cuota);
  if (meses === null) return null;
  const r = tinPct / 100 / 12;
  let intereses = 0;
  for (let i = 0; i < meses && pend > 0; i++) {
    const int = Math.round(pend * r);
    intereses += int;
    pend -= Math.min(pend, cuota - int);
  }
  return { intereses, meses };
}

function costePrestamo(d: AppData, kind: LoanKind): CostePrestamo {
  const p = kind === 'hipoteca' ? d.hipoteca : d.familiar;
  const nombre = kind === 'hipoteca' ? 'Hipoteca' : 'Préstamo familiar';
  const cuota = cuotaPactada(d, kind);
  const cal = calendarioDe(d, kind);
  const comisionPct = kind === 'hipoteca' ? d.hipoteca.fein.comisionAmortPct : 0;
  const comisionAmort = Math.round((cal.totalAnticipado * comisionPct) / 100);
  const base = { nombre, importe: p.importe, cuota, anticipado: cal.totalAnticipado, interesesPagados: cal.totalIntereses, comisionAmort };

  // Peor caso. Hipoteca: cuota × plazo − importe. Familiar (sin plazo): lo que tarda la cuota en liquidarlo.
  let meses: number | null;
  let intereses: number | null;
  if (p.importe <= 0) {
    meses = 0;
    intereses = 0;
  } else if (kind === 'hipoteca') {
    const t = tramosHipoteca(d);
    meses = cuota > 0 ? t.n : null;
    intereses = meses === null ? null : Math.max(0, t.cuotaA * t.mesesA + t.cuotaB * (t.n - t.mesesA) - p.importe);
  } else {
    const sim = simular(p.importe, p.tinPct, cuota);
    meses = sim?.meses ?? null;
    intereses = p.tinPct <= 0 ? 0 : sim?.intereses ?? null;
  }
  const total = intereses === null ? null : p.importe + intereses;

  if (cal.totalAnticipado <= 0) {
    return { ...base, meses, total, intereses, interesesConAmort: intereses, mesesConAmort: meses, ahorro: intereses === null ? null : 0, mesesAhorro: meses === null ? null : 0 };
  }
  // Con amortizaciones: lo ya pagado + lo que queda desde el capital pendiente actual, misma cuota (se acorta el plazo)
  const tin = kind === 'hipoteca' ? tramosHipoteca(d).tinB : p.tinPct;
  const fut = simular(cal.pendiente, tin, cuota);
  const pagadas = cal.filas.filter((f) => !f.liquidado).length;
  const interesesConAmort = fut === null ? null : cal.totalIntereses + fut.intereses;
  const mesesConAmort = fut === null ? null : pagadas + fut.meses;
  return {
    ...base, meses, total, intereses, interesesConAmort, mesesConAmort,
    // El ahorro descuenta la comisión de amortización anticipada (con 0 % no resta nada)
    ahorro: intereses === null || interesesConAmort === null ? null : intereses - interesesConAmort - comisionAmort,
    mesesAhorro: meses === null || mesesConAmort === null ? null : meses - mesesConAmort,
  };
}

export function costesPrestamos(d: AppData): CostePrestamo[] {
  return [costePrestamo(d, 'hipoteca'), costePrestamo(d, 'familiar')];
}

export interface Rentabilidad {
  /* A) Coste total a largo plazo */
  gastosCompra: number;
  prestamos: CostePrestamo[];
  intereses: number;
  /** Algún préstamo con interés cuya cuota nunca lo liquida: la cifra de intereses no es completa */
  interesesIncompletos: boolean;
  costeTotal: number;
  hayAmortizaciones: boolean;
  interesesConAmort: number;
  costeTotalConAmort: number;
  comisionesAmort: number;
  ahorro: number;
  /* B) Rentabilidad del activo (teórica) */
  inversionActivo: number;
  alquilerAnual: number;
  gastosRecurrentesAnuales: number;
  brutaPct: number | null;
  netaPct: number | null;
  /* C) Rentabilidad sobre el dinero propio (real) */
  /** Dinero propio + coste de la espera (lo que has puesto en total) */
  capitalPropio: number;
  dineroPropio: number;
  costeEspera: number;
  enReforma: boolean;
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
  const interesesIncompletos = prestamos.some((p) => p.intereses === null || p.interesesConAmort === null);
  const interesesConAmort = prestamos.reduce((s, p) => s + (p.interesesConAmort ?? 0), 0);
  const comisionesAmort = prestamos.reduce((s, p) => s + p.comisionAmort, 0);

  const r = d.recurrentes;
  const alquilerAnual = r.alquiler * 12;
  const gastosRecurrentesAnuales = r.ibiAnual + segurosAnuales(d) + r.edificioAnual + r.mantenimientoMensual * 12;
  const inversionActivo = g.total;
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);

  // Meses reales de alquiler: desde el inicio del alquiler, hasta el mes en curso y con algún concepto
  // (los meses de reforma y los futuros creados por adelantado no cuentan)
  const actual = currentMonthKey();
  const ini = inicioAlquilerMes(d);
  const seg = seguimientoGlobal(d);
  const reales = mesesOrdenados(d).filter(
    (k) => k <= actual && (!ini || k >= ini) && (d.meses[k].ingresos.length || d.meses[k].gastos.length),
  );
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
    hayAmortizaciones: prestamos.some((p) => p.anticipado > 0),
    interesesConAmort,
    costeTotalConAmort: g.total + interesesConAmort + comisionesAmort,
    comisionesAmort,
    ahorro: intereses - interesesConAmort - comisionesAmort,
    inversionActivo,
    alquilerAnual,
    gastosRecurrentesAnuales,
    brutaPct: pct(alquilerAnual, inversionActivo),
    netaPct: pct(alquilerAnual - gastosRecurrentesAnuales, inversionActivo),
    capitalPropio: seg.invertido,
    dineroPropio: seg.propio,
    costeEspera: seg.costeEspera,
    enReforma: enReforma(d),
    mesesConDatos: reales.length,
    beneficioAnual,
    proyectado,
    cashOnCashPct: beneficioAnual === null ? null : pct(beneficioAnual, seg.invertido),
  };
}

/* ───────────── Resultado mensual por fases ───────────── */

export interface Fase {
  id: 'espera' | 'devolviendo' | 'libre';
  /** Único: una etapa puede partirse en varios tramos de hipoteca */
  key: string;
  titulo: string;
  /** Tramo de la hipoteca, si la hipoteca tiene tramos */
  subtitulo: string | null;
  /** Meses que dura (null = sin fechas o indefinida) */
  meses: number | null;
  /** Resultado mensual previsto (céntimos): ingresos − cuotas − fijos */
  resultado: number;
  /** Parte de capital de las cuotas (deuda que dejas de deber: ahorro, no gasto) */
  capital: number;
  /** resultado + capital: lo que de verdad ganas o pierdes al mes */
  economico: number;
  /** Mes (YYYY-MM) en que empieza / acaba la fase; null = sin fecha todavía */
  desde: string | null;
  hasta: string | null;
  lineas: { concepto: string; importe: number }[];
}

/** Gastos fijos del piso prorrateados al mes (IBI, edificio, seguros) + mantenimiento. */
export function fijosMensuales(d: AppData): number {
  const r = d.recurrentes;
  return Math.round((r.edificioAnual + r.ibiAnual + segurosAnuales(d)) / 12) + r.mantenimientoMensual;
}

/** Mes de la primera cuota de la hipoteca: el siguiente a la escritura. null = sin escritura. */
export function inicioHipotecaMes(d: AppData): string | null {
  return d.hitos.escrituraFecha ? addMonths(d.hitos.escrituraFecha.slice(0, 7), 1) : null;
}

/** Mes de la primera cuota al préstamo familiar: la fecha indicada o, si no, el siguiente a la escritura. */
export function inicioFamiliarMes(d: AppData): string | null {
  if (d.familiar.primeraCuota) return d.familiar.primeraCuota.slice(0, 7);
  return inicioHipotecaMes(d);
}

/**
 * Último mes (YYYY-MM) con cuota al préstamo familiar. Con cuotas registradas, a partir de la
 * última y de lo que queda; si no, desde la primera cuota prevista. null = sin fecha.
 */
export function finPrestamoFamiliar(d: AppData): string | null {
  const f = d.familiar;
  if (f.importe <= 0 || f.cuota <= 0) return null;
  const cal = calendarioDe(d, 'familiar');
  const restantes = mesesRestantes(cal.pendiente, f.tinPct, f.cuota);
  if (restantes === null) return null;
  const conFecha = cal.filas.filter((x) => x.fecha && !x.liquidado);
  if (conFecha.length) return addMonths(conFecha[conFecha.length - 1].fecha.slice(0, 7), restantes);
  const ini = inicioFamiliarMes(d);
  return ini ? addMonths(ini, restantes - 1) : null;
}

const TITULO_FASE: Record<Fase['id'], string> = {
  espera: 'Antes de alquilar',
  devolviendo: 'Alquilado y devolviendo el préstamo familiar',
  libre: 'Alquilado sin cuota del préstamo familiar',
};

const pctTxt = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;

/**
 * Etapas del resultado mensual previsto: antes de alquilar, alquilado devolviendo a la familia y
 * alquilado sin esa cuota. Con fechas, cada etapa se parte además por tramo de la hipoteca (la
 * cuota cambia); sin fechas, son las tres etapas con la cuota principal.
 */
export function fasesResultado(d: AppData): Fase[] {
  const prev = previsionMensual(d);
  const t = tramosHipoteca(d);
  const fijos = fijosMensuales(d);
  const alq = d.recurrentes.alquiler;
  const l = (concepto: string, importe: number) => ({ concepto, importe });
  const capFam = (fam: number) => (fam ? Math.max(0, fam - Math.round(d.familiar.importe * (d.familiar.tinPct / 100 / 12))) : 0);
  const crear = (
    id: Fase['id'], key: string, hip: number, fam: number, desde: string | null, hasta: string | null,
    meses: number | null, tramo: 'A' | 'B' | null, mesRef: string | null,
  ): Fase => {
    const conAlq = id !== 'espera';
    const resultado = (conAlq ? alq : 0) - hip - fam - fijos;
    const capital = capitalHipotecaMes(d, mesRef) + capFam(fam);
    return {
      id, key, titulo: TITULO_FASE[id],
      subtitulo: [
        fam > 0 && fam < d.familiar.cuota ? `Última cuota a tus padres: ${fmtEur(fam)}` : null,
        tramo ? `Hipoteca al ${pctTxt(tramo === 'A' ? t.tinA : t.tinB)}${tramo === 'A' ? ` (${t.mesesA} primeros meses)` : ''}` : null,
      ].filter(Boolean).join(' · ') || null,
      resultado, capital, economico: resultado + capital, desde, hasta, meses,
      lineas: [
        ...(conAlq ? [l('Alquiler', alq)] : []),
        l('Cuota hipoteca', -hip), l('Gastos fijos', -fijos), ...(fam ? [l('Cuota préstamo familiar', -fam)] : []),
      ],
    };
  };

  if (!prev) {
    const fam = d.familiar.importe > 0 ? d.familiar.cuota : 0;
    const ini = inicioAlquilerMes(d);
    const fin = finPrestamoFamiliar(d);
    return [
      crear('espera', 'espera', t.cuotaA, fam, null, ini ? addMonths(ini, -1) : null, null, null, inicioHipotecaMes(d)),
      crear('devolviendo', 'devolviendo', t.cuotaB, fam, ini, fin, null, null, ini),
      crear('libre', 'libre', t.cuotaB, 0, fin ? addMonths(fin, 1) : null, null, null, null, fin ? addMonths(fin, 1) : null),
    ];
  }

  // Meses consecutivos de la previsión con la misma etapa, el mismo tramo de hipoteca y el mismo resultado
  const grupos: { fase: Fase['id']; tramo: 'A' | 'B' | null; meses: PrevisionMes[] }[] = [];
  for (const m of prev) {
    const g = grupos[grupos.length - 1];
    // Mismo resultado: la última cuota familiar (más pequeña) queda como etapa propia
    if (g && g.fase === m.fase && g.tramo === m.tramo && g.meses[0].resultado === m.resultado) g.meses.push(m);
    else grupos.push({ fase: m.fase, tramo: m.tramo, meses: [m] });
  }
  // La etapa libre solo hasta su primer tramo (sigue indefinidamente)
  const hastaLibre = grupos.findIndex((g) => g.fase === 'libre');
  const usados = hastaLibre >= 0 ? grupos.slice(0, hastaLibre + 1) : grupos;
  return usados.map((g, i) => {
    const primero = g.meses[0];
    const ultimo = g.meses[g.meses.length - 1];
    const libre = g.fase === 'libre';
    // Cuotas típicas del tramo (la del primer mes; la última familiar puede ser menor)
    return crear(
      g.fase, `${g.fase}-${g.tramo ?? 'u'}-${i}`, primero.hipoteca, primero.familiar, primero.key, libre ? null : ultimo.key,
      libre ? null : g.meses.length, g.tramo, primero.key,
    );
  });
}

/* ───────────── Lo que pones tú ───────────── */

export interface EtapaSueldo {
  id: Fase['id'];
  key: string;
  titulo: string;
  subtitulo: string | null;
  /** Lo que sale (o entra, si es positivo) cada mes */
  resultado: number;
  /** Meses que dura la etapa (null = sin fechas o indefinida) */
  meses: number | null;
}

/**
 * Lo que aportas de tu bolsillo: la entrada (lo que no cubren los préstamos) y, después, lo que
 * sale de tu sueldo cada mes en las etapas en negativo hasta que el piso se paga solo.
 */
export function aportacion(d: AppData) {
  const g = totalesGastos(d);
  const entrada = Math.max(0, g.total - d.hipoteca.importe - d.familiar.importe);
  const pagado = Math.min(dineroPropio(d).propio, entrada);
  const prev = previsionMensual(d);
  const etapas: EtapaSueldo[] = fasesResultado(d).map((f) => ({
    id: f.id, key: f.key, titulo: f.titulo, subtitulo: f.subtitulo, resultado: f.resultado, meses: f.meses,
  }));
  // Total del sueldo: los meses en negativo de la previsión (con la última cuota familiar exacta)
  const sueldoTotal = prev ? -prev.filter((m) => m.resultado < 0).reduce((a, m) => a + m.resultado, 0) : null;
  return { total: g.total, prestamos: d.hipoteca.importe + d.familiar.importe, entrada, pagado, quedan: entrada - pagado, etapas, sueldoTotal };
}

export interface PrevisionMes {
  key: string;
  fase: Fase['id'];
  tramo: 'A' | 'B' | null;
  hipoteca: number;
  familiar: number;
  resultado: number;
}

/** Resultado previsto de un mes concreto según qué cuotas y qué ingresos tocan ese mes. */
function resultadoPrevistoMes(d: AppData, key: string): PrevisionMes {
  const ini = inicioAlquilerMes(d);
  const alquila = !!ini && key >= ini;
  const hipoteca = cuotaHipotecaMes(d, key);
  const familiar = cuotaFamiliarMes(d, key);
  const resultado = (alquila ? d.recurrentes.alquiler : 0) - hipoteca - familiar - fijosMensuales(d);
  return { key, fase: !alquila ? 'espera' : familiar ? 'devolviendo' : 'libre', tramo: tramoMes(d, key), hipoteca, familiar, resultado };
}

/**
 * Resultado mensual previsto mes a mes, desde la primera cuota de la hipoteca hasta un año
 * después de la última cuota del préstamo familiar (o del inicio del alquiler). Necesita la fecha
 * de escritura y la de inicio del alquiler; si falta alguna, devuelve null.
 */
export function previsionMensual(d: AppData): PrevisionMes[] | null {
  const ini = inicioAlquilerMes(d);
  const desde = inicioHipotecaMes(d);
  if (!ini || !desde) return null;
  const fin = finPrestamoFamiliar(d);
  const hasta = addMonths(fin && fin > ini ? fin : ini, 12);
  const out: PrevisionMes[] = [];
  for (let k = desde; k <= hasta && out.length < 120; k = addMonths(k, 1)) out.push(resultadoPrevistoMes(d, k));
  return out;
}

/* ───────────── Recuperación prevista ───────────── */

export interface RecuperacionPrevista {
  /** Dinero propio de la compra (total − préstamos) + saldo de los meses antes de alquilar */
  invertido: number;
  /** Todo lo que sale de tu bolsillo: la entrada + los meses en negativo hasta recuperarlo */
  bolsillo: number;
  mes: string | null;
  /** Meses desde el inicio del alquiler hasta recuperarlo */
  mesesDesdeAlquiler: number | null;
}

/**
 * Cuándo se recupera lo invertido según la previsión (mismo criterio que el seguimiento real:
 * lo invertido incluye el coste de la espera y se recupera con el resultado de los meses de alquiler).
 */
export function recuperacionPrevista(d: AppData): RecuperacionPrevista | null {
  const ini = inicioAlquilerMes(d);
  const desde = inicioHipotecaMes(d);
  if (!ini || !desde) return null;
  const g = totalesGastos(d);
  const entrada = Math.max(0, g.total - d.hipoteca.importe - d.familiar.importe);
  let invertido = entrada;
  let bolsillo = entrada;
  for (let k = desde; k < ini; k = addMonths(k, 1)) {
    const r = resultadoPrevistoMes(d, k).resultado;
    invertido -= r;
    if (r < 0) bolsillo -= r;
  }
  let acumulado = 0;
  let n = 0;
  for (let k = ini; n < 600; k = addMonths(k, 1), n++) {
    const r = resultadoPrevistoMes(d, k).resultado;
    acumulado += r;
    if (r < 0) bolsillo -= r;
    if (acumulado >= invertido) return { invertido, bolsillo, mes: k, mesesDesdeAlquiler: n + 1 };
  }
  return { invertido, bolsillo, mes: null, mesesDesdeAlquiler: null };
}

/* ───────────── El día de la firma ───────────── */

/**
 * Qué se paga el día de la escritura y de dónde sale: la hipoteca, después tus ahorros y, lo
 * que falte, el préstamo familiar. Sin la reforma (va aparte, después de la firma).
 */
export function diaFirma(d: AppData) {
  const filas = filasGastos(d).filter((f) => !f.reforma && f.key !== 'reforma');
  const total = filas.reduce((a, f) => a + f.importe, 0);
  const yaPagado = filas.filter((f) => f.estado === 'pagado').reduce((a, f) => a + f.importe, 0);
  const pendiente = total - yaPagado;
  const hipoteca = d.hipoteca.importe;
  const trasHipoteca = Math.max(0, pendiente - hipoteca);
  const ahorros = Math.min(d.ahorros.firma, trasHipoteca);
  const familiarNecesario = Math.max(0, trasHipoteca - d.ahorros.firma);
  const falta = Math.max(0, trasHipoteca - ahorros - d.familiar.importe);
  const sobraFamiliar = Math.max(0, d.familiar.importe - familiarNecesario);
  const pendientes = filas.filter((f) => f.estado === 'pendiente' && f.importe > 0);
  return { filas: pendientes, total, yaPagado, pendiente, hipoteca, ahorros, familiarNecesario, falta, sobraFamiliar };
}

/** Copia de los datos sin la reforma (para ver la compra y la hipoteca por separado). */
export function sinReforma(d: AppData): AppData {
  // La parte del préstamo familiar que es para la reforma tampoco cuenta: no paga la compra
  const importe = Math.max(0, d.familiar.importe - Math.min(d.familiar.paraReforma, d.familiar.importe));
  return {
    ...d,
    gastos: { ...d.gastos, reforma: 0 },
    reforma: { partidas: [] },
    familiar: { ...d.familiar, importe, paraReforma: 0 },
  };
}

/* ───────────── De tu bolsillo (real) ───────────── */

/**
 * Lo que de verdad ha salido de tu bolsillo: lo pagado de la compra con tu dinero y cada mes en
 * negativo. Los meses en positivo te lo van devolviendo; cuando llegue a 0, empiezas a ganar.
 */
export function bolsilloReal(d: AppData) {
  const { propio } = dineroPropio(d);
  const meses = mesesOrdenados(d).map((k) => totalesMes(d.meses[k]).beneficio);
  const mesesNegativos = -meses.filter((b) => b < 0).reduce((a, b) => a + b, 0);
  const devuelto = meses.filter((b) => b > 0).reduce((a, b) => a + b, 0);
  const aportado = propio + mesesNegativos;
  return { compra: propio, mesesNegativos, aportado, devuelto, falta: Math.max(0, aportado - devuelto), ganancia: Math.max(0, devuelto - aportado) };
}

/* ───────────── Resultado económico: el capital devuelto es ahorro ───────────── */

/** Capital de la cuota de la hipoteca en un mes (YYYY-MM) del cuadro previsto, sin amortizaciones. */
export function capitalHipotecaMes(d: AppData, key: string | null): number {
  const t = tramosHipoteca(d);
  const iniHip = inicioHipotecaMes(d);
  if (!t.cuotaB) return 0;
  const k = key && iniHip && key > iniHip ? mesesEntre(iniHip, key) : 0;
  const enA = k < t.mesesA;
  const saldoA = saldoTras(d.hipoteca.importe, t.tinA, t.cuotaA, Math.min(k, t.mesesA));
  const saldo = enA ? saldoA : saldoTras(saldoA, t.tinB, t.cuotaB, k - t.mesesA);
  const c = enA ? t.cuotaA : t.cuotaB;
  const r = (enA ? t.tinA : t.tinB) / 100 / 12;
  return Math.max(0, Math.min(c, c - Math.round(saldo * r)));
}

/** Capital ya devuelto de los préstamos según las cuotas registradas (sin anticipadas: esas salen de tus ahorros). */
export function capitalDevuelto(d: AppData): number {
  return calendarioDe(d, 'hipoteca').totalCapital + calendarioDe(d, 'familiar').totalCapital;
}

/* ───────────── Deuda pendiente y patrimonio ───────────── */

/** Capital pendiente de la hipoteca tras `k` cuotas, según el cuadro previsto (sin amortizaciones). */
export function saldoHipotecaTras(d: AppData, k: number): number {
  const t = tramosHipoteca(d);
  if (k >= t.n) return 0;
  const kA = Math.min(k, t.mesesA);
  const sA = saldoTras(d.hipoteca.importe, t.tinA, t.cuotaA, kA);
  if (k <= t.mesesA) return sA;
  return saldoTras(sA, t.tinB, t.cuotaB, Math.min(k, t.n) - t.mesesA);
}

/** Lo que queda por devolver del préstamo familiar tras `k` cuotas. */
export function saldoFamiliarTras(d: AppData, k: number): number {
  const f = d.familiar;
  if (f.importe <= 0 || f.cuota <= 0) return Math.max(0, f.importe);
  return saldoTras(f.importe, f.tinPct, f.cuota, k);
}

/** Intereses de la hipoteca en 12 cuotas seguidas a partir de la cuota nº `desde + 1`. */
export function interesesHipotecaAnio(d: AppData, desde: number): number {
  const t = tramosHipoteca(d);
  let total = 0;
  for (let i = desde; i < desde + 12 && i < t.n; i++) {
    const tin = i < t.mesesA ? t.tinA : t.tinB;
    total += Math.round(saldoHipotecaTras(d, i) * (tin / 100 / 12));
  }
  return total;
}

export interface PuntoPatrimonio {
  titulo: string;
  /** Mes (YYYY-MM) si hay fecha de escritura */
  mes: string | null;
  deuda: number;
  neto: number;
}

/**
 * Tu patrimonio en el piso: lo que vale menos lo que aún debes. Cada cuota que pagas lo aumenta
 * (es deuda que dejas de deber). Sin revalorización: el valor del piso se mantiene fijo.
 */
export function patrimonio(d: AppData) {
  const valor = d.piso.valor || d.piso.precio;
  const t = tramosHipoteca(d);
  const ini = inicioHipotecaMes(d);
  const famMeses = d.familiar.importe > 0 && d.familiar.cuota > 0 ? mesesRestantes(d.familiar.importe, d.familiar.tinPct, d.familiar.cuota) : null;
  const punto = (titulo: string, k: number): PuntoPatrimonio => {
    const deuda = saldoHipotecaTras(d, k) + saldoFamiliarTras(d, k);
    return { titulo, mes: ini && k > 0 ? addMonths(ini, k - 1) : null, deuda, neto: valor - deuda };
  };
  const puntos = [
    punto('Al firmar', 0),
    ...(famMeses ? [punto('Al acabar con tus padres', famMeses)] : []),
    punto('A los 5 años', 60),
    punto('A los 10 años', 120),
    punto('A los 15 años', 180),
    punto('Al acabar la hipoteca', t.n),
  ].filter((p, i, arr) => arr.findIndex((q) => q.deuda === p.deuda) === i);
  // Ahora: con las cuotas ya registradas (solo cuando el piso ya es tuyo)
  const tuyo = d.hipoteca.recibida || (!!d.hitos.escrituraFecha && d.hitos.escrituraFecha <= todayISO());
  const actual = tuyo ? valor - calendarioDe(d, 'hipoteca').pendiente - calendarioDe(d, 'familiar').pendiente : null;
  return { valor, puntos, actual, estimado: !d.piso.valor };
}

/* ───────────── IRPF del alquiler (estimación) ───────────── */

export interface LineaIrpf {
  concepto: string;
  importe: number;
  nota?: string;
}

/**
 * Estimación del IRPF de un año completo de alquiler (rendimiento del capital inmobiliario):
 * ingresos − gastos deducibles − amortización; reducción por alquiler de vivienda; el resultado
 * se suma a tu base general y tributa a tu tipo marginal. Orientativo: confírmalo con un gestor.
 */
export function irpfAlquiler(d: AppData) {
  const ir = d.irpf;
  const r = d.recurrentes;
  const ingresos = r.alquiler * 12;
  // Año de referencia: los 12 primeros meses de alquiler (o de hipoteca si aún no hay fechas)
  const iniHip = inicioHipotecaMes(d);
  const iniAlq = inicioAlquilerMes(d);
  const desde = iniHip && iniAlq && iniAlq > iniHip ? mesesEntre(iniHip, iniAlq) : 0;
  const intereses = interesesHipotecaAnio(d, desde);
  // Intereses + reparaciones no pueden pasar de los ingresos; el exceso se aplica los 4 años siguientes
  const interesesDeducibles = Math.min(intereses, ingresos);
  const hogar = d.seguros.filter((x) => x.elegido && x.tipo === 'hogar').reduce((a, x) => a + x.primaAnual, 0);
  // Amortización: 3 % de la parte de construcción del mayor entre lo que te costó y el valor catastral
  const adquisicion = totalesGastos(sinReforma(d)).total;
  const pct = ir.pctConstruccion / 100;
  const baseAdq = Math.round(adquisicion * pct);
  const baseCat = Math.round(ir.valorCatastral * pct);
  const conPartidas = d.reforma.partidas.length > 0;
  const mejoras = conPartidas ? totalesReforma(d).mejora : d.gastos.reforma;
  const amortInmueble = Math.round((Math.max(baseAdq, baseCat) + mejoras) * 0.03);
  const amortMuebles = Math.round(ir.muebles * 0.1);
  const gastos: LineaIrpf[] = [
    { concepto: 'Intereses de la hipoteca', importe: interesesDeducibles, nota: intereses > ingresos ? `${fmtEur(intereses - ingresos)} pasan a los 4 años siguientes` : `año ${Math.floor(desde / 12) + 1} de la hipoteca` },
    { concepto: 'IBI', importe: r.ibiAnual },
    { concepto: 'Comunidad', importe: r.edificioAnual },
    { concepto: 'Seguro de hogar', importe: hogar, nota: 'el de vida no se deduce' },
    ...(r.mantenimientoMensual ? [{ concepto: 'Mantenimiento y reparaciones', importe: r.mantenimientoMensual * 12 }] : []),
    {
      concepto: 'Amortización del piso (3 %)', importe: amortInmueble,
      nota: `${ir.pctConstruccion} % de construcción sobre ${fmtEur(Math.max(baseAdq, baseCat) / pct || 0)}${mejoras ? ` + ${fmtEur(mejoras)} de mejoras${conPartidas ? '' : ' (toda la reforma como mejora)'}` : ''}`,
    },
    ...(amortMuebles ? [{ concepto: 'Amortización de muebles (10 %)', importe: amortMuebles }] : []),
  ];
  const totalGastos = gastos.reduce((a, g) => a + g.importe, 0);
  const neto = ingresos - totalGastos;
  const reduccion = neto > 0 ? Math.round((neto * ir.reduccionPct) / 100) : 0;
  const base = neto - reduccion;
  const cuota = base > 0 ? Math.round((base * ir.tipoMarginalPct) / 100) : 0;
  return { ingresos, gastos, totalGastos, neto, reduccion, base, cuota, mensual: Math.round(cuota / 12), desde };
}

/* ───────────── Simulador de amortización anticipada ───────────── */

export interface OpcionesAmortizacion {
  /** Importe de cada amortización (céntimos) */
  importe: number;
  /** Se amortiza justo después de esta cuota (1 = tras la primera) */
  trasCuota: number;
  /** Repetir la misma amortización cada 12 cuotas hasta acabar */
  cadaAnio: boolean;
  modo: 'plazo' | 'cuota';
}

export interface ResultadoAmortizacion {
  meses: number;
  intereses: number;
  amortizado: number;
  comision: number;
  /** Cuota al final (si se reduce la cuota, la última que queda) */
  cuotaFinal: number;
  fin: string | null;
}

/**
 * Hipoteca prevista mes a mes con amortizaciones anticipadas (sin las cuotas registradas: parte
 * del principio). Reducir plazo mantiene la cuota; reducir cuota mantiene el plazo y recalcula.
 * Al empezar el segundo tramo, la cuota se recalcula con lo pendiente, como hace el banco.
 */
export function simularAmortizacion(d: AppData, o: OpcionesAmortizacion): ResultadoAmortizacion {
  const t = tramosHipoteca(d);
  const comisionPct = d.hipoteca.fein.comisionAmortPct;
  let saldo = d.hipoteca.importe;
  let cuota = t.cuotaA;
  let plazo = t.n;
  let intereses = 0;
  let amortizado = 0;
  let i = 0;
  for (; saldo > 0 && i < 600; i++) {
    const tin = i < t.mesesA ? t.tinA : t.tinB;
    if (t.mesesA > 0 && i === t.mesesA) cuota = pmtMeses(saldo, tin, plazo);
    const r = tin / 100 / 12;
    const int = Math.round(saldo * r);
    // La última cuota del plazo liquida lo que quede (los redondeos dejan unos céntimos)
    const pago = plazo <= 1 ? saldo + int : Math.min(cuota, saldo + int);
    intereses += int;
    saldo -= pago - int;
    plazo--;
    const n = i + 1;
    const toca = o.importe > 0 && n >= o.trasCuota && (o.cadaAnio ? (n - o.trasCuota) % 12 === 0 : n === o.trasCuota);
    if (toca && saldo > 0) {
      const x = Math.min(o.importe, saldo);
      saldo -= x;
      amortizado += x;
      if (saldo > 0) {
        if (o.modo === 'cuota') cuota = pmtMeses(saldo, n < t.mesesA ? t.tinA : t.tinB, plazo);
        else plazo = mesesRestantes(saldo, n < t.mesesA ? t.tinA : t.tinB, cuota) ?? plazo;
      }
    }
  }
  const ini = inicioHipotecaMes(d);
  return {
    meses: i, intereses, amortizado, comision: Math.round((amortizado * comisionPct) / 100), cuotaFinal: cuota,
    fin: ini ? addMonths(ini, i - 1) : null,
  };
}
