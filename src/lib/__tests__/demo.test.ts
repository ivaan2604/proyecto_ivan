import { describe, expect, it } from 'vitest';
import { demoData } from '../../demo';
import { bolsilloReal, fasesResultado, mesesOrdenados, totalesGastos } from '../derive';
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
});
