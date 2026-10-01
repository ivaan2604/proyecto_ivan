import { z } from 'zod';
import { BASE_KEYS, SCHEMA_VERSION, emptyData, type AppData } from './model';

const cents = z.number().int();
const fecha = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha con formato YYYY-MM-DD');
const estado = z.enum(['pagado', 'pendiente']);

const linea = z.object({ id: z.string(), concepto: z.string(), importe: cents, estado });
const cuota = z.object({
  id: z.string(),
  fecha,
  cuota: cents.nullable(),
  interes: cents.nullable(),
  anticipada: cents.min(0),
});

export const appDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  piso: z.object({ precio: cents, tipoVivienda: z.string(), comunidadAutonoma: z.string(), itpPct: z.number() }),
  hitos: z.object({
    senalFecha: fecha, senal: cents, contratoFecha: fecha, arrasFecha: fecha, arras: cents, escrituraFecha: fecha,
  }),
  gastos: z.object({
    comision: cents, reforma: cents, notaria: cents, registro: cents, gestoria: cents, tasacion: cents, tasacionFecha: fecha,
  }),
  hipoteca: z.object({
    banco: z.string(), viabilidadFecha: fecha, importe: cents, plazoAnios: z.number().min(0),
    tinPct: z.number(), notas: z.string(), recibida: z.boolean(),
  }),
  familiar: z.object({ importe: cents, cuota: cents, tinPct: z.number(), notas: z.string(), recibido: z.boolean() }),
  recurrentes: z.object({
    inicioAlquiler: fecha, alquiler: cents, edificioAnual: cents, ibiAnual: cents, seguroHogarAnual: cents,
    seguroVidaAnual: cents, mantenimientoMensual: cents,
  }),
  gastosBase: z.object(
    Object.fromEntries(BASE_KEYS.map((k) => [k, z.object({ estado, nota: z.string(), fecha })])) as Record<
      (typeof BASE_KEYS)[number],
      z.ZodObject<{ estado: typeof estado; nota: z.ZodString; fecha: typeof fecha }>
    >,
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
    hipoteca: { ...base.hipoteca, recibida: restoPagado, ...obj.hipoteca },
    familiar: { ...base.familiar, recibido: restoPagado, ...obj.familiar },
    recurrentes: { ...base.recurrentes, ...obj.recurrentes },
    gastosBase: Object.fromEntries(
      BASE_KEYS.map((k) => [k, { ...base.gastosBase[k], ...(obj.gastosBase?.[k] ?? {}) }]),
    ),
    reforma: { ...base.reforma, ...obj.reforma },
    cuotas: { ...base.cuotas, ...obj.cuotas },
    meta: { ...base.meta, ...obj.meta },
  };
  return appDataSchema.parse(merged) as AppData;
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
