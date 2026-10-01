import { BASE_KEYS, emptyData, uid, type AppData, type Cuota, type Estado, type Linea } from './model';
import { BACKUP_APP_ID, describeZodError, validateAppData, type BackupFile } from './schema';

export function buildBackup(data: AppData): BackupFile {
  return { app: BACKUP_APP_ID, schemaVersion: data.schemaVersion, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `piso-castellon_${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}.json`;
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImportResult =
  | { ok: true; data: AppData; origen: 'app' | 'prototipo'; resumen: string }
  | { ok: false; error: string };

/** Acepta una copia de esta app o un JSON exportado del prototipo (formato con "dg"). */
export function parseBackup(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'El archivo está vacío o no tiene el formato esperado.' };
  const o = raw as Record<string, unknown>;
  try {
    if (o.app === BACKUP_APP_ID && o.data) {
      const data = validateAppData(o.data);
      return { ok: true, data, origen: 'app', resumen: resumen(data) };
    }
    if (o.dg && typeof o.dg === 'object') {
      const data = validateAppData(fromPrototype(o));
      return { ok: true, data, origen: 'prototipo', resumen: resumen(data) };
    }
    if (o.schemaVersion && o.piso) {
      const data = validateAppData(o);
      return { ok: true, data, origen: 'app', resumen: resumen(data) };
    }
  } catch (e) {
    return { ok: false, error: `Los datos no son válidos:\n${describeZodError(e)}` };
  }
  return { ok: false, error: 'No reconozco el formato del archivo (ni copia de esta app ni del prototipo).' };
}

function resumen(d: AppData): string {
  const meses = Object.keys(d.meses).length;
  const cuotas = d.cuotas.hipoteca.length + d.cuotas.familiar.length;
  return `${meses} ${meses === 1 ? 'mes' : 'meses'}, ${cuotas} cuotas, ${d.notas.length} notas, ${d.gastosExtra.length} gastos extra`;
}

/* ───────────── Migración desde el prototipo ───────────── */

type Any = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const fecha = (v: unknown): string => {
  const s = str(v).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str(v));
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};
const eur = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(str(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const eurOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : eur(v));
/** Fracción (0.09) o porcentaje (9) → porcentaje */
const pct = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(str(v).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return n < 1 ? Math.round(n * 100 * 10000) / 10000 : n;
};
const est = (v: unknown): Estado => (/pagad/i.test(str(v)) ? 'pagado' : 'pendiente');
const pick = (o: Any, ...keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
};
const arr = (v: unknown): Any[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Any[]) : []);

function lineas(v: unknown): Linea[] {
  return arr(v).map((x) => ({
    id: uid(),
    concepto: str(pick(x, 'concepto', 'nombre', 'label', 'name')),
    importe: eur(pick(x, 'importe', 'valor', 'amount')),
    estado: est(pick(x, 'estado', 'status')),
  }));
}

function cuotas(v: unknown): Cuota[] {
  return arr(v).map((x) => ({
    id: uid(),
    fecha: fecha(pick(x, 'fecha', 'date')),
    cuota: eurOrNull(pick(x, 'cuota', 'cuotaPagada', 'pagado')),
    interes: eurOrNull(pick(x, 'interes', 'intereses')),
    anticipada: eur(pick(x, 'anticipada', 'amortAnticipada', 'amortizacionAnticipada', 'extra')),
  }));
}

export function fromPrototype(p: Any): AppData {
  const dg = (p.dg ?? {}) as Any;
  const d = emptyData();
  d.piso = {
    precio: eur(dg.precio),
    tipoVivienda: str(dg.tipoVivienda),
    comunidadAutonoma: str(dg.comunidadAutonoma) || d.piso.comunidadAutonoma,
    itpPct: pct(dg.itpPct),
  };
  d.hitos = {
    senalFecha: fecha(dg.fechaSenal), senal: eur(dg.senal), contratoFecha: fecha(dg.fechaContratoCV),
    arrasFecha: fecha(dg.fechaArras), arras: eur(dg.importeArras ?? dg.arras), escrituraFecha: fecha(dg.fechaEscritura),
  };
  d.gastos = {
    comision: eur(dg.comisionInmobiliaria), reforma: eur(dg.presupuestoReforma), notaria: eur(dg.notaria),
    registro: eur(dg.registro), gestoria: eur(dg.gestoria), tasacion: eur(dg.tasacion), tasacionFecha: fecha(dg.tasacionFecha),
  };
  d.hipoteca = {
    banco: str(dg.banco), viabilidadFecha: fecha(dg.hipotecaViabilidadFecha), importe: eur(dg.hipotecaImporte),
    plazoAnios: Number(dg.hipotecaPlazo) || 0, tinPct: pct(dg.hipotecaTin), notas: str(dg.hipotecaEstado),
  };
  d.familiar = {
    importe: eur(dg.prestamoPadresImporte), cuota: eur(dg.prestamoPadresCuota), tinPct: 0, notas: str(dg.prestamoPadresNotas),
  };
  d.recurrentes = {
    alquiler: eur(dg.alquiler), edificioAnual: eur(dg.cuotaEdificioAnual), ibiAnual: eur(dg.ibiAnual),
    seguroHogarAnual: eur(dg.seguroHogarAnual), seguroVidaAnual: eur(dg.seguroVidaAnual),
    mantenimientoMensual: eur(dg.mantenimientoMensual),
  };
  const gbe = (p.gastosBaseEstado ?? {}) as Record<string, Any>;
  for (const k of BASE_KEYS) {
    const s = gbe[k];
    if (s) d.gastosBase[k] = { estado: est(s.estado), nota: str(pick(s, 'nota', 'notas')), fecha: fecha(s.fecha) };
  }
  d.gastosExtra = arr(p.gastosExtra).map((x) => ({
    id: uid(),
    concepto: str(pick(x, 'concepto', 'nombre', 'name')),
    fecha: fecha(x.fecha),
    importe: eur(x.importe),
    estado: est(x.estado),
    nota: str(pick(x, 'nota', 'notas')),
  }));
  d.cuotas = { hipoteca: cuotas(p.segHipoteca), familiar: cuotas(p.segPadres) };
  const periodos = (p.periodos ?? {}) as Record<string, Any>;
  for (const [key, m] of Object.entries(periodos)) {
    if (!/^\d{4}-\d{2}$/.test(key) || !m) continue;
    d.meses[key] = { ingresos: lineas(m.ingresos), gastos: lineas(m.gastos) };
  }
  d.notas = arr(p.notas).map((x) => ({ id: uid(), fecha: fecha(x.fecha), texto: str(pick(x, 'texto', 'text', 'nota')) }));
  d.meta.lastExportAt = str(p.lastExportAt);
  return d;
}
