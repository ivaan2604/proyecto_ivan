import { cuotaHipotecaPrevista, importeBase, totalesReforma } from '../lib/derive';
import { fmtEur } from '../lib/format';
import type { AppData } from '../lib/model';
import { update, useData } from '../store';
import { DateInput, Field, MoneyInput, NumberInput, Segmented, TextArea, TextInput } from '../ui/fields';
import { go } from '../router';
import { PageHead } from '../ui/layout';

type Sec = keyof Pick<AppData, 'piso' | 'hitos' | 'gastos' | 'hipoteca' | 'familiar' | 'recurrentes'>;

/** Setter tipado para un campo de una subsección */
function set<S extends Sec, K extends keyof AppData[S]>(sec: S, key: K) {
  return (v: AppData[S][K]) =>
    update((d) => {
      d[sec][key] = v;
    });
}

export function Compra() {
  const d = useData();
  const cuota = cuotaHipotecaPrevista(d);
  const totalPagarHip = cuota * Math.round(d.hipoteca.plazoAnios * 12);
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
  const mensualFijos =
    Math.round((r.edificioAnual + r.ibiAnual + r.seguroHogarAnual + r.seguroVidaAnual) / 12) + r.mantenimientoMensual;

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
            <div className="card-head"><h2>Hipoteca</h2></div>
            <div className="form">
              <Field label="Banco"><TextInput value={d.hipoteca.banco} onChange={set('hipoteca', 'banco')} /></Field>
              <Field label="Viabilidad concedida"><DateInput value={d.hipoteca.viabilidadFecha} onChange={set('hipoteca', 'viabilidadFecha')} /></Field>
              <Field label="Importe"><MoneyInput value={d.hipoteca.importe} onChange={set('hipoteca', 'importe')} /></Field>
              <Field label="Plazo"><NumberInput value={d.hipoteca.plazoAnios} onChange={set('hipoteca', 'plazoAnios')} suffix="años" /></Field>
              <Field label="TIN anual"><NumberInput value={d.hipoteca.tinPct} onChange={set('hipoteca', 'tinPct')} suffix="%" /></Field>
              {recibido(d.hipoteca.recibida, set('hipoteca', 'recibida'), 'el banco lo entregue en la escritura')}
              <div className="field">
                <span>Cuota mensual (PMT)</span>
                <div className="computed"><span>calculada</span><b>{fmtEur(cuota)}</b></div>
              </div>
              <Field label="Notas / estado" wide>
                <TextArea value={d.hipoteca.notas} onChange={set('hipoteca', 'notas')} placeholder="Condiciones, vinculaciones, estado del expediente…" />
              </Field>
            </div>
            {cuota > 0 && (
              <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                {Math.round(d.hipoteca.plazoAnios * 12)} cuotas · total a pagar {fmtEur(totalPagarHip)} · intereses
                totales previstos {fmtEur(totalPagarHip - d.hipoteca.importe)}
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Préstamo familiar</h2></div>
            <div className="form">
              <Field label="Importe"><MoneyInput value={d.familiar.importe} onChange={set('familiar', 'importe')} /></Field>
              {recibido(d.familiar.recibido, set('familiar', 'recibido'), 'te lo hayan dado')}
              <Field label="Cuota mensual de devolución"><MoneyInput value={d.familiar.cuota} onChange={set('familiar', 'cuota')} /></Field>
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
            <Field label="Seguro de hogar anual" hint={`${fmtEur(Math.round(r.seguroHogarAnual / 12))}/mes`}>
              <MoneyInput value={r.seguroHogarAnual} onChange={set('recurrentes', 'seguroHogarAnual')} />
            </Field>
            <Field label="Seguro de vida anual" hint={`${fmtEur(Math.round(r.seguroVidaAnual / 12))}/mes`}>
              <MoneyInput value={r.seguroVidaAnual} onChange={set('recurrentes', 'seguroVidaAnual')} />
            </Field>
            <Field label="Mantenimiento mensual"><MoneyInput value={r.mantenimientoMensual} onChange={set('recurrentes', 'mantenimientoMensual')} /></Field>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Resultado teórico mensual: alquiler {fmtEur(r.alquiler)} − hipoteca {fmtEur(cuota)} − préstamo familiar{' '}
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
