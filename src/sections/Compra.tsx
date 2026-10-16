import {
  aportacion, costesPrestamos, diaFirma, sinReforma, fijosMensuales, importeBase, segurosAnuales,
  totalesReforma, tramosHipoteca,
} from '../lib/derive';
import { fmtEur } from '../lib/format';
import { uid, type AppData } from '../lib/model';
import { IconPlus, IconTrash } from '../ui/icons';
import { update, useData } from '../store';
import { DateInput, Field, MoneyInput, NumberInput, Segmented, TextArea, TextInput } from '../ui/fields';
import { go } from '../router';
import { PageHead } from '../ui/layout';

type Sec = keyof Pick<AppData, 'piso' | 'hitos' | 'gastos' | 'hipoteca' | 'familiar' | 'recurrentes' | 'ahorros'>;

/** Setter tipado para un campo de una subsección */
function set<S extends Sec, K extends keyof AppData[S]>(sec: S, key: K) {
  return (v: AppData[S][K]) =>
    update((d) => {
      d[sec][key] = v;
    });
}

export function Compra() {
  const d = useData();
  const t = tramosHipoteca(d);
  const cuota = t.cuotaB;
  const costeHip = costesPrestamos(d)[0];
  const firma = diaFirma(d);
  const reformaTotal = d.reforma.partidas.length ? totalesReforma(d).previsto : d.gastos.reforma;
  const setSeguro = (id: string, patch: { nombre?: string; primaAnual?: number }) =>
    update((x) => void Object.assign(x.seguros.find((s) => s.id === id)!, patch));
  const quitarSeguro = (id: string) => update((x) => void (x.seguros = x.seguros.filter((s) => s.id !== id)));
  const addSeguro = () =>
    update((x) => {
      x.seguros.push({ id: uid(), tipo: 'otro', nombre: 'Seguro', aseguradora: '', primaAnual: 0, bonifPct: 0, elegido: true, contratado: false, nota: '' });
    });
  const pct = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;
  const r = d.recurrentes;
  const conPartidas = d.reforma.partidas.length > 0;
  const recibido = (v: boolean, on: (x: boolean) => void, quien: string) => (
    <Field label="¿Dinero recibido?" hint={v ? `Lo pagado con él no cuenta como dinero propio` : `Márcalo cuando ${quien}`}>
      <Segmented
        value={v ? 'si' : 'no'}
        options={[{ value: 'no', label: 'Aún no' }, { value: 'si', label: 'Recibido' }]}
        onChange={(x) => on(x === 'si')}
        ariaLabel="¿Dinero recibido?"
      />
    </Field>
  );
  const mensualFijos = fijosMensuales(d);
  // La entrada del día de la firma, sin la reforma (va aparte)
  const ap = aportacion(sinReforma(d));
  const fein = d.hipoteca.fein;
  const setFein = <K extends keyof typeof fein>(key: K) => (v: (typeof fein)[K]) =>
    update((x) => {
      x.hipoteca.fein[key] = v;
    });

  return (
    <div className="page">
      <PageHead
        folio="02"
        title="Compra y financiación"
        subtitle="Datos generales del piso. Todo es editable y se recalcula al momento: la cuota de la hipoteca se usará por defecto al crear meses nuevos."
      />

      <div className="grid stagger">
        <section className="card">
          <div className="card-head"><h2>El piso</h2></div>
          <div className="form">
            <Field label="Precio de compra"><MoneyInput value={d.piso.precio} onChange={set('piso', 'precio')} /></Field>
            <Field label="Tipo de vivienda" wide={false}>
              <TextInput value={d.piso.tipoVivienda} onChange={set('piso', 'tipoVivienda')} placeholder="Ej.: 2ª mano, 1965" />
            </Field>
            <Field label="Valor estimado del piso" hint="Para tu patrimonio. Por defecto, la tasación">
              <MoneyInput value={d.piso.valor} onChange={set('piso', 'valor')} />
            </Field>
            <Field label="Comunidad autónoma">
              <TextInput value={d.piso.comunidadAutonoma} onChange={set('piso', 'comunidadAutonoma')} />
            </Field>
            <Field label="ITP aplicable" hint={`ITP: ${fmtEur(importeBase(d, 'itp'))}`}>
              <NumberInput value={d.piso.itpPct} onChange={set('piso', 'itpPct')} suffix="%" />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Hitos</h2>
            <span className="hint">Resto a pagar en escritura: <b className="num">{fmtEur(importeBase(d, 'restoPrecio'))}</b></span>
          </div>
          <div className="form">
            <Field label="Fecha de la señal"><DateInput value={d.hitos.senalFecha} onChange={set('hitos', 'senalFecha')} /></Field>
            <Field label="Importe de la señal"><MoneyInput value={d.hitos.senal} onChange={set('hitos', 'senal')} /></Field>
            <Field label="Firma del contrato de compraventa"><DateInput value={d.hitos.contratoFecha} onChange={set('hitos', 'contratoFecha')} /></Field>
            <Field label="Fecha de las arras"><DateInput value={d.hitos.arrasFecha} onChange={set('hitos', 'arrasFecha')} /></Field>
            <Field label="Importe de las arras"><MoneyInput value={d.hitos.arras} onChange={set('hitos', 'arras')} /></Field>
            <Field label="Fecha de escritura" hint={d.hitos.escrituraFecha ? undefined : 'Pendiente de fijar'}>
              <DateInput value={d.hitos.escrituraFecha} onChange={set('hitos', 'escrituraFecha')} />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Gastos de la compra</h2></div>
          <div className="form">
            <Field label="Comisión inmobiliaria"><MoneyInput value={d.gastos.comision} onChange={set('gastos', 'comision')} /></Field>
            {conPartidas ? (
              <div className="field">
                <span>Reforma (por partidas)</span>
                <div className="computed">
                  <a href="#/reforma" onClick={(e) => (e.preventDefault(), go('reforma'))}>ver «Reforma»</a>
                  <b>{fmtEur(totalesReforma(d).previsto)}</b>
                </div>
              </div>
            ) : (
              <Field label="Presupuesto de reforma" hint="Para desglosarla en partidas y pagos, usa «Reforma»">
                <MoneyInput value={d.gastos.reforma} onChange={set('gastos', 'reforma')} />
              </Field>
            )}
            <Field label="Notaría"><MoneyInput value={d.gastos.notaria} onChange={set('gastos', 'notaria')} /></Field>
            <Field label="Registro"><MoneyInput value={d.gastos.registro} onChange={set('gastos', 'registro')} /></Field>
            <Field label="Gestoría"><MoneyInput value={d.gastos.gestoria} onChange={set('gastos', 'gestoria')} /></Field>
            <Field label="Tasación bancaria"><MoneyInput value={d.gastos.tasacion} onChange={set('gastos', 'tasacion')} /></Field>
            <Field label="Fecha de pago de la tasación"><DateInput value={d.gastos.tasacionFecha} onChange={set('gastos', 'tasacionFecha')} /></Field>
          </div>
        </section>

        <div className="grid g-2">
          <section className="card">
            <div className="card-head">
              <h2>Hipoteca</h2>
              {d.hipoteca.provisional && <span className="chip provisional">Provisional · pendiente de FEIN</span>}
            </div>
            <div className="form">
              <Field label="Banco"><TextInput value={d.hipoteca.banco} onChange={set('hipoteca', 'banco')} /></Field>
              <Field label="Viabilidad concedida"><DateInput value={d.hipoteca.viabilidadFecha} onChange={set('hipoteca', 'viabilidadFecha')} /></Field>
              <Field label="Importe"><MoneyInput value={d.hipoteca.importe} onChange={set('hipoteca', 'importe')} /></Field>
              <Field label="Plazo"><NumberInput value={d.hipoteca.plazoAnios} onChange={set('hipoteca', 'plazoAnios')} suffix="años" /></Field>
              <Field label="Primer tramo" hint="Meses al principio con otro interés. 0 = un solo tipo">
                <NumberInput value={d.hipoteca.tramoAMeses} onChange={(v) => set('hipoteca', 'tramoAMeses')(Math.max(0, Math.round(v)))} suffix="meses" />
              </Field>
              {d.hipoteca.tramoAMeses > 0 && (
                <Field label="TIN del primer tramo">
                  <NumberInput value={d.hipoteca.tramoATinPct} onChange={set('hipoteca', 'tramoATinPct')} suffix="%" />
                </Field>
              )}
              <Field label={d.hipoteca.tramoAMeses > 0 ? 'TIN del resto' : 'TIN anual'}>
                <NumberInput value={d.hipoteca.tinPct} onChange={set('hipoteca', 'tinPct')} suffix="%" />
              </Field>
              {recibido(d.hipoteca.recibida, set('hipoteca', 'recibida'), 'el banco lo entregue en la escritura')}
              {t.mesesA > 0 && (
                <div className="field">
                  <span>Cuota los {t.mesesA} primeros meses</span>
                  <div className="computed"><span>al {pct(t.tinA)}</span><b>{fmtEur(t.cuotaA)}</b></div>
                </div>
              )}
              <div className="field">
                <span>{t.mesesA > 0 ? 'Cuota después' : 'Cuota mensual'}</span>
                <div className="computed">
                  <span>al {pct(t.tinB)}</span>
                  <b>{fmtEur(cuota)}</b>
                </div>
              </div>
              <Field label="Notas / estado" wide>
                <TextArea value={d.hipoteca.notas} onChange={set('hipoteca', 'notas')} placeholder="Condiciones, vinculaciones, estado del expediente…" />
              </Field>
              <Field label="Condiciones" hint={d.hipoteca.provisional ? 'Cámbialo a «Confirmadas» cuando tengas la FEIN' : undefined}>
                <Segmented
                  value={d.hipoteca.provisional ? 'prov' : 'ok'}
                  options={[{ value: 'prov', label: 'Provisionales' }, { value: 'ok', label: 'Confirmadas (FEIN)' }]}
                  onChange={(v) => set('hipoteca', 'provisional')(v === 'prov')}
                  ariaLabel="Condiciones de la hipoteca"
                />
              </Field>
              <div className="subhead">FEIN (rellénalo cuando la recibas)</div>
              <Field label="TAE">
                <NumberInput value={fein.taePct ?? 0} onChange={(v) => setFein('taePct')(v || null)} suffix="%" />
              </Field>
              <Field label="Fecha de emisión"><DateInput value={fein.fechaEmision} onChange={setFein('fechaEmision')} /></Field>
              <Field label="Oferta válida hasta"><DateInput value={fein.validaHasta} onChange={setFein('validaHasta')} /></Field>
              <Field label="Comisión por amortizar antes" hint="Parcial o total. 0 % confirmado de palabra por el banco">
                <NumberInput value={fein.comisionAmortPct} onChange={setFein('comisionAmortPct')} suffix="%" />
              </Field>
              <Field label="Vinculaciones exigidas" wide>
                <TextArea value={fein.vinculaciones} onChange={setFein('vinculaciones')} placeholder="Nómina, seguros de vida y hogar, tarjeta…" />
              </Field>
            </div>
            {cuota > 0 && costeHip.intereses !== null && (
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                {t.n} cuotas · total a devolver {fmtEur(d.hipoteca.importe + costeHip.intereses)} · intereses previstos{' '}
                {fmtEur(costeHip.intereses)}.
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Préstamo familiar</h2></div>
            <div className="form">
              <Field label="Importe"><MoneyInput value={d.familiar.importe} onChange={set('familiar', 'importe')} /></Field>
              {recibido(d.familiar.recibido, set('familiar', 'recibido'), 'te lo hayan dado')}
              <Field label="Cuota mensual de devolución"><MoneyInput value={d.familiar.cuota} onChange={set('familiar', 'cuota')} /></Field>
              <Field label="Primera cuota" hint="Si la dejas vacía, el mes siguiente a la escritura">
                <DateInput value={d.familiar.primeraCuota} onChange={set('familiar', 'primeraCuota')} />
              </Field>
              <Field label="Interés (opcional)" hint="0 si no hay interés formal">
                <NumberInput value={d.familiar.tinPct} onChange={set('familiar', 'tinPct')} suffix="%" />
              </Field>
              <Field label="Notas" wide>
                <TextArea value={d.familiar.notas} onChange={set('familiar', 'notas')} />
              </Field>
            </div>
            {d.familiar.cuota > 0 && d.familiar.importe > 0 && d.familiar.tinPct === 0 && (
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                Se devuelve en {Math.ceil(d.familiar.importe / d.familiar.cuota)} cuotas (
                {(Math.ceil(d.familiar.importe / d.familiar.cuota) / 12).toLocaleString('es-ES', { maximumFractionDigits: 1 })} años).
              </p>
            )}
          </section>
        </div>

        <section className="card" aria-labelledby="h-firma">
          <div className="card-head">
            <h2 id="h-firma">El día de la firma</h2>
            <span className="hint">qué se paga y de dónde sale · sin la reforma</span>
          </div>
          <div className="firma-grid">
            <div>
              <div className="subhead">Lo que falta por pagar</div>
              <ul className="firma-list">
                {firma.filas.map((f) => (
                  <li key={f.key}>
                    <span>{f.concepto}</span>
                    <b className="num">{fmtEur(f.importe)}</b>
                  </li>
                ))}
                <li className="firma-total">
                  <span>Total</span>
                  <b className="num">{fmtEur(firma.pendiente)}</b>
                </li>
              </ul>
              <small className="muted">Ya pagado antes: {fmtEur(firma.yaPagado)} (de {fmtEur(firma.total)} de la compra)</small>
            </div>
            <div>
              <div className="subhead">De dónde sale</div>
              <ul className="firma-list">
                <li>
                  <span>Hipoteca</span>
                  <b className="num">{fmtEur(Math.min(firma.hipoteca, firma.pendiente))}</b>
                </li>
                <li className="firma-input">
                  <span>Tus ahorros (antes que tus padres)</span>
                  <MoneyInput value={d.ahorros.firma} onChange={set('ahorros', 'firma')} ariaLabel="Tus ahorros para la firma" />
                </li>
                <li>
                  <span>Préstamo familiar necesario</span>
                  <b className="num">{fmtEur(firma.familiarNecesario)}</b>
                </li>
              </ul>
              {firma.pendiente > 0 && firma.familiarNecesario !== d.familiar.importe && (
                <div className="firma-ajuste">
                  <span>
                    Ahora tienes un préstamo familiar de <b className="num">{fmtEur(d.familiar.importe)}</b>
                    {firma.falta > 0 ? `: faltan ${fmtEur(firma.falta)}.` : `: sobran ${fmtEur(firma.sobraFamiliar)}.`}
                  </span>
                  <button className="btn sm" onClick={() => set('familiar', 'importe')(firma.familiarNecesario)}>
                    Pedir {fmtEur(firma.familiarNecesario)} a tus padres
                  </button>
                </div>
              )}
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                Lo que pones tú en total (entrada): <b className="num">{fmtEur(ap.entrada)}</b> = compra {fmtEur(ap.total, { compact: true })} −
                préstamos {fmtEur(ap.prestamos, { compact: true })}.
                {reformaTotal > 0 && ` La reforma (${fmtEur(reformaTotal)}) va aparte, después de la firma.`}
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Alquiler y gastos recurrentes</h2>
            <span className="hint">
              Fijos prorrateados: <b className="num">{fmtEur(mensualFijos)}/mes</b>
            </span>
          </div>
          <div className="form">
            <Field label="Inicio del alquiler" hint="Previsto o real. Antes de esta fecha el piso está en reforma">
              <DateInput value={r.inicioAlquiler} onChange={set('recurrentes', 'inicioAlquiler')} />
            </Field>
            <Field label="Alquiler mensual estimado"><MoneyInput value={r.alquiler} onChange={set('recurrentes', 'alquiler')} /></Field>
            <Field label="Cuota anual del edificio" hint={`${fmtEur(Math.round(r.edificioAnual / 12))}/mes`}>
              <MoneyInput value={r.edificioAnual} onChange={set('recurrentes', 'edificioAnual')} />
            </Field>
            <Field label="IBI anual" hint={`${fmtEur(Math.round(r.ibiAnual / 12))}/mes`}>
              <MoneyInput value={r.ibiAnual} onChange={set('recurrentes', 'ibiAnual')} />
            </Field>
            {d.seguros.map((x) => (
              <div className="field seguro-row" key={x.id}>
                <span className="seguro-head">
                  <TextInput value={x.nombre} onChange={(v) => setSeguro(x.id, { nombre: v })} ariaLabel="Nombre del seguro" />
                  <button className="icon-btn" aria-label={`Quitar ${x.nombre}`} onClick={() => quitarSeguro(x.id)}>
                    <IconTrash />
                  </button>
                </span>
                <MoneyInput value={x.primaAnual} onChange={(v) => setSeguro(x.id, { primaAnual: v })} ariaLabel={`${x.nombre}: coste anual`} />
                <small className="hint">{fmtEur(Math.round(x.primaAnual / 12))}/mes</small>
              </div>
            ))}
            <div className="field">
              <span>Seguros</span>
              <button className="btn sm" onClick={addSeguro}>
                <IconPlus /> Añadir seguro
              </button>
              <small className="hint">Total {fmtEur(segurosAnuales(d))}/año</small>
            </div>
            <Field label="Mantenimiento mensual"><MoneyInput value={r.mantenimientoMensual} onChange={set('recurrentes', 'mantenimientoMensual')} /></Field>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Resultado mensual alquilado, mientras devuelves el préstamo familiar: alquiler {fmtEur(r.alquiler)} − hipoteca {fmtEur(cuota)} − préstamo familiar{' '}
            {fmtEur(d.familiar.cuota)} − fijos {fmtEur(mensualFijos)} ={' '}
            <b className={`num ${r.alquiler - cuota - d.familiar.cuota - mensualFijos >= 0 ? 'pos' : 'neg'}`}>
              {fmtEur(r.alquiler - cuota - d.familiar.cuota - mensualFijos, { sign: true })}
            </b>
          </p>
        </section>
      </div>
    </div>
  );
}
