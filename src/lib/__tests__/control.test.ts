import { describe, expect, it } from 'vitest';
import { avisos, costesPrestamos, cuotaHipotecaPrevista, fasesResultado, fijosMensuales, finPrestamoFamiliar, rentabilidad, sobraFalta, totalesGastos } from '../derive';
import { mesesRestantes } from '../finance';
import { validateAppData } from '../schema';

/** Los datos reales de la operación (octubre de 2026), con las correcciones de la FEIN. */
function real() {
  return validateAppData({
    schemaVersion: 1,
    piso: { itpPct: 9, precio: 7500000, tipoVivienda: 'Vivienda de 1965', comunidadAutonoma: 'Comunidad Valenciana' },
    hitos: { arras: 450000, senal: 300000, arrasFecha: '2026-09-25', senalFecha: '2026-09-08', contratoFecha: '2026-09-14', escrituraFecha: '' },
    gastos: { notaria: 70000, reforma: 1000000, comision: 400000, gestoria: 30000, registro: 40000, tasacion: 27225, tasacionFecha: '2026-09-28' },
    familiar: { cuota: 80000, notas: '', tinPct: 0, importe: 2400000, recibido: false },
    hipoteca: {
      banco: 'Santander', notas: 'Provisional, pendiente de FEIN. Importe sujeto a la tasación de 76.500 €', tinPct: 3.09,
      importe: 5379900, recibida: false, plazoAnios: 25, viabilidadFecha: '2026-09-28', provisional: true,
    },
    gastosBase: { arras: { estado: 'pagado', nota: '', fecha: '' }, senal: { estado: 'pagado', nota: '', fecha: '' }, tasacion: { estado: 'pagado', nota: '', fecha: '' } },
    recurrentes: { alquiler: 70000, ibiAnual: 30000, edificioAnual: 10000, inicioAlquiler: '', seguroVidaAnual: 8891, seguroHogarAnual: 16120, mantenimientoMensual: 0 },
    ahorros: { paraCompra: 777225 + 1250000 },
  });
}

describe('cifras de control (mantenimiento a 0 €)', () => {
  it('hipoteca: 257,65 €/mes y ≈ 23.496 € de intereses sin amortizar', () => {
    const d = real();
    expect(cuotaHipotecaPrevista(d)).toBe(25765);
    expect(Math.round(costesPrestamos(d)[0].intereses! / 100)).toBe(23496);
  });
  it('préstamo familiar: 800 €/mes sin interés = 30 cuotas exactas', () => {
    const d = real();
    expect(mesesRestantes(d.familiar.importe, 0, d.familiar.cuota)).toBe(30);
    expect(costesPrestamos(d)[1].meses).toBe(30);
  });
  it('gastos fijos ≈ 54,18 €/mes (650,11 € al año)', () => {
    expect(fijosMensuales(real())).toBe(5418);
  });
  it('fases: ≈ −1.112, ≈ −412 y ≈ +388 €/mes', () => {
    const [espera, devolviendo, libre] = fasesResultado(real());
    expect(espera.resultado).toBe(-(25765 + 5418 + 80000)); // −1.111,83
    expect(Math.round(espera.resultado / 100)).toBe(-1112);
    expect(Math.round(devolviendo.resultado / 100)).toBe(-412);
    expect(Math.round(libre.resultado / 100)).toBe(388);
  });
  it('fin del préstamo familiar: 30 meses después de la escritura', () => {
    const d = real();
    expect(finPrestamoFamiliar(d)).toBeNull(); // sin fecha de escritura
    d.hitos.escrituraFecha = '2026-11-20';
    expect(finPrestamoFamiliar(d)).toBe('2029-05');
    expect(fasesResultado(d)[2].desde).toBe('2029-06');
  });
  it('gastos de compra 97.422,25 € con 7.772,25 € pagados; sobran ≈ 650 €', () => {
    const d = real();
    const g = totalesGastos(d);
    expect(g.total).toBe(9742225);
    expect(g.pagado).toBe(777225);
    const s = sobraFalta(d);
    expect(s.ahorrosQuedan).toBe(1250000);
    expect(s.saldo).toBe(5379900 + 2400000 + 1250000 - 8965000); // +649 €
    expect(Math.round(s.saldo / 100)).toBe(649);
  });
  it('los ahorros que quedan bajan al marcar como pagado algo pagado de tu bolsillo; el saldo no cambia', () => {
    const d = real();
    const antes = sobraFalta(d).saldo;
    d.gastosBase.notaria.estado = 'pagado';
    const s = sobraFalta(d);
    expect(s.ahorrosQuedan).toBe(1250000 - 70000);
    expect(s.saldo).toBe(antes);
  });
  it('rentabilidad teórica del piso sin maquillar: bruta 8,62 % y neta 7,95 %', () => {
    const r = rentabilidad(real());
    expect(r.brutaPct!).toBeCloseTo(8.622, 2);
    expect(r.netaPct!).toBeCloseTo(7.955, 2);
  });
  it('avisos: FEIN pendiente y reforma sin desglosar; ninguno de mantenimiento ni de comisión', () => {
    const ids = avisos(real()).map((a) => a.id);
    expect(ids).toContain('fein');
    expect(ids).toContain('reforma-sin-desglosar');
    expect(ids).not.toContain('hipoteca-notas');
    expect(ids.some((i) => /manten|comisi/.test(i))).toBe(false);
  });
});

describe('comisión por amortización anticipada', () => {
  const conAmortizacion = (pct: number) => {
    const d = real();
    d.hipoteca.fein.comisionAmortPct = pct;
    d.cuotas.hipoteca = [{ id: '1', fecha: '2027-01-01', cuota: null, interes: null, anticipada: 1_000_000 }];
    return rentabilidad(d);
  };
  it('con 0 % (confirmado por el banco) no descuenta nada del ahorro', () => {
    const r = conAmortizacion(0);
    expect(r.comisionesAmort).toBe(0);
    expect(r.ahorro).toBe(r.intereses - r.interesesConAmort);
  });
  it('si la FEIN fija una comisión, se resta del ahorro y se suma al coste', () => {
    const r0 = conAmortizacion(0);
    const r1 = conAmortizacion(1);
    expect(r1.comisionesAmort).toBe(10_000); // 1 % de 10.000 €
    expect(r1.ahorro).toBe(r0.ahorro - 10_000);
    expect(r1.costeTotalConAmort).toBe(r0.costeTotalConAmort + 10_000);
  });
});
