import { describe, expect, it } from 'vitest';
import { dineroPropio, filasGastos, mesPrevision, rentabilidad, seguimientoGlobal, totalesGastos, totalesReforma } from '../derive';
import { emptyData, type AppData, type Mes } from '../model';
import { validateAppData } from '../schema';

function compra(): AppData {
  const d = emptyData();
  d.piso.precio = 10_000_000; // 100.000 €
  d.piso.itpPct = 10;
  d.hitos.senal = 500_000;
  d.hitos.arras = 500_000;
  d.hipoteca.importe = 6_000_000;
  d.familiar.importe = 2_000_000;
  for (const k of ['senal', 'arras', 'restoPrecio', 'itp'] as const) d.gastosBase[k].estado = 'pagado';
  return d;
}

const mes = (ingreso: number, gasto: number): Mes => ({
  ingresos: ingreso ? [{ id: 'i', concepto: 'Alquiler', importe: ingreso, estado: 'pagado' }] : [],
  gastos: [{ id: 'g', concepto: 'Cuotas', importe: gasto, estado: 'pagado' }],
});

describe('dinero propio', () => {
  it('sin préstamos recibidos, todo lo pagado es propio', () => {
    const d = compra();
    expect(dineroPropio(d).propio).toBe(totalesGastos(d).pagado);
  });
  it('resta lo pagado con los préstamos recibidos', () => {
    const d = compra();
    d.hipoteca.recibida = true;
    d.familiar.recibido = true;
    // pagado = 100.000 + 10.000 ITP = 110.000; financiado 80.000 → propio 30.000
    expect(dineroPropio(d)).toMatchObject({ pagado: 11_000_000, financiado: 8_000_000, propio: 3_000_000 });
  });
  it('nunca es negativo si se ha recibido más de lo pagado', () => {
    const d = emptyData();
    d.hipoteca.importe = 6_000_000;
    d.hipoteca.recibida = true;
    expect(dineroPropio(d).propio).toBe(0);
  });
  it('los datos antiguos con el resto del precio pagado se migran como préstamos recibidos', () => {
    const d = compra() as unknown as Record<string, Record<string, unknown>>;
    delete d.hipoteca.recibida;
    delete d.familiar.recibido;
    const v = validateAppData(d);
    expect(v.hipoteca.recibida).toBe(true);
    expect(v.familiar.recibido).toBe(true);
  });
});

describe('inicio del alquiler', () => {
  it('los meses anteriores son coste de la espera y se suman a lo invertido', () => {
    const d = compra();
    d.recurrentes.inicioAlquiler = '2025-03-01';
    d.meses['2025-01'] = mes(0, 40_000);
    d.meses['2025-02'] = mes(0, 40_000);
    d.meses['2025-03'] = mes(80_000, 40_000);
    const s = seguimientoGlobal(d);
    expect(s.costeEspera).toBe(80_000);
    expect(s.mesesEspera).toBe(2);
    expect(s.invertido).toBe(s.propio + 80_000);
    expect(s.serie.map((p) => p.key)).toEqual(['2025-03']);
    expect(s.beneficio).toBe(40_000);
  });
  it('la rentabilidad sobre el dinero propio solo usa meses de alquiler', () => {
    const d = compra();
    d.recurrentes.inicioAlquiler = '2025-03-01';
    d.meses['2025-01'] = mes(0, 40_000);
    d.meses['2025-03'] = mes(80_000, 40_000);
    const r = rentabilidad(d);
    expect(r.mesesConDatos).toBe(1);
    expect(r.beneficioAnual).toBe(40_000 * 12);
    expect(r.capitalPropio).toBe(r.dineroPropio + 40_000);
  });
  it('con el alquiler en el futuro está en reforma y no calcula la rentabilidad', () => {
    const d = compra();
    d.recurrentes.inicioAlquiler = '2099-01-01';
    d.meses['2025-01'] = mes(0, 40_000);
    const r = rentabilidad(d);
    expect(r.enReforma).toBe(true);
    expect(r.beneficioAnual).toBeNull();
    expect(r.costeEspera).toBe(40_000);
  });
  it('un mes nuevo antes del inicio no lleva la línea de alquiler', () => {
    const d = compra();
    d.recurrentes.alquiler = 80_000;
    d.recurrentes.inicioAlquiler = '2025-03-15';
    expect(mesPrevision(d, '2025-02').ingresos).toHaveLength(0);
    expect(mesPrevision(d, '2025-03').ingresos).toHaveLength(1);
  });
});

describe('reforma por partidas', () => {
  function conReforma(): AppData {
    const d = compra();
    d.gastos.reforma = 1_000_000; // se ignora al haber partidas
    d.reforma.partidas = [
      {
        id: 'coc', concepto: 'Cocina', presupuesto: 800_000, tipo: 'mejora',
        pagos: [
          { id: 'p1', fecha: '2025-01-10', importe: 300_000, estado: 'pagado', factura: 'F-1', nota: '' },
          { id: 'p2', fecha: '2025-02-10', importe: 600_000, estado: 'pendiente', factura: '', nota: '' },
        ],
      },
      { id: 'pin', concepto: 'Pintura', presupuesto: 200_000, tipo: 'reparacion', pagos: [] },
    ];
    return d;
  }
  it('totales, pendiente y desviación', () => {
    const t = totalesReforma(conReforma());
    expect(t.presupuesto).toBe(1_000_000);
    expect(t.pagado).toBe(300_000);
    expect(t.previsto).toBe(900_000 + 200_000); // cocina supera su presupuesto
    expect(t.desviacion).toBe(100_000);
    expect(t.pendiente).toBe(1_100_000 - 300_000);
    expect(t.mejora).toBe(900_000);
    expect(t.reparacion).toBe(200_000);
  });
  it('sustituye al importe único en los gastos de compra', () => {
    const d = conReforma();
    const filas = filasGastos(d);
    expect(filas.some((f) => f.key === 'reforma')).toBe(false);
    const ref = filas.filter((f) => f.reforma);
    expect(ref.map((f) => f.importe)).toEqual([300_000, 600_000, 200_000]);
    const g = totalesGastos(d);
    const sinReforma = totalesGastos({ ...d, reforma: { partidas: [] }, gastos: { ...d.gastos, reforma: 0 } });
    expect(g.total - sinReforma.total).toBe(1_100_000);
    expect(g.pagado - sinReforma.pagado).toBe(300_000);
  });
  it('lo pagado de la reforma cuenta como dinero propio', () => {
    const d = conReforma();
    const sin = dineroPropio({ ...d, reforma: { partidas: [] } }).propio;
    expect(dineroPropio(d).propio - sin).toBe(300_000);
  });
});
