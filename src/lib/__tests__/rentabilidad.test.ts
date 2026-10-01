import { describe, expect, it } from 'vitest';
import { rentabilidad } from '../derive';
import { emptyData, type AppData, type Mes } from '../model';

function base(): AppData {
  const d = emptyData();
  d.piso.precio = 10_000_000; // 100.000 €
  d.piso.itpPct = 10; // ITP 10.000 €
  d.gastos.notaria = 100_000; // 1.000 €
  d.hipoteca.importe = 6_000_000;
  d.hipoteca.plazoAnios = 25;
  d.hipoteca.tinPct = 2.57; // cuota 271,29 €
  d.recurrentes.alquiler = 80_000; // 800 €/mes
  d.recurrentes.ibiAnual = 30_000;
  d.recurrentes.seguroHogarAnual = 20_000;
  d.recurrentes.mantenimientoMensual = 5_000;
  return d;
}

const mes = (ingreso: number, gasto: number): Mes => ({
  ingresos: [{ id: 'i', concepto: 'Alquiler', importe: ingreso, estado: 'pagado' }],
  gastos: [{ id: 'g', concepto: 'Gastos', importe: gasto, estado: 'pagado' }],
});

describe('rentabilidad', () => {
  it('coste total = gastos de compra + intereses de la hipoteca en toda su vida', () => {
    const r = rentabilidad(base());
    expect(r.gastosCompra).toBe(11_100_000);
    expect(r.prestamos[0].total).toBe(27129 * 300);
    expect(r.prestamos[0].intereses).toBe(27129 * 300 - 6_000_000);
    expect(r.prestamos[1].intereses).toBe(0); // familiar sin interés
    expect(r.costeTotal).toBe(11_100_000 + 27129 * 300 - 6_000_000);
  });

  it('rentabilidad bruta y neta sobre la inversión del activo (sin sumar dos veces el precio)', () => {
    const r = rentabilidad(base());
    expect(r.inversionActivo).toBe(11_100_000);
    expect(r.brutaPct).toBeCloseTo((960_000 / 11_100_000) * 100, 6);
    expect(r.gastosRecurrentesAnuales).toBe(30_000 + 20_000 + 60_000);
    expect(r.netaPct).toBeCloseTo(((960_000 - 110_000) / 11_100_000) * 100, 6);
  });

  it('sin meses no calcula la rentabilidad sobre el dinero propio', () => {
    const r = rentabilidad(base());
    expect(r.beneficioAnual).toBeNull();
    expect(r.cashOnCashPct).toBeNull();
  });

  it('con menos de 12 meses anualiza el promedio y lo marca como proyección', () => {
    const d = base();
    d.gastosBase.senal.estado = 'pagado';
    d.hitos.senal = 2_000_000;
    d.meses['2025-01'] = mes(80_000, 50_000);
    d.meses['2025-02'] = mes(80_000, 30_000);
    d.meses['2099-01'] = mes(80_000, 0); // mes futuro: no cuenta
    const r = rentabilidad(d);
    expect(r.mesesConDatos).toBe(2);
    expect(r.proyectado).toBe(true);
    expect(r.beneficioAnual).toBe(40_000 * 12);
    expect(r.cashOnCashPct).toBeCloseTo((480_000 / 2_000_000) * 100, 6);
  });

  it('con 12 meses o más usa los últimos 12', () => {
    const d = base();
    for (let m = 1; m <= 12; m++) d.meses[`2024-${String(m).padStart(2, '0')}`] = mes(80_000, 0);
    d.meses['2025-01'] = mes(10_000, 0);
    const r = rentabilidad(d);
    expect(r.proyectado).toBe(false);
    expect(r.beneficioAnual).toBe(11 * 80_000 + 10_000);
  });

  it('préstamo familiar con interés: suma los intereses hasta liquidarlo', () => {
    const d = base();
    d.familiar.importe = 1_200_000;
    d.familiar.cuota = 100_000;
    d.familiar.tinPct = 0;
    expect(rentabilidad(d).prestamos[1].intereses).toBe(0);
    d.familiar.tinPct = 3;
    const p = rentabilidad(d).prestamos[1];
    expect(p.meses).toBe(13);
    // 12.000 € al 3 % pagando 1.000 €/mes: intereses ≈ 199 € (no 1.000 € de una 13ª cuota entera)
    expect(p.intereses).toBeGreaterThan(19_000);
    expect(p.intereses).toBeLessThan(21_000);
    expect(p.total).toBe(1_200_000 + p.intereses!);
  });

  it('sin amortizaciones el coste con amortizaciones es el mismo y el ahorro 0', () => {
    const r = rentabilidad(base());
    expect(r.hayAmortizaciones).toBe(false);
    expect(r.costeTotalConAmort).toBe(r.costeTotal);
    expect(r.ahorro).toBe(0);
  });

  it('una amortización anticipada reduce los intereses totales y el plazo', () => {
    const d = base();
    d.cuotas.hipoteca = [
      { id: '1', fecha: '2026-01-01', cuota: null, interes: null, anticipada: 0 },
      { id: '2', fecha: '2026-02-01', cuota: null, interes: null, anticipada: 1_000_000 }, // 10.000 €
    ];
    const r = rentabilidad(d);
    const h = r.prestamos[0];
    expect(r.hayAmortizaciones).toBe(true);
    expect(h.anticipado).toBe(1_000_000);
    expect(h.interesesConAmort!).toBeLessThan(h.intereses!);
    expect(h.mesesAhorro!).toBeGreaterThan(0);
    expect(r.ahorro).toBe(h.intereses! - h.interesesConAmort!);
    expect(r.costeTotalConAmort).toBe(r.costeTotal - r.ahorro);
    // 10.000 € amortizados en el mes 2 de 300 al 2,57 %: el ahorro debe ser de varios miles de euros
    expect(r.ahorro).toBeGreaterThan(500_000);
    expect(r.ahorro).toBeLessThan(1_000_000);
  });

  it('amortizar más ahorra más', () => {
    const mk = (a: number) => {
      const d = base();
      d.cuotas.hipoteca = [{ id: '1', fecha: '2026-01-01', cuota: null, interes: null, anticipada: a }];
      return rentabilidad(d).ahorro;
    };
    expect(mk(2_000_000)).toBeGreaterThan(mk(1_000_000));
  });
});
