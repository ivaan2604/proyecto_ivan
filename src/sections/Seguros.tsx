import { useMemo } from 'react';
import { bonificacionHipoteca, tramosHipoteca } from '../lib/derive';
import { fmtEur } from '../lib/format';
import { uid, type AppData, type Seguro, type TipoSeguro } from '../lib/model';
import { update, useData } from '../store';
import { useDialogs } from '../ui/dialogs';
import { MoneyInput, NumberInput, Segmented, TextInput } from '../ui/fields';
import { IconPlus, IconTrash } from '../ui/icons';
import { PageHead } from '../ui/layout';

const TIPOS: { tipo: TipoSeguro; nombre: string; ayuda: string }[] = [
  { tipo: 'hogar', nombre: 'Hogar', ayuda: 'La hipoteca exige el de incendio de la vivienda. Para un piso alquilado, mejor uno de propietario que alquila.' },
  { tipo: 'vida', nombre: 'Vida', ayuda: 'Opcional: la hipoteca no lo exige.' },
  { tipo: 'proteccion', nombre: 'Protección de préstamos', ayuda: 'Paga la hipoteca al banco si falleces o quedas inválido. Opcional.' },
  { tipo: 'otro', nombre: 'Otros (coche, salud…)', ayuda: 'Solo si ya los tienes o los ibas a contratar igualmente.' },
];

const pct = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;

interface Opcion {
  seguros: Seguro[];
  nomina: boolean;
  bonif: number;
  cuota: number;
  primas: number;
  anual: number;
  plazo: number;
  actual: boolean;
}

/**
 * Todas las combinaciones razonables: de cada tipo, una de sus opciones (o ninguna si ahora no tienes
 * ninguna elegida de ese tipo); los «otros», cada uno sí o no; con y sin nómina + Bizum.
 */
function combinaciones(d: AppData): Opcion[] {
  const grupos: Seguro[][][] = [];
  for (const { tipo } of TIPOS) {
    const de = d.seguros.filter((x) => x.tipo === tipo);
    if (!de.length) continue;
    if (tipo === 'otro') {
      de.forEach((x) => grupos.push(x.elegido ? [[x], []] : [[], [x]]));
    } else {
      const algunoElegido = de.some((x) => x.elegido);
      grupos.push([...de.map((x) => [x]), ...(algunoElegido ? [] : [[]])]);
    }
  }
  let combos: Seguro[][] = [[]];
  for (const g of grupos) combos = combos.flatMap((c) => g.map((o) => [...c, ...o])).slice(0, 400);
  const t0 = tramosHipoteca(d);
  const anios = d.hipoteca.plazoAnios;
  const elegidos = new Set(d.seguros.filter((x) => x.elegido).map((x) => x.id));
  const out: Opcion[] = [];
  for (const seguros of combos) {
    for (const nomina of [true, false]) {
      const bonif = bonificacionHipoteca(d, seguros, nomina).total;
      const t = tramosHipoteca(d, bonif);
      const primas = seguros.reduce((a, x) => a + x.primaAnual, 0);
      const actual = nomina === d.hipoteca.nominaBizum && seguros.length === elegidos.size && seguros.every((x) => elegidos.has(x.id));
      out.push({
        seguros, nomina, bonif, cuota: t.cuotaB, primas,
        anual: t.cuotaB * 12 + primas,
        plazo: t0.cuotaA * t.mesesA + t.cuotaB * (t.n - t.mesesA) + primas * anios,
        actual,
      });
    }
  }
  return out.sort((a, b) => a.plazo - b.plazo);
}

export function Seguros() {
  const d = useData();
  const { confirm, toast } = useDialogs();
  const opciones = useMemo(() => combinaciones(d), [d]);
  const mejor = opciones[0];
  const actual = opciones.find((o) => o.actual);
  const visibles = opciones.filter((o, i) => i < 6 || o.actual);

  const setSeguro = (id: string, patch: Partial<Seguro>) =>
    update((x) => {
      Object.assign(x.seguros.find((s) => s.id === id)!, patch);
    });
  const elegir = (s: Seguro) =>
    update((x) => {
      for (const o of x.seguros) {
        if (o.id === s.id) o.elegido = !s.elegido;
        else if (s.tipo !== 'otro' && o.tipo === s.tipo && !s.elegido) o.elegido = false;
      }
    });
  const add = (tipo: TipoSeguro) =>
    update((x) => {
      x.seguros.push({
        id: uid(), tipo, nombre: tipo === 'hogar' ? 'Seguro de hogar' : tipo === 'vida' ? 'Seguro de vida' : tipo === 'proteccion' ? 'Protección de préstamos' : 'Seguro',
        aseguradora: '', primaAnual: 0, bonifPct: 0, elegido: false, contratado: false, nota: '',
      });
    });
  const del = async (s: Seguro) => {
    if (await confirm({ title: `Eliminar «${s.nombre}»`, body: '¿Eliminar este seguro?', confirmText: 'Eliminar', danger: true })) {
      update((x) => void (x.seguros = x.seguros.filter((o) => o.id !== s.id)));
    }
  };
  const aplicar = (o: Opcion) => {
    const ids = new Set(o.seguros.map((x) => x.id));
    update((x) => {
      x.hipoteca.nominaBizum = o.nomina;
      for (const s of x.seguros) s.elegido = ids.has(s.id);
    });
    toast('Combinación elegida. Se ha recalculado la cuota y los gastos fijos.');
  };
  const nombreOpcion = (o: Opcion) =>
    [...o.seguros.map((x) => x.nombre), o.nomina ? 'nómina + Bizum' : 'sin nómina'].join(' · ') || 'Ninguno';

  return (
    <div className="page">
      <PageHead
        folio="07"
        title="Seguros"
        subtitle="Presupuestos y seguros contratados. Los elegidos cuentan en los gastos fijos del piso y, si dan rebaja, en el interés de la hipoteca."
      />

      <div className="grid">
        {TIPOS.map(({ tipo, nombre, ayuda }) => {
          const lista = d.seguros.filter((x) => x.tipo === tipo);
          return (
            <section key={tipo} className="card flush">
              <div className="card-head pad">
                <h2>{nombre}</h2>
                <button className="btn sm" onClick={() => add(tipo)}>
                  <IconPlus /> Añadir
                </button>
              </div>
              <p className="muted seg-ayuda">{ayuda}</p>
              {lista.length > 0 && (
                <div className="table-wrap">
                  <table className="ledger stack">
                    <thead>
                      <tr>
                        <th>Seguro</th>
                        <th>Aseguradora</th>
                        <th className="r">Prima anual</th>
                        <th className="r">Rebaja hipoteca</th>
                        <th>Estado</th>
                        <th />
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((s) => (
                        <tr key={s.id} className={s.elegido ? 'seg-elegido' : undefined}>
                          <td data-label="Seguro" style={{ minWidth: 170 }}>
                            <TextInput value={s.nombre} onChange={(v) => setSeguro(s.id, { nombre: v })} ariaLabel="Nombre" />
                          </td>
                          <td data-label="Aseguradora" style={{ minWidth: 120 }}>
                            <TextInput value={s.aseguradora} onChange={(v) => setSeguro(s.id, { aseguradora: v })} placeholder="—" ariaLabel="Aseguradora" />
                          </td>
                          <td className="amount" data-label="Prima anual" style={{ minWidth: 120 }}>
                            <MoneyInput value={s.primaAnual} onChange={(v) => setSeguro(s.id, { primaAnual: v })} ariaLabel="Prima anual" />
                          </td>
                          <td className="amount" data-label="Rebaja hipoteca" style={{ minWidth: 100 }}>
                            <NumberInput value={s.bonifPct} onChange={(v) => setSeguro(s.id, { bonifPct: Math.max(0, v) })} suffix="%" ariaLabel="Rebaja en la hipoteca" />
                          </td>
                          <td data-label="Estado">
                            <Segmented
                              value={s.contratado ? 'c' : 'p'}
                              options={[{ value: 'p', label: 'Presupuesto' }, { value: 'c', label: 'Contratado' }]}
                              onChange={(v) => setSeguro(s.id, { contratado: v === 'c' })}
                              ariaLabel="Estado del seguro"
                            />
                          </td>
                          <td>
                            <button className={`btn sm ${s.elegido ? 'primary' : ''}`} onClick={() => elegir(s)} aria-pressed={s.elegido}>
                              {s.elegido ? 'Elegido' : 'Elegir'}
                            </button>
                          </td>
                          <td className="row-actions">
                            <button className="icon-btn" aria-label={`Eliminar ${s.nombre}`} onClick={() => del(s)}>
                              <IconTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}

        <section className="card" aria-labelledby="h-comparar">
          <div className="card-head">
            <h2 id="h-comparar">¿Qué combinación sale más barata?</h2>
            <span className="hint">cuota de la hipoteca + seguros, de más barata a más cara</span>
          </div>
          {opciones.length === 0 || !d.hipoteca.importe ? (
            <div className="empty">Añade la hipoteca y algún seguro para comparar.</div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>Combinación</th>
                      <th className="r">Interés</th>
                      <th className="r">Cuota</th>
                      <th className="r">Seguros/año</th>
                      <th className="r">Total al año</th>
                      <th className="r">Total {d.hipoteca.plazoAnios} años</th>
                      <th className="r">Frente a la mejor</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((o) => (
                      <tr key={nombreOpcion(o)} className={o.actual ? 'seg-actual' : undefined}>
                        <td className="seg-combo">
                          {nombreOpcion(o)}
                          {o === mejor && <span className="chip pos mini">la más barata</span>}
                          {o.actual && <span className="chip cobalt mini">la tuya</span>}
                        </td>
                        <td className="amount">{pct(Math.max(0, d.hipoteca.tinPct - o.bonif))}</td>
                        <td className="amount">{fmtEur(o.cuota)}</td>
                        <td className="amount">{fmtEur(o.primas)}</td>
                        <td className="amount">{fmtEur(o.anual)}</td>
                        <td className="amount">{fmtEur(o.plazo)}</td>
                        <td className={`amount ${o.plazo > mejor.plazo ? 'neg' : 'pos'}`}>
                          {o.plazo > mejor.plazo ? `+${fmtEur(o.anual - mejor.anual)}/año` : '—'}
                        </td>
                        <td>
                          {!o.actual && (
                            <button className="btn sm ghost" onClick={() => aplicar(o)}>
                              Elegir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {actual && actual !== mejor && (
                <p className="rent-warn" style={{ marginTop: 14 }}>
                  Tu elección cuesta {fmtEur(actual.anual - mejor.anual)} más al año que la más barata ({fmtEur(actual.plazo - mejor.plazo)} en
                  toda la hipoteca).
                </p>
              )}
              <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
                Interés y cuota del tramo bonificable{tramosHipoteca(d).mesesA > 0 ? ` (después de los ${tramosHipoteca(d).mesesA} primeros meses)` : ''}.
                Un seguro solo rebaja si su prima cumple el mínimo de la FEIN: si no llega, deja su rebaja a 0. La rebaja total
                no pasa de {pct(d.hipoteca.bonifMaxPct)}. Supone que mantienes la combinación todo el plazo y los precios de hoy.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
