import { mesPrevision } from './lib/derive';
import { BASE_KEYS, emptyData, uid, type AppData } from './lib/model';

/** Versión de demostración: sin nube, con su propio almacenamiento y datos ficticios. */
export const DEMO = import.meta.env.VITE_DEMO === '1';

/** Piso inventado, comprado en 2025 y alquilado desde junio de 2025, con sus meses ya registrados. */
export function demoData(): AppData {
  const d = emptyData();
  d.piso = { precio: 9000000, valor: 9250000, tipoVivienda: 'Piso de ejemplo de 1978, Zaragoza (2ª mano)', comunidadAutonoma: 'Aragón', itpPct: 8 };
  d.hitos = {
    senalFecha: '2025-01-15', senal: 300000, contratoFecha: '2025-01-20', arrasFecha: '2025-02-01', arras: 600000,
    actaFecha: '2025-03-03', escrituraFecha: '2025-03-10',
  };
  d.gastos = { comision: 300000, reforma: 800000, notaria: 90000, registro: 60000, gestoria: 40000, tasacion: 30000, tasacionFecha: '2025-02-10' };
  d.hipoteca = {
    ...d.hipoteca,
    banco: 'Banco Ejemplo', viabilidadFecha: '2025-02-05', importe: 7200000, plazoAnios: 25, tinPct: 3.2, recibida: true, nominaBizum: true,
    notas: 'Hipoteca ficticia a tipo fijo.',
    fein: { taePct: 3.6, vinculaciones: 'Nómina domiciliada', fechaEmision: '2025-02-12', firmadaFecha: '2025-02-14', validaHasta: '2025-03-14', comisionAmortPct: 0 },
  };
  d.familiar = { importe: 1000000, cuota: 30000, tinPct: 0, notas: 'Préstamo familiar de ejemplo, sin interés.', recibido: true, primeraCuota: '2025-04-01', paraReforma: 0 };
  d.recurrentes = { ...d.recurrentes, inicioAlquiler: '2025-06-01', alquiler: 80000, edificioAnual: 36000, ibiAnual: 32000, basuraAnual: 9000 };
  d.ahorros = { firma: 1500000 };
  d.irpf = { ...d.irpf, valorCatastral: 4500000, tipoMarginalPct: 30 };
  d.seguros = [
    { id: uid(), tipo: 'hogar', nombre: 'Seguro de hogar', aseguradora: 'Aseguradora Ejemplo', primaAnual: 18000, bonifPct: 0, elegido: true, contratado: true, nota: '', mesPago: 3 },
  ];
  for (const k of BASE_KEYS) d.gastosBase[k] = { ...d.gastosBase[k], estado: 'pagado' };
  d.notas = [
    { id: uid(), fecha: '2025-03-10', texto: 'Escritura firmada. Todos los datos de esta versión son ficticios.' },
    { id: uid(), fecha: '2025-06-01', texto: 'Empieza el alquiler: contrato de 5 años, fianza de un mes depositada.' },
  ];
  // Meses ya cerrados, del primero tras la escritura hasta octubre de 2026, con todo cobrado y pagado
  for (let y = 2025, m = 4; y < 2026 || (y === 2026 && m <= 10); m === 12 ? (y++, (m = 1)) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const mes = mesPrevision(d, key);
    for (const l of [...mes.ingresos, ...mes.gastos]) l.estado = 'pagado';
    d.meses[key] = mes;
  }
  return d;
}
