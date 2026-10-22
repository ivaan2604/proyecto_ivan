import { useMemo } from 'react';
import { irpfAlquiler } from '../lib/derive';
import { fmtEur } from '../lib/format';
import type { AppData } from '../lib/model';
import { update, useData } from '../store';
import { Field, MoneyInput, NumberInput, Segmented } from '../ui/fields';
import { PageHead } from '../ui/layout';

const REDUCCIONES = [
  { value: '50', label: '50 %' },
  { value: '60', label: '60 %' },
  { value: '70', label: '70 %' },
  { value: '90', label: '90 %' },
];

function setIrpf<K extends keyof AppData['irpf']>(key: K) {
  return (v: AppData['irpf'][K]) =>
    update((d) => {
      d.irpf[key] = v;
    });
}

export function Irpf() {
  const d = useData();
  const r = useMemo(() => irpfAlquiler(d), [d]);
  const ir = d.irpf;

  return (
    <div className="page">
      <PageHead
        folio="09"
        title="Hacienda (IRPF)"
        subtitle="Cuánto pagarías al año por el alquiler en la declaración de la renta. Es una estimación orientativa: confírmala con un gestor."
      />

      <div className="grid">
        <section className="card" aria-labelledby="h-irpf-res">
          <div className="card-head">
            <h2 id="h-irpf-res">Un año de alquiler completo</h2>
            <span className="hint">{r.desde ? `con los intereses de las cuotas ${r.desde + 1} a ${r.desde + 12}` : 'con los intereses del primer año de hipoteca'}</span>
          </div>
          <ul className="firma-list irpf-list">
            <li>
              <span>Alquiler cobrado (12 meses)</span>
              <b className="num">{fmtEur(r.ingresos)}</b>
            </li>
            {r.gastos.map((g) => (
              <li key={g.concepto}>
                <span>
                  − {g.concepto}
                  {g.nota && <small className="irpf-nota">{g.nota}</small>}
                </span>
                <b className="num">−{fmtEur(g.importe)}</b>
              </li>
            ))}
            <li className="firma-total">
              <span>Rendimiento neto</span>
              <b className={`num ${r.neto < 0 ? 'neg' : ''}`}>{fmtEur(r.neto)}</b>
            </li>
            <li>
              <span>− Reducción por alquiler de vivienda ({ir.reduccionPct} %)</span>
              <b className="num">−{fmtEur(r.reduccion)}</b>
            </li>
            <li className="firma-total">
              <span>Lo que se suma a tu base de la renta</span>
              <b className="num">{fmtEur(Math.max(0, r.base))}</b>
            </li>
          </ul>
          <div className="irpf-cuota">
            <div>
              <div className="kpi-label">Pagarías por el alquiler</div>
              <div className="pones-figure">{fmtEur(r.cuota)}<small> al año</small></div>
              <div className="kpi-sub">≈ {fmtEur(r.mensual)}/mes · a tu tipo marginal del {ir.tipoMarginalPct} %</div>
            </div>
            <p className="muted">
              {r.neto <= 0
                ? 'Los gastos deducibles cubren todo el alquiler: ese año no pagarías nada por él (lo negativo no se compensa con tu nómina).'
                : `De cada ${fmtEur(r.ingresos)} de alquiler, solo tributan ${fmtEur(Math.max(0, r.base))}.`}
            </p>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Tus datos</h2>
          </div>
          <div className="form">
            <Field label="Valor catastral total" hint="Viene en el recibo del IBI. Si no lo tienes, déjalo a 0">
              <MoneyInput value={ir.valorCatastral} onChange={setIrpf('valorCatastral')} />
            </Field>
            <Field label="Parte de construcción" hint="Del recibo del IBI: valor de la construcción ÷ valor catastral. El suelo no se amortiza">
              <NumberInput value={ir.pctConstruccion} onChange={setIrpf('pctConstruccion')} suffix="%" />
            </Field>
            <Field label="Tu tipo marginal" hint="Aprox. con tu sueldo bruto: hasta 12.450 € ≈ 19 %; hasta 20.200 € ≈ 24 %; hasta 35.200 € ≈ 30 %; hasta 60.000 € ≈ 37 %">
              <NumberInput value={ir.tipoMarginalPct} onChange={setIrpf('tipoMarginalPct')} suffix="%" />
            </Field>
            <Field label="Reducción por alquiler de vivienda" hint="50 % lo normal. Más solo en casos concretos (ver abajo)">
              <Segmented value={String(ir.reduccionPct)} options={REDUCCIONES} onChange={(v) => setIrpf('reduccionPct')(Number(v))} ariaLabel="Reducción" />
            </Field>
            <Field label="Muebles y electrodomésticos" hint="Lo que pongas en el piso para alquilarlo amueblado: se deduce un 10 % al año">
              <MoneyInput value={ir.muebles} onChange={setIrpf('muebles')} />
            </Field>
          </div>
        </section>

        <section className="card irpf-guia">
          <div className="card-head">
            <h2>Cómo funciona</h2>
          </div>
          <ol>
            <li>
              <b>El alquiler tributa en tu renta</b>, junto con tu nómina, como «rendimiento del capital inmobiliario». Se declara una
              vez al año, en la declaración de la renta (abril–junio del año siguiente).
            </li>
            <li>
              <b>Restas los gastos del piso:</b> intereses de la hipoteca (no la parte de capital), IBI, comunidad, seguro de hogar,
              reparaciones y conservación. Los intereses y las reparaciones juntos no pueden superar lo cobrado; lo que sobre se
              aplica en los 4 años siguientes.
            </li>
            <li>
              <b>Restas la amortización:</b> el 3 % al año de lo que te costó la parte de construcción (precio + impuestos +
              notaría, registro, gestoría e inmobiliaria), sin el suelo, más las mejoras de la reforma. Los muebles, un 10 % al año.
              No pagas nada por ello, pero Hacienda te lo deja restar.
            </li>
            <li>
              <b>Reducción del 50 %</b> de lo que quede, por alquilar como vivienda habitual del inquilino. Es del 90 % si el piso está
              en zona tensionada y bajas el alquiler, del 70 % si alquilas por primera vez en zona tensionada a alguien de 18 a 35
              años, y del 60 % si has hecho obras de rehabilitación en los dos años anteriores. Hoy la Comunidad Valenciana no tiene zonas
              tensionadas declaradas, así que lo normal es el 50 %. Solo se aplica si declaras tú el alquiler dentro de plazo.
            </li>
            <li>
              <b>El resultado se suma a tu nómina</b> y paga a tu tipo marginal: el porcentaje que pagas por cada euro más que
              ganas.
            </li>
            <li>
              <b>Los meses sin alquilar</b> (reforma o sin inquilino) no tienen gastos deducibles y Hacienda suma una pequeña
              «imputación» (el 1,1 % o 2 % del valor catastral al año, en proporción): por eso aquí se calcula un año entero
              alquilado.
            </li>
            <li>
              <b>Guarda todas las facturas</b> (reforma separando mejoras de reparaciones, seguros, IBI, comunidad) y el contrato de
              alquiler.
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
