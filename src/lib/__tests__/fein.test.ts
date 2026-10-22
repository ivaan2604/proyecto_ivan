import { describe, expect, it } from 'vitest';
import {
  aportacion, avisos, bolsilloReal, bonificacionHipoteca, calendarioDe, costesPrestamos, cuotaFamiliarMes, cuotaHipotecaMes,
  diaFirma, fasesResultado, fijosMensuales, interesesHipotecaAnio, irpfAlquiler, mesPrevision, patrimonio, previsionMensual,
  recuperacionPrevista, simularAmortizacion, sinReforma, totalesGastos,
  tramosHipoteca,
} from '../derive';
import { uid, type Seguro } from '../model';
import { validateAppData } from '../schema';

const seguro = (p: Partial<Seguro>): Seguro => ({
  id: uid(), tipo: 'hogar', nombre: '', aseguradora: 'Santander', primaAnual: 0, bonifPct: 0, elegido: false, contratado: false, nota: '', ...p,
});

/** La operación con la FEIN (15/10/2026), la previsión de fondos y tus 13.000 € antes que tus padres. */
function conFein() {
  return validateAppData({
    schemaVersion: 1,
    piso: { itpPct: 9, precio: 7500000, tipoVivienda: 'Vivienda de 1965', comunidadAutonoma: 'Comunidad Valenciana' },
    hitos: { arras: 450000, senal: 300000, arrasFecha: '2026-09-25', senalFecha: '2026-09-08', contratoFecha: '2026-09-14', actaFecha: '', escrituraFecha: '2026-11-20' },
    gastos: { notaria: 150045, reforma: 1000000, comision: 400000, gestoria: 42955, registro: 140090, tasacion: 27225, tasacionFecha: '2026-09-28' },
    familiar: { cuota: 80000, notas: '', tinPct: 0, importe: 1487900, recibido: false, primeraCuota: '', paraReforma: 0 },
    hipoteca: {
      banco: 'Santander', notas: '', tinPct: 4.29, tramoAMeses: 6, tramoATinPct: 3.29, bonifNominaPct: 0.5, nominaBizum: true, bonifMaxPct: 1,
      importe: 5379900, recibida: false, plazoAnios: 25, viabilidadFecha: '2026-09-28', provisional: false,
      fein: { taePct: 4.55, vinculaciones: '', fechaEmision: '2026-10-15', firmadaFecha: '', validaHasta: '2026-11-14', comisionAmortPct: 0 },
    },
    ahorros: { firma: 1300000 },
    seguros: [
      seguro({ nombre: 'Mi Hogar Esencial', primaAnual: 16120, elegido: true }),
      seguro({ nombre: 'Mi Hogar Integral', primaAnual: 38157, bonifPct: 0.2 }),
      seguro({ tipo: 'vida', nombre: 'Protección Familiar Plus', primaAnual: 8891, elegido: true }),
    ],
    gastosBase: {
      arras: { estado: 'pagado', nota: '', fecha: '' }, senal: { estado: 'pagado', nota: '', fecha: '' }, tasacion: { estado: 'pagado', nota: '', fecha: '' },
      notaria: { estado: 'pendiente', nota: '', fecha: '', provision: true, liquidacion: null },
    },
    gastosExtra: [{ id: 'x', concepto: 'Correo y comunicación plusvalía', fecha: '', importe: 9710, estado: 'pendiente', nota: '' }],
    recurrentes: { alquiler: 70000, ibiAnual: 30000, edificioAnual: 10000, inicioAlquiler: '2027-02-01', seguroVidaAnual: 0, seguroHogarAnual: 0, mantenimientoMensual: 0 },
  });
}

describe('hipoteca de la FEIN: 6 meses al 3,29 % y luego 4,29 % − rebaja', () => {
  it('con nómina + Bizum: 263,31 € y después 277,52 € (3,79 %)', () => {
    const t = tramosHipoteca(conFein());
    expect(t.cuotaA).toBe(26331);
    expect(t.tinB).toBeCloseTo(3.79);
    expect(t.cuotaB).toBe(27752);
  });
  it('sin rebaja 292,15 € y con la máxima 263,31 €', () => {
    const d = conFein();
    expect(tramosHipoteca(d, 0).cuotaB).toBe(29215);
    expect(tramosHipoteca(d, 1).cuotaB).toBe(26331);
  });
  it('la rebaja no pasa del máximo de la FEIN', () => {
    const d = conFein();
    const muchos = [seguro({ bonifPct: 0.3 }), seguro({ bonifPct: 0.3 })];
    expect(bonificacionHipoteca(d, muchos, true).total).toBe(1);
  });
  it('intereses con nómina + Bizum ≈ 29.372 €', () => {
    expect(Math.round(costesPrestamos(conFein())[0].intereses! / 100)).toBe(29372);
  });
  it('el cuadro de cuotas cambia de cuota al acabar el tramo inicial', () => {
    const d = conFein();
    d.cuotas.hipoteca = Array.from({ length: 8 }, (_, i) => ({ id: String(i), fecha: '', cuota: null, interes: null, anticipada: 0 }));
    const f = calendarioDe(d, 'hipoteca').filas;
    expect(f[5].cuota).toBe(26331);
    expect(Math.abs(f[6].cuota - 27752)).toBeLessThanOrEqual(1);
  });
  it('cuota por mes: diciembre de 2026 a mayo de 2027 en el tramo inicial', () => {
    const d = conFein();
    expect(cuotaHipotecaMes(d, '2026-11')).toBe(0);
    expect(cuotaHipotecaMes(d, '2026-12')).toBe(26331);
    expect(cuotaHipotecaMes(d, '2027-05')).toBe(26331);
    expect(cuotaHipotecaMes(d, '2027-06')).toBe(27752);
  });
});

describe('seguros en los gastos fijos', () => {
  it('solo cuentan los elegidos: 54,18 €/mes con hogar Esencial + vida', () => {
    expect(fijosMensuales(conFein())).toBe(5418);
  });
  it('los importes de seguro antiguos se pasan a la lista de seguros', () => {
    const d = validateAppData({ schemaVersion: 1, recurrentes: { seguroHogarAnual: 16120, seguroVidaAnual: 8891 } });
    expect(d.seguros.map((x) => [x.tipo, x.primaAnual, x.elegido])).toEqual([['hogar', 16120, true], ['vida', 8891, true]]);
    expect(d.recurrentes.seguroHogarAnual).toBe(0);
    expect(fijosMensuales(d)).toBe(Math.round(25011 / 12));
  });
  it('el mes nuevo lleva una línea de prorrateo por seguro elegido', () => {
    const m = mesPrevision(conFein(), '2027-03');
    expect(m.gastos.map((l) => l.concepto)).toEqual(expect.arrayContaining(['Mi Hogar Esencial (prorrateo)', 'Protección Familiar Plus (prorrateo)']));
  });
});

describe('el día de la firma, sin la reforma', () => {
  it('compra 89.450,25 €; pendiente 81.678 €; tus padres solo 14.879 €', () => {
    const d = conFein();
    expect(totalesGastos(sinReforma(d)).total).toBe(8945025);
    const f = diaFirma(d);
    expect(f.pendiente).toBe(8167800);
    expect(f.familiarNecesario).toBe(1487900);
    expect(f.falta).toBe(0);
  });
  it('la provisión liquidada sustituye a la provisional', () => {
    const d = conFein();
    d.gastosBase.notaria.liquidacion = 90000;
    expect(totalesGastos(d).total).toBe(9945025 - 150045 + 90000);
  });
});

describe('préstamo familiar de 14.879 €: 18 cuotas de 800 € y la última de 479 €', () => {
  it('cuota por mes', () => {
    const d = conFein();
    expect(cuotaFamiliarMes(d, '2026-12')).toBe(80000);
    expect(cuotaFamiliarMes(d, '2028-05')).toBe(80000);
    expect(cuotaFamiliarMes(d, '2028-06')).toBe(47900);
    expect(cuotaFamiliarMes(d, '2028-07')).toBe(0);
  });
});

describe('etapas y recuperación (sin reforma)', () => {
  const d = sinReforma(conFein());
  it('etapas: −1.117,49 · −417,49 · −431,70 · −110,70 · +368,30', () => {
    const f = fasesResultado(d);
    expect(f.map((x) => x.resultado)).toEqual([-111749, -41749, -43170, -11070, 36830]);
    expect(f.map((x) => x.meses)).toEqual([2, 4, 12, 1, null]);
    expect(f[4].desde).toBe('2028-07');
  });
  it('de tu sueldo 9.196,04 €; de tu bolsillo 29.968,29 €; lo recuperas en abril de 2035', () => {
    const ap = aportacion(d);
    expect(ap.entrada).toBe(2077225);
    expect(ap.sueldoTotal).toBe(919604);
    const r = recuperacionPrevista(d)!;
    expect(r.mes).toBe('2035-04');
    expect(ap.entrada + ap.sueldoTotal!).toBe(2996829);
  });
  it('la previsión empieza en diciembre de 2026', () => {
    expect(previsionMensual(d)![0].key).toBe('2026-12');
  });
});

describe('avisos de la FEIN', () => {
  it('la FEIN caduca antes de la firma prevista', () => {
    expect(avisos(conFein()).some((a) => a.id === 'fein-caduca')).toBe(true);
  });
  it('no se puede firmar dentro de los 10 días de reflexión', () => {
    const d = conFein();
    d.hitos.escrituraFecha = '2026-10-20';
    expect(avisos(d).some((a) => a.id === 'fein-reflexion')).toBe(true);
  });
});

describe('de tu bolsillo (real)', () => {
  it('lo pagado de la compra más los meses en negativo; los positivos lo devuelven', () => {
    const d = conFein();
    d.meses = {
      '2026-12': { ingresos: [], gastos: [{ id: 'a', concepto: 'x', importe: 100000, estado: 'pagado' }] },
      '2029-08': { ingresos: [{ id: 'b', concepto: 'Alquiler', importe: 70000, estado: 'pagado' }], gastos: [{ id: 'c', concepto: 'y', importe: 30000, estado: 'pagado' }] },
    };
    const b = bolsilloReal(d);
    expect(b.compra).toBe(777225);
    expect(b.mesesNegativos).toBe(100000);
    expect(b.aportado).toBe(877225);
    expect(b.devuelto).toBe(40000);
    expect(b.falta).toBe(837225);
  });
});

describe('compatibilidad entre versiones', () => {
  it('los campos que esta versión no conoce se conservan al validar', () => {
    const d = validateAppData({ schemaVersion: 1, campoFuturo: { a: 1 }, hipoteca: { otroFuturo: true } } as unknown);
    expect((d as unknown as Record<string, unknown>).campoFuturo).toEqual({ a: 1 });
    expect((d.hipoteca as unknown as Record<string, unknown>).otroFuturo).toBe(true);
  });
});

describe('patrimonio e IRPF', () => {
  it('al firmar: valor − hipoteca − préstamo familiar; al acabar la hipoteca, todo el valor', () => {
    const d = conFein();
    d.piso.valor = 7685634;
    const p = patrimonio(d);
    expect(p.puntos[0].neto).toBe(7685634 - 5379900 - 1487900);
    expect(p.puntos[p.puntos.length - 1].neto).toBe(7685634);
    expect(p.puntos[1].titulo).toBe('Al acabar con tus padres');
  });
  it('intereses del primer año de hipoteca ≈ 1.890 € y la cuota no negativa', () => {
    const d = conFein();
    d.hipoteca.tinPct = 3.79;
    d.hipoteca.nominaBizum = false;
    const i = interesesHipotecaAnio(d, 0);
    expect(Math.round(i / 10000)).toBe(19);
    const r = irpfAlquiler(d);
    expect(r.ingresos).toBe(840000);
    expect(r.cuota).toBeGreaterThanOrEqual(0);
    expect(r.base).toBe(r.neto - r.reduccion);
  });
});

describe('simulador de amortización', () => {
  const d = conFein();
  d.hipoteca.tinPct = 3.79;
  d.hipoteca.nominaBizum = false;
  it('sin amortizar: 300 cuotas e intereses ≈ 29.372 €', () => {
    const s = simularAmortizacion(d, { importe: 0, trasCuota: 1, cadaAnio: false, modo: 'plazo' });
    expect(s.meses).toBe(300);
    expect(Math.abs(s.intereses - costesPrestamos(d)[0].intereses!)).toBeLessThan(2000);
  });
  it('3.000 € en el año 2: reducir plazo ahorra más que reducir cuota', () => {
    const o = { importe: 300000, trasCuota: 24, cadaAnio: false };
    const sin = simularAmortizacion(d, { ...o, importe: 0, modo: 'plazo' });
    const p = simularAmortizacion(d, { ...o, modo: 'plazo' });
    const c = simularAmortizacion(d, { ...o, modo: 'cuota' });
    expect(p.meses).toBeLessThan(300);
    expect(c.meses).toBe(300);
    expect(c.cuotaFinal).toBeLessThan(27752);
    expect(sin.intereses - p.intereses).toBeGreaterThan(sin.intereses - c.intereses);
  });
});

describe('préstamo familiar con parte para la reforma', () => {
  it('«sin reforma» descuenta esa parte y la entrada vuelve a ser tu dinero real', () => {
    const d = conFein();
    d.familiar.importe = 2400000;
    d.familiar.paraReforma = 912100;
    const s = sinReforma(d);
    expect(s.familiar.importe).toBe(1487900);
    expect(aportacion(s).entrada).toBe(aportacion(sinReforma(conFein())).entrada);
  });
});
