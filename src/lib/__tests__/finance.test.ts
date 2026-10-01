import { describe, expect, it } from 'vitest';
import { addMonths, calendario, mesesRestantes, pmt } from '../finance';
import type { Cuota } from '../model';

const c = (over: Partial<Cuota> = {}): Cuota => ({ id: Math.random().toString(), fecha: '2027-01-01', cuota: null, interes: null, anticipada: 0, ...over });

describe('pmt', () => {
  it('calcula la cuota francesa', () => {
    // 60.000 € a 25 años al 2,57 % → 271,29 €
    expect(pmt(6_000_000, 2.57, 25)).toBe(27129);
    expect(pmt(10_000_000, 3, 30)).toBe(42160);
  });
  it('sin interés reparte el capital', () => {
    expect(pmt(1_200_000, 0, 1)).toBe(100_000);
  });
  it('devuelve 0 con datos vacíos', () => {
    expect(pmt(0, 3, 25)).toBe(0);
    expect(pmt(1000, 3, 0)).toBe(0);
  });
});

describe('calendario', () => {
  it('primera cuota: interés = pendiente × r', () => {
    const cal = calendario(6_000_000, 2.57, 27129, [c()]);
    const f = cal.filas[0];
    expect(f.interes).toBe(12850); // 60000 × 0,0257/12 = 128,50
    expect(f.capital).toBe(27129 - 12850);
    expect(f.pendiente).toBe(6_000_000 - (27129 - 12850));
  });

  it('la amortización anticipada reduce plazo y mantiene la cuota', () => {
    const cal = calendario(6_000_000, 2.57, 27129, [c(), c({ anticipada: 500_000 }), c()]);
    expect(cal.filas[2].cuota).toBe(27129);
    expect(cal.filas[1].pendiente).toBe(cal.filas[0].pendiente - cal.filas[1].capital - 500_000);
    const sin = mesesRestantes(6_000_000, 2.57, 27129)!;
    const con = mesesRestantes(cal.pendiente, 2.57, 27129)!;
    expect(sin).toBe(300);
    expect(con).toBeLessThan(300 - 3);
  });

  it('préstamo sin interés y cuotas a 0 tras liquidarse', () => {
    const cal = calendario(50_000, 0, 20_000, [c(), c(), c(), c(), c()]);
    expect(cal.filas.map((f) => f.cuota)).toEqual([20_000, 20_000, 10_000, 0, 0]);
    expect(cal.filas.map((f) => f.pendiente)).toEqual([30_000, 10_000, 0, 0, 0]);
    expect(cal.filas[3].liquidado).toBe(true);
    expect(cal.totalIntereses).toBe(0);
  });

  it('una anticipada mayor que el pendiente lo deja a 0, no negativo', () => {
    const cal = calendario(50_000, 0, 20_000, [c({ anticipada: 999_999 }), c()]);
    expect(cal.filas[0].anticipada).toBe(30_000);
    expect(cal.filas[0].pendiente).toBe(0);
    expect(cal.filas[1].cuota).toBe(0);
  });

  it('respeta cuota e interés introducidos a mano', () => {
    const cal = calendario(6_000_000, 2.57, 27129, [c({ cuota: 30000, interes: 12000 })]);
    expect(cal.filas[0].capital).toBe(18000);
    expect(cal.totalIntereses).toBe(12000);
  });
});

describe('addMonths', () => {
  it('cruza años', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});
