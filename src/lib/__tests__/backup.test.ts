import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from '../backup';
import { importeBase, mesPrevision, totalesGastos } from '../derive';
import { parseMoney } from '../format';

const prototipo = {
  dg: {
    precio: 80000, tipoVivienda: 'Piso', comunidadAutonoma: 'Comunidad Valenciana', itpPct: 0.09,
    fechaSenal: '2026-01-10', senal: 2000, fechaContratoCV: '2026-01-20', fechaArras: '2026-02-01', importeArras: 6000,
    fechaEscritura: '', comisionInmobiliaria: 3000, presupuestoReforma: 5000, notaria: 600, registro: 300, gestoria: 250,
    tasacion: 300.5, tasacionFecha: '2026-02-05', banco: 'Banco', hipotecaViabilidadFecha: '2026-02-03',
    hipotecaImporte: 64000, hipotecaPlazo: 30, hipotecaTin: 0.03, hipotecaEstado: 'Notas',
    prestamoPadresImporte: 10000, prestamoPadresCuota: 150, prestamoPadresNotas: '', alquiler: 700,
    cuotaEdificioAnual: 120, ibiAnual: 240, seguroHogarAnual: 200, seguroVidaAnual: 100, mantenimientoMensual: 25,
  },
  gastosBaseEstado: { senal: { estado: 'Pagado' }, arras: { estado: 'Pagado' }, comision: { estado: 'Pendiente', nota: 'x' } },
  gastosExtra: [{ concepto: 'Cerrajero', importe: 80, estado: 'Pagado', fecha: '2026-02-10' }],
  segHipoteca: [], segPadres: [],
  periodos: { '2026-03': { ingresos: [{ concepto: 'Alquiler', importe: 700, estado: 'Pagado' }], gastos: [] } },
  notas: [{ fecha: '2026-01-02', texto: 'Llamar al banco' }],
  lastExportAt: '2026-02-01T10:00:00.000Z', uiTheme: 'auto',
};

describe('importación del prototipo', () => {
  const r = parseBackup(JSON.stringify(prototipo));
  it('se reconoce y valida', () => {
    expect(r.ok).toBe(true);
  });
  if (!r.ok) return;
  const d = r.data;
  it('convierte euros a céntimos y fracciones a %', () => {
    expect(d.piso.precio).toBe(8_000_000);
    expect(d.piso.itpPct).toBe(9);
    expect(d.hipoteca.tinPct).toBe(3);
    expect(d.gastos.tasacion).toBe(30050);
  });
  it('calcula ITP y resto del precio', () => {
    expect(importeBase(d, 'itp')).toBe(720_000);
    expect(importeBase(d, 'restoPrecio')).toBe(8_000_000 - 200_000 - 600_000);
  });
  it('mantiene estados, extras, meses y notas', () => {
    expect(d.gastosBase.senal.estado).toBe('pagado');
    expect(d.gastosBase.comision.nota).toBe('x');
    expect(d.gastosExtra[0].importe).toBe(8000);
    expect(d.meses['2026-03'].ingresos[0].estado).toBe('pagado');
    expect(d.notas[0].texto).toBe('Llamar al banco');
    const t = totalesGastos(d);
    expect(t.pagado).toBe(200_000 + 600_000 + 8000);
  });
  it('la previsión mensual prorratea los anuales', () => {
    const m = mesPrevision(d);
    expect(m.ingresos[0].importe).toBe(70_000);
    expect(m.gastos.find((g) => g.concepto.startsWith('IBI'))!.importe).toBe(2000);
  });
  it('ida y vuelta con el formato propio', () => {
    const again = parseBackup(JSON.stringify(buildBackup(d)));
    expect(again.ok && again.data).toEqual(d);
  });
});

describe('errores de importación', () => {
  it('JSON inválido', () => expect(parseBackup('{').ok).toBe(false));
  it('formato desconocido', () => expect(parseBackup('{"a":1}').ok).toBe(false));
  it('datos corruptos', () => {
    const r = parseBackup(JSON.stringify({ app: 'piso-castellon', data: { piso: { precio: 'mucho' } } }));
    expect(r.ok).toBe(false);
  });
});

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 123456], ['1234,5', 123450], ['272.25', 27225], ['75.000', 7_500_000],
    ['', 0], ['12 €', 1200], ['-5', -500], ['abc', null], ['1.234.567', 123_456_700],
  ])('%s', (s, v) => expect(parseMoney(s)).toBe(v));
});
