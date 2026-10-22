import { describe, expect, it } from 'vitest';
import {
  aportacion, avisos, capitalHipotecaMes, costesPrestamos, cuotaHipotecaPrevista, fasesResultado, fijosMensuales, finPrestamoFamiliar,
  mesPrevision, recuperacionPrevista, rentabilidad, totalesGastos,
} from '../derive';
import { mesesRestantes } from '../finance';
import { validateAppData } from '../schema';

/** Los datos reales de la operación (octubre de 2026), con las correcciones de la FEIN. */
function real() {
  return validateAppData({
    schemaVersion: 1,
    piso: { itpPct: 9, precio: 7500000, tipoVivienda: 'Vivienda de 1965', comunidadAutonoma: 'Comunidad Valenciana' },
    hitos: { arras: 450000, senal: 300000, arrasFecha: '2026-09-25', senalFecha: '2026-09-08', contratoFecha: '2026-09-14', actaFecha: '', escrituraFecha: '' },
    gastos: { notaria: 70000, reforma: 1000000, comision: 400000, gestoria: 30000, registro: 40000, tasacion: 27225, tasacionFecha: '2026-09-28' },
    familiar: { cuota: 80000, notas: '', tinPct: 0, importe: 2400000, recibido: false, primeraCuota: '', paraReforma: 0 },
    hipoteca: {
      banco: 'Santander', notas: 'Provisional, pendiente de FEIN. Importe sujeto a la tasación de 76.500 €', tinPct: 3.09,
      importe: 5379900, recibida: false, plazoAnios: 25, viabilidadFecha: '2026-09-28', provisional: true,
    },
    gastosBase: { arras: { estado: 'pagado', nota: '', fecha: '' }, senal: { estado: 'pagado', nota: '', fecha: '' }, tasacion: { estado: 'pagado', nota: '', fecha: '' } },
    recurrentes: { alquiler: 70000, ibiAnual: 30000, edificioAnual: 10000, inicioAlquiler: '', seguroVidaAnual: 8891, seguroHogarAnual: 16120, mantenimientoMensual: 0 },
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
  it('gastos de compra 97.422,25 € con 7.772,25 € pagados; entrada de tu bolsillo 19.623,25 €', () => {
    const d = real();
    const g = totalesGastos(d);
    expect(g.total).toBe(9742225);
    expect(g.pagado).toBe(777225);
    const ap = aportacion(d);
    expect(ap.entrada).toBe(9742225 - 5379900 - 2400000);
    expect(ap.pagado).toBe(777225);
    expect(ap.quedan).toBe(9742225 - 5379900 - 2400000 - 777225); // 11.851 €
  });
  it('lo que queda de la entrada baja al marcar como pagado algo de tu bolsillo', () => {
    const d = real();
    d.gastosBase.notaria.estado = 'pagado';
    expect(aportacion(d).quedan).toBe(9742225 - 5379900 - 2400000 - 777225 - 70000);
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

/** Con fechas de ejemplo: escritura el 20/11/2026 y alquiler desde el 01/03/2027. */
function conFechas() {
  const d = real();
  d.hitos.escrituraFecha = '2026-11-20';
  d.recurrentes.inicioAlquiler = '2027-03-01';
  return d;
}

describe('meses nuevos según la fase', () => {
  const conceptos = (d: ReturnType<typeof real>, k: string) => mesPrevision(d, k).gastos.map((l) => l.vinculo ?? l.concepto);
  it('antes de la escritura no se proponen cuotas', () => {
    expect(conceptos(conFechas(), '2026-11')).not.toContain('hipoteca');
    expect(conceptos(conFechas(), '2026-11')).not.toContain('familiar');
  });
  it('desde el mes siguiente a la escritura, las dos cuotas, enlazadas a su préstamo', () => {
    expect(conceptos(conFechas(), '2026-12')).toEqual(expect.arrayContaining(['hipoteca', 'familiar']));
  });
  it('tras la cuota 30 ya no se propone la del préstamo familiar', () => {
    expect(conceptos(conFechas(), '2029-05')).toContain('familiar');
    expect(conceptos(conFechas(), '2029-06')).not.toContain('familiar');
  });
  it('sin fecha de escritura no se propone ninguna cuota', () => {
    expect(conceptos(real(), '2027-01')).not.toContain('hipoteca');
  });
  it('sin fecha de escritura el mes nuevo sale vacío: ni gastos fijos ni alquiler', () => {
    const m = mesPrevision(real(), '2026-10');
    expect(m.gastos).toHaveLength(0);
    expect(m.ingresos).toHaveLength(0);
  });
  it('antes del mes de la escritura, vacío; desde ese mes, los gastos fijos', () => {
    expect(mesPrevision(conFechas(), '2026-10').gastos).toHaveLength(0);
    expect(conceptos(conFechas(), '2026-11')).toContain('IBI (prorrateo)');
  });
  it('sin fecha de inicio del alquiler no se propone el alquiler', () => {
    const d = conFechas();
    d.recurrentes.inicioAlquiler = '';
    expect(mesPrevision(d, '2027-06').ingresos).toHaveLength(0);
  });
  it('la primera cuota a la familia puede ir más tarde que la escritura', () => {
    const d = conFechas();
    d.familiar.primeraCuota = '2027-03-01';
    expect(conceptos(d, '2027-02')).not.toContain('familiar');
    expect(finPrestamoFamiliar(d)).toBe('2029-08');
  });
});

describe('lo que sale de tu sueldo', () => {
  it('sin fechas: 1.111,83 €/mes antes de alquilar y 411,83 €/mes devolviendo; sin total', () => {
    const ap = aportacion(real());
    expect(ap.etapas.map((e) => e.resultado)).toEqual([-111183, -41183, 38817]);
    expect(ap.etapas[0].meses).toBeNull();
    expect(ap.sueldoTotal).toBeNull();
  });
  it('con fechas: 3 meses de espera y 27 devolviendo; total del sueldo hasta que el piso se paga solo', () => {
    const ap = aportacion(conFechas());
    expect(ap.etapas[0].meses).toBe(3);
    expect(ap.etapas[1].meses).toBe(27);
    expect(ap.sueldoTotal).toBe(3 * 111183 + 27 * 41183); // ≈ 14.455 €
  });
});

describe('recuperación prevista', () => {
  it('recupera lo invertido con el +388 €/mes de la etapa 3', () => {
    const r = recuperacionPrevista(conFechas())!;
    expect(r.invertido).toBe(9742225 - 5379900 - 2400000 + 3 * 111183);
    expect(r.mesesDesdeAlquiler).toBe(27 + 88);
    expect(r.mes).toBe('2036-09');
  });
  it('sin fechas no hay previsión', () => {
    expect(recuperacionPrevista(real())).toBeNull();
  });
});

describe('resultado económico', () => {
  it('la cuota familiar sin interés es toda capital: devolviendo, la caja es negativa pero el patrimonio crece', () => {
    const d = conFechas();
    const [, devolviendo] = fasesResultado(d);
    const capHip = capitalHipotecaMes(d, '2027-03');
    expect(capHip).toBeGreaterThan(11_000); // ≈ 120 € de capital en las primeras cuotas
    expect(capHip).toBeLessThan(13_000);
    expect(devolviendo.capital).toBe(capHip + 80000);
    expect(devolviendo.economico).toBe(devolviendo.resultado + capHip + 80000);
    expect(devolviendo.economico).toBeGreaterThan(0);
  });
});

describe('mes nuevo cuadra con las fases', () => {
  it('la suma de las líneas de un mes de espera coincide con la etapa 1 (−1.111,83 €)', () => {
    const d = conFechas();
    const m = mesPrevision(d, '2026-12');
    const total = m.gastos.reduce((a, l) => a + l.importe, 0) - m.ingresos.reduce((a, l) => a + l.importe, 0);
    expect(-total).toBe(fasesResultado(d)[0].resultado);
  });
});
