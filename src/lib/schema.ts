import { z } from 'zod';
import { BASE_KEYS, SCHEMA_VERSION, emptyData, uid, type AppData, type Seguro } from './model';

const cents = z.number().int();
const fecha = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha con formato YYYY-MM-DD');
const estado = z.enum(['pagado', 'pendiente']);

const linea = z.object({
  id: z.string(), concepto: z.string(), importe: cents, estado, vinculo: z.enum(['hipoteca', 'familiar']).optional(),
});
const cuota = z.object({
  id: z.string(),
  fecha,
  cuota: cents.nullable(),
  interes: cents.nullable(),
  anticipada: cents.min(0),
});

const gastoBase = z.object({ estado, nota: z.string(), fecha, provision: z.boolean(), liquidacion: cents.nullable() });

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  piso: z.object({ precio: cents, valor: cents.min(0), tipoVivienda: z.string(), comunidadAutonoma: z.string(), itpPct: z.number() }),
  hitos: z.object({
    senalFecha: fecha, senal: cents, contratoFecha: fecha, arrasFecha: fecha, arras: cents, escrituraFecha: fecha,
  }),
  gastos: z.object({
    comision: cents, reforma: cents, notaria: cents, registro: cents, gestoria: cents, tasacion: cents, tasacionFecha: fecha,
  }),
  hipoteca: z.object({
    banco: z.string(), viabilidadFecha: fecha, importe: cents, plazoAnios: z.number().min(0),
    tinPct: z.number(), notas: z.string(), recibida: z.boolean(), provisional: z.boolean(),
    tramoAMeses: z.number().int().min(0), tramoATinPct: z.number(), bonifNominaPct: z.number().min(0),
    nominaBizum: z.boolean(), bonifMaxPct: z.number().min(0),
    fein: z.object({
      taePct: z.number().nullable(), vinculaciones: z.string(), fechaEmision: fecha, firmadaFecha: fecha, validaHasta: fecha,
      comisionAmortPct: z.number().min(0),
    }),
  }),
  familiar: z.object({
    importe: cents, cuota: cents, tinPct: z.number(), notas: z.string(), recibido: z.boolean(), primeraCuota: fecha,
  }),
  recurrentes: z.object({
    inicioAlquiler: fecha, alquiler: cents, edificioAnual: cents, ibiAnual: cents, seguroHogarAnual: cents,
    seguroVidaAnual: cents, mantenimientoMensual: cents,
  }),
  ahorros: z.object({ firma: cents.min(0) }),
  irpf: z.object({
    valorCatastral: cents.min(0), pctConstruccion: z.number().min(0).max(100), reduccionPct: z.number().min(0).max(100),
    tipoMarginalPct: z.number().min(0).max(100), muebles: cents.min(0),
  }),
  seguros: z.array(
    z.object({
      id: z.string(), tipo: z.enum(['hogar', 'vida', 'proteccion', 'otro']), nombre: z.string(), aseguradora: z.string(),
      primaAnual: cents.min(0), bonifPct: z.number().min(0), elegido: z.boolean(), contratado: z.boolean(), nota: z.string(),
    }),
  ),
  gastosBase: z.object(
    Object.fromEntries(BASE_KEYS.map((k) => [k, gastoBase])) as Record<(typeof BASE_KEYS)[number], typeof gastoBase>,
  ),
  gastosExtra: z.array(
    z.object({ id: z.string(), concepto: z.string(), fecha, importe: cents, estado, nota: z.string() }),
  ),
  reforma: z.object({
    partidas: z.array(
      z.object({
        id: z.string(),
        concepto: z.string(),
        presupuesto: cents.min(0),
        tipo: z.enum(['mejora', 'reparacion']),
        pagos: z.array(z.object({ id: z.string(), fecha, importe: cents, estado, factura: z.string(), nota: z.string() })),
      }),
    ),
  }),
  meses: z.record(
    z.string().regex(/^\d{4}-\d{2}$/),
    z.object({ ingresos: z.array(linea), gastos: z.array(linea) }),
  ),
  cuotas: z.object({ hipoteca: z.array(cuota), familiar: z.array(cuota) }),
  notas: z.array(z.object({ id: z.string(), fecha, texto: z.string() })),
  meta: z.object({ createdAt: z.string(), lastExportAt: z.string() }),
});

export const BACKUP_APP_ID = 'piso-castellon';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
}

/**
 * Normaliza datos que pueden venir incompletos (versiones anteriores, campos nuevos):
 * rellena con los valores por defecto y valida estrictamente el resultado.
 */
export function validateAppData(input: unknown): AppData {
  const base = emptyData();
  const obj = (input ?? {}) as Partial<AppData>;
  // Datos anteriores a «financiación recibida»: si el resto del precio está pagado, se entiende
  // que los préstamos ya se recibieron (se pagó con ellos en la escritura).
  const restoPagado = obj.gastosBase?.restoPrecio?.estado === 'pagado';
  const merged = {
    ...base,
    ...obj,
    piso: { ...base.piso, ...obj.piso },
    hitos: { ...base.hitos, ...obj.hitos },
    gastos: { ...base.gastos, ...obj.gastos },
    hipoteca: {
      ...base.hipoteca, recibida: restoPagado, ...obj.hipoteca,
      fein: { ...base.hipoteca.fein, ...obj.hipoteca?.fein },
    },
    familiar: { ...base.familiar, recibido: restoPagado, ...obj.familiar },
    // Los importes de seguro antiguos pasan a la lista de seguros (y aquí quedan a 0)
    recurrentes: { ...base.recurrentes, ...obj.recurrentes, ...(obj.seguros ? {} : { seguroHogarAnual: 0, seguroVidaAnual: 0 }) },
    gastosBase: Object.fromEntries(
      BASE_KEYS.map((k) => [k, { ...base.gastosBase[k], ...(obj.gastosBase?.[k] ?? {}) }]),
    ),
    ahorros: { ...base.ahorros, ...obj.ahorros },
    irpf: { ...base.irpf, ...obj.irpf },
    seguros: obj.seguros ?? segurosAntiguos(obj),
    reforma: { ...base.reforma, ...obj.reforma },
    cuotas: { ...base.cuotas, ...obj.cuotas },
    meta: { ...base.meta, ...obj.meta },
  };
  // Lo que esta versión no conoce (campos de una versión más nueva) se conserva tal cual:
  // así abrir la app con una versión antigua nunca borra datos al volver a guardar.
  return conservarDesconocidos(merged, appDataSchema.parse(merged)) as AppData;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Copia sobre `limpio` las claves de `original` que la validación ha quitado (a cualquier nivel). */
function conservarDesconocidos(original: unknown, limpio: unknown): unknown {
  if (Array.isArray(original) && Array.isArray(limpio)) {
    return limpio.map((x, i) => (i < original.length ? conservarDesconocidos(original[i], x) : x));
  }
  if (!esObjeto(original) || !esObjeto(limpio)) return limpio;
  const out: Record<string, unknown> = { ...limpio };
  for (const [k, v] of Object.entries(original)) {
    out[k] = k in limpio ? conservarDesconocidos(v, limpio[k]) : v;
  }
  return out;
}

/** Datos anteriores a la lista de seguros: los importes anuales de hogar y vida pasan a ser seguros elegidos. */
function segurosAntiguos(obj: Partial<AppData>): Seguro[] {
  const r = obj.recurrentes;
  const s = (tipo: Seguro['tipo'], nombre: string, prima: number): Seguro => ({
    id: uid(), tipo, nombre, aseguradora: '', primaAnual: prima, bonifPct: 0, elegido: true, contratado: false, nota: '',
  });
  const out: Seguro[] = [];
  if (r?.seguroHogarAnual) out.push(s('hogar', 'Seguro de hogar', r.seguroHogarAnual));
  if (r?.seguroVidaAnual) out.push(s('vida', 'Seguro de vida', r.seguroVidaAnual));
  return out;
}

export function describeZodError(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues
      .slice(0, 4)
      .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
  }
  return e instanceof Error ? e.message : String(e);
}
