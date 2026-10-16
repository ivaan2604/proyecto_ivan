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
  /** Importe provisional (provisión de fondos): la cifra final llega con la liquidación */
  provision: boolean;
  /** Importe final de la liquidación; null = aún sin liquidar (se usa el provisional) */
  liquidacion: number | null;
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
  /** Línea de cuota de un préstamo: al pagarla se puede registrar también en su cuadro de cuotas */
  vinculo?: LoanKind;
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

/** Ficha Europea de Información Normalizada de la hipoteca (campos opcionales). */
export interface Fein {
  /** TAE en %; null = aún sin dato */
  taePct: number | null;
  vinculaciones: string;
  fechaEmision: string;
  /** Fecha hasta la que la oferta es vinculante */
  validaHasta: string;
  /** Comisión por amortización anticipada (parcial o total), en % del importe amortizado */
  comisionAmortPct: number;
}

export type TipoSeguro = 'hogar' | 'vida' | 'proteccion' | 'otro';

/**
 * Un seguro (contratado o presupuesto). Los elegidos cuentan en los gastos fijos del piso y,
 * si dan rebaja en la hipoteca (`bonifPct`), en el interés del tramo bonificable.
 * De cada tipo (salvo «otro») solo se elige uno: los demás son alternativas para comparar.
 */
export interface Seguro {
  id: string;
  tipo: TipoSeguro;
  nombre: string;
  aseguradora: string;
  primaAnual: number;
  /** Puntos que rebaja el interés de la hipoteca (0 si no cumple el mínimo de la FEIN) */
  bonifPct: number;
  elegido: boolean;
  contratado: boolean;
  nota: string;
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
    /** Valor de mercado estimado (p. ej. la tasación), para el patrimonio */
    valor: number;
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
    /** TIN del tramo principal (o único) ANTES de rebajas */
    tinPct: number;
    /** Tramo inicial a tipo distinto (p. ej. 6 meses al 3,29 %). 0 meses = un solo tramo */
    tramoAMeses: number;
    tramoATinPct: number;
    /** Rebaja por domiciliar nómina (+ Bizum o tarjeta), en puntos */
    bonifNominaPct: number;
    nominaBizum: boolean;
    /** Rebaja máxima total que admite la FEIN, en puntos */
    bonifMaxPct: number;
    notas: string;
    /** El banco ya ha entregado el dinero (en la escritura) */
    recibida: boolean;
    /** Condiciones provisionales hasta recibir la FEIN */
    provisional: boolean;
    fein: Fein;
  };
  familiar: {
    importe: number;
    cuota: number;
    tinPct: number;
    notas: string;
    recibido: boolean;
    /** Fecha prevista o real de la primera cuota; vacía = el mes siguiente a la escritura */
    primeraCuota: string;
  };
  recurrentes: {
    /** Fecha prevista o real del primer alquiler; antes de ella el piso está «en reforma» */
    inicioAlquiler: string;
    alquiler: number;
    edificioAnual: number;
    ibiAnual: number;
    /** Obsoletos: los seguros van en `seguros` (se migran al cargar) */
    seguroHogarAnual: number;
    seguroVidaAnual: number;
    mantenimientoMensual: number;
  };
  /** Datos para estimar el IRPF del alquiler */
  irpf: {
    /** Valor catastral total (recibo del IBI) */
    valorCatastral: number;
    /** % del valor catastral que es construcción (el resto es suelo, que no se amortiza) */
    pctConstruccion: number;
    /** Reducción por alquiler de vivienda: 50 % general; 60, 70 o 90 % en casos concretos */
    reduccionPct: number;
    /** Tipo marginal aproximado de tu IRPF (al que tributa cada euro más) */
    tipoMarginalPct: number;
    /** Muebles y electrodomésticos del piso alquilado (se amortizan al 10 % anual) */
    muebles: number;
  };
  /** Dinero tuyo para pagar en la firma, además de lo ya pagado: se usa antes que el préstamo familiar */
  ahorros: { firma: number };
  seguros: Seguro[];
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
    BASE_KEYS.map((k) => [k, { estado: 'pendiente', nota: '', fecha: '', provision: false, liquidacion: null } satisfies GastoBaseEstado]),
  ) as Record<BaseKey, GastoBaseEstado>;
  return {
    schemaVersion: SCHEMA_VERSION,
    piso: { precio: 0, valor: 0, tipoVivienda: '', comunidadAutonoma: 'Comunidad Valenciana', itpPct: 9 },
    hitos: { senalFecha: '', senal: 0, contratoFecha: '', arrasFecha: '', arras: 0, escrituraFecha: '' },
    gastos: { comision: 0, reforma: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, tasacionFecha: '' },
    hipoteca: {
      banco: '', viabilidadFecha: '', importe: 0, plazoAnios: 25, tinPct: 0, notas: '', recibida: false, provisional: false,
      tramoAMeses: 0, tramoATinPct: 0, bonifNominaPct: 0, nominaBizum: false, bonifMaxPct: 0,
      fein: { taePct: null, vinculaciones: '', fechaEmision: '', validaHasta: '', comisionAmortPct: 0 },
    },
    familiar: { importe: 0, cuota: 0, tinPct: 0, notas: '', recibido: false, primeraCuota: '' },
    recurrentes: {
      inicioAlquiler: '',
      alquiler: 0,
      edificioAnual: 0,
      ibiAnual: 0,
      seguroHogarAnual: 0,
      seguroVidaAnual: 0,
      mantenimientoMensual: 0,
    },
    ahorros: { firma: 0 },
    irpf: { valorCatastral: 0, pctConstruccion: 60, reduccionPct: 50, tipoMarginalPct: 30, muebles: 0 },
    seguros: [],
    gastosBase,
    gastosExtra: [],
    reforma: { partidas: [] },
    meses: {},
    cuotas: { hipoteca: [], familiar: [] },
    notas: [],
    meta: { createdAt: new Date().toISOString(), lastExportAt: '' },
  };
}
