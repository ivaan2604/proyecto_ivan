/**
 * Modelo de datos de la app. Todos los importes se guardan en CÉNTIMOS (enteros)
 * para evitar errores de coma flotante. Los porcentajes se guardan "en %" (9 = 9 %).
 * Las fechas son cadenas ISO "YYYY-MM-DD" ("" = sin fecha).
 */

export const SCHEMA_VERSION = 1;

export type Estado = 'pagado' | 'pendiente';

/** Gastos de compra que la app genera automáticamente a partir de los datos generales. */
export const BASE_KEYS = [
  'senal',
  'arras',
  'restoPrecio',
  'itp',
  'notaria',
  'registro',
  'gestoria',
  'tasacion',
  'comision',
  'reforma',
] as const;
export type BaseKey = (typeof BASE_KEYS)[number];

export interface GastoBaseEstado {
  estado: Estado;
  nota: string;
  /** Fecha específica; si está vacía se usa la fecha derivada (señal, arras, escritura…). */
  fecha: string;
}

export interface GastoExtra {
  id: string;
  concepto: string;
  fecha: string;
  importe: number;
  estado: Estado;
  nota: string;
}

export interface Linea {
  id: string;
  concepto: string;
  importe: number;
  estado: Estado;
}

export interface Mes {
  ingresos: Linea[];
  gastos: Linea[];
}

export interface Cuota {
  id: string;
  fecha: string;
  /** null = usar la cuota pactada */
  cuota: number | null;
  /** null = calcular (capital pendiente × TIN/12; 0 si el préstamo no tiene interés) */
  interes: number | null;
  /** Amortización anticipada (reduce plazo, no cuota) */
  anticipada: number;
}

export type TipoObra = 'mejora' | 'reparacion';

export interface PagoReforma {
  id: string;
  fecha: string;
  importe: number;
  estado: Estado;
  factura: string;
  nota: string;
}

export interface PartidaReforma {
  id: string;
  concepto: string;
  presupuesto: number;
  /** Fiscalmente: la mejora aumenta el valor del piso (se amortiza); la reparación se deduce */
  tipo: TipoObra;
  pagos: PagoReforma[];
}

export interface Nota {
  id: string;
  fecha: string;
  texto: string;
}

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  piso: {
    precio: number;
    tipoVivienda: string;
    comunidadAutonoma: string;
    itpPct: number;
  };
  hitos: {
    senalFecha: string;
    senal: number;
    contratoFecha: string;
    arrasFecha: string;
    arras: number;
    escrituraFecha: string;
  };
  gastos: {
    comision: number;
    reforma: number;
    notaria: number;
    registro: number;
    gestoria: number;
    tasacion: number;
    tasacionFecha: string;
  };
  hipoteca: {
    banco: string;
    viabilidadFecha: string;
    importe: number;
    plazoAnios: number;
    tinPct: number;
    notas: string;
    /** El banco ya ha entregado el dinero (en la escritura) */
    recibida: boolean;
  };
  familiar: {
    importe: number;
    cuota: number;
    tinPct: number;
    notas: string;
    recibido: boolean;
  };
  recurrentes: {
    /** Fecha prevista o real del primer alquiler; antes de ella el piso está «en reforma» */
    inicioAlquiler: string;
    alquiler: number;
    edificioAnual: number;
    ibiAnual: number;
    seguroHogarAnual: number;
    seguroVidaAnual: number;
    mantenimientoMensual: number;
  };
  gastosBase: Record<BaseKey, GastoBaseEstado>;
  gastosExtra: GastoExtra[];
  /** Si tiene partidas, sustituye al importe único «reforma» de los gastos de compra */
  reforma: { partidas: PartidaReforma[] };
  /** Clave "YYYY-MM" */
  meses: Record<string, Mes>;
  cuotas: {
    hipoteca: Cuota[];
    familiar: Cuota[];
  };
  notas: Nota[];
  meta: {
    createdAt: string;
    lastExportAt: string;
  };
}

export type LoanKind = keyof AppData['cuotas'];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyData(): AppData {
  const gastosBase = Object.fromEntries(
    BASE_KEYS.map((k) => [k, { estado: 'pendiente', nota: '', fecha: '' } satisfies GastoBaseEstado]),
  ) as Record<BaseKey, GastoBaseEstado>;
  return {
    schemaVersion: SCHEMA_VERSION,
    piso: { precio: 0, tipoVivienda: '', comunidadAutonoma: 'Comunidad Valenciana', itpPct: 9 },
    hitos: { senalFecha: '', senal: 0, contratoFecha: '', arrasFecha: '', arras: 0, escrituraFecha: '' },
    gastos: { comision: 0, reforma: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, tasacionFecha: '' },
    hipoteca: { banco: '', viabilidadFecha: '', importe: 0, plazoAnios: 25, tinPct: 0, notas: '', recibida: false },
    familiar: { importe: 0, cuota: 0, tinPct: 0, notas: '', recibido: false },
    recurrentes: {
      inicioAlquiler: '',
      alquiler: 0,
      edificioAnual: 0,
      ibiAnual: 0,
      seguroHogarAnual: 0,
      seguroVidaAnual: 0,
      mantenimientoMensual: 0,
    },
    gastosBase,
    gastosExtra: [],
    reforma: { partidas: [] },
    meses: {},
    cuotas: { hipoteca: [], familiar: [] },
    notas: [],
    meta: { createdAt: new Date().toISOString(), lastExportAt: '' },
  };
}
