import { describe, expect, it } from 'vitest';
import { demoData } from '../../demo';
import { bolsilloReal, desgloseBolsillo, totalesReforma, fasesResultado, mesesOrdenados, totalesGastos } from '../derive';
import { validateAppData } from '../schema';

describe('datos de la demo', () => {
  it('son válidos y pasan la validación sin cambios', () => {
    const d = demoData();
    expect(validateAppData(d)).toEqual(d);
  });
  it('compra pagada, alquiler en marcha y meses registrados hasta octubre de 2026', () => {
    const d = demoData();
    expect(totalesGastos(d).pendiente).toBe(0);
    const meses = mesesOrdenados(d);
    expect(meses[0]).toBe('2025-04');
    expect(meses.at(-1)).toBe('2026-10');
    expect(d.meses['2025-05'].ingresos).toHaveLength(0);
    expect(d.meses['2025-06'].ingresos.map((l) => l.concepto)).toContain('Alquiler');
    expect(fasesResultado(d).length).toBeGreaterThan(0);
    expect(bolsilloReal(d).aportado).toBeGreaterThan(0);
  });
  it('el desglose de tu bolsillo suma lo mismo que la cifra principal', () => {
    const d = demoData();
    const { lineas, total } = desgloseBolsillo(d);
    expect(total).toBe(bolsilloReal(d).aportado);
    expect(lineas.map((l) => l.concepto)).toEqual(expect.arrayContaining(['Precio del piso pagado', 'Impuestos y gastos de compra']));
  });
});

describe('partida de reforma abierta', () => {
  it('su presupuesto es lo que suman los pagos: sin desviación ni resto pendiente', () => {
    const d = demoData();
    d.reforma.partidas = [{
      id: 'm', concepto: 'Materiales', presupuesto: 100, abierta: true, tipo: 'mejora',
      pagos: [
        { id: 'a', fecha: '2026-11-26', importe: 26176, estado: 'pagado', factura: '', nota: '' },
        { id: 'b', fecha: '2026-11-26', importe: 148992, estado: 'pagado', factura: '', nota: '' },
      ],
    }];
    const suma = 175168;
    const t = totalesReforma(d).partidas[0];
    expect(t.presupuesto).toBe(suma);
    expect(t.desviacion).toBe(0);
    expect(totalesGastos(d).pendiente).toBe(0);
    expect(validateAppData(d)).toEqual(d);
  });
});
