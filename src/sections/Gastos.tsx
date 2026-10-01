import { useMemo, type CSSProperties } from 'react';
import { totalesGastos } from '../lib/derive';
import { fmtDate, fmtEur, todayISO } from '../lib/format';
import { go } from '../router';
import { uid, type BaseKey, type Estado } from '../lib/model';
import { update, useData } from '../store';
import { useDialogs } from '../ui/dialogs';
import { DateInput, EstadoToggle, MoneyInput, TextInput } from '../ui/fields';
import { IconArrow, IconPlus, IconTrash } from '../ui/icons';
import { PageHead } from '../ui/layout';
import { Counter } from '../ui/motion';

export function Gastos() {
  const d = useData();
  const { confirm } = useDialogs();
  const t = useMemo(() => totalesGastos(d), [d]);

  const setEstado = (key: string, base: boolean, v: Estado) =>
    update((x) => {
      if (base) x.gastosBase[key as BaseKey].estado = v;
      else x.gastosExtra.find((g) => g.id === key)!.estado = v;
    });
  const setNota = (key: string, base: boolean, v: string) =>
    update((x) => {
      if (base) x.gastosBase[key as BaseKey].nota = v;
      else x.gastosExtra.find((g) => g.id === key)!.nota = v;
    });
  const setFecha = (key: string, base: boolean, v: string) =>
    update((x) => {
      if (base) x.gastosBase[key as BaseKey].fecha = v;
      else x.gastosExtra.find((g) => g.id === key)!.fecha = v;
    });
  const setExtra = (id: string, patch: { concepto?: string; importe?: number }) =>
    update((x) => {
      Object.assign(x.gastosExtra.find((g) => g.id === id)!, patch);
    });

  const add = () =>
    update((x) => {
      x.gastosExtra.push({ id: uid(), concepto: 'Nuevo gasto', fecha: todayISO(), importe: 0, estado: 'pendiente', nota: '' });
    });

  const remove = async (id: string, concepto: string) => {
    if (await confirm({ title: 'Eliminar gasto', body: `¿Eliminar «${concepto}»?`, confirmText: 'Eliminar', danger: true })) {
      update((x) => {
        x.gastosExtra = x.gastosExtra.filter((g) => g.id !== id);
      });
    }
  };

  return (
    <div className="page">
      <PageHead
        folio="03"
        title="Gastos de compra"
        subtitle="Los conceptos base se calculan desde «Compra y financiación». Marca cada uno como pagado cuando salga de tu cuenta."
        actions={
          <button className="btn primary" onClick={add}>
            <IconPlus /> Añadir gasto
          </button>
        }
      />

      <section className="card flush">
        <div className="table-wrap">
          <table className="ledger stack">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Fecha</th>
                <th className="r">Importe</th>
                <th>Estado</th>
                <th>Notas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {t.filas.map((f) =>
                f.reforma ? (
                  <tr key={f.key} className="derived">
                    <td className="full" style={{ minWidth: 190 }}>
                      <b>{f.concepto}</b>
                    </td>
                    <td data-label="Fecha">{f.fecha ? fmtDate(f.fecha) : <span className="muted">—</span>}</td>
                    <td className="amount" data-label="Importe">{fmtEur(f.importe)}</td>
                    <td data-label="Estado">
                      <span className={`chip ${f.estado === 'pagado' ? 'pos' : 'ochre'}`}>{f.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
                    </td>
                    <td data-label="Notas" className="muted">{f.nota || '—'}</td>
                    <td className="row-actions">
                      <button className="icon-btn" aria-label="Editar en Reforma" title="Editar en Reforma" onClick={() => go('reforma')}>
                        <IconArrow />
                      </button>
                    </td>
                  </tr>
                ) : (
                <tr key={f.key}>
                  <td className="full" data-label={f.base ? undefined : 'Concepto'} style={{ minWidth: 190 }}>
                    {f.base ? (
                      <b>{f.concepto}</b>
                    ) : (
                      <TextInput value={f.concepto} onChange={(v) => setExtra(f.key, { concepto: v })} ariaLabel="Concepto" />
                    )}
                  </td>
                  <td data-label="Fecha" style={{ minWidth: 150 }}>
                    <DateInput value={f.fecha} onChange={(v) => setFecha(f.key, f.base, v)} ariaLabel="Fecha" />
                  </td>
                  <td className="amount" data-label="Importe" style={{ minWidth: 130 }}>
                    {f.base ? (
                      fmtEur(f.importe)
                    ) : (
                      <MoneyInput value={f.importe} onChange={(v) => setExtra(f.key, { importe: v })} ariaLabel="Importe" />
                    )}
                  </td>
                  <td data-label="Estado">
                    <EstadoToggle value={f.estado} onChange={(v) => setEstado(f.key, f.base, v)} />
                  </td>
                  <td data-label="Notas" style={{ minWidth: 180 }}>
                    <TextInput value={f.nota} onChange={(v) => setNota(f.key, f.base, v)} placeholder="—" ariaLabel="Notas" />
                  </td>
                  <td className="row-actions">
                    {!f.base && (
                      <button className="icon-btn" aria-label={`Eliminar ${f.concepto}`} onClick={() => remove(f.key, f.concepto)}>
                        <IconTrash />
                      </button>
                    )}
                  </td>
                </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <div className="t">
            <span>Total gastos de compra</span>
            <b>{fmtEur(t.total)}</b>
          </div>
          <div className="t">
            <span>Pagado</span>
            <b className="pos">
              <Counter id="gastos-pagado" duration={700} value={t.pagado} format={(v) => fmtEur(v)} />
            </b>
          </div>
          <div className="t">
            <span>Pendiente</span>
            <b className={t.pendiente ? 'neg' : undefined}>
              <Counter id="gastos-pendiente" duration={700} value={t.pendiente} format={(v) => fmtEur(v)} />
            </b>
          </div>
          <div className="meter totals-meter" role="progressbar" aria-label="Gastos de compra pagados" aria-valuenow={Math.round((t.total ? t.pagado / t.total : 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ '--p': t.total ? t.pagado / t.total : 0 } as CSSProperties} />
          </div>
        </div>
      </section>
      <p className="muted" style={{ fontSize: 13 }}>
        La fecha de los conceptos base se toma de los hitos (señal, arras, escritura, tasación) salvo que pongas
        una aquí. Para cambiar un importe base, edítalo en «Compra y financiación». Si desglosas la reforma en
        partidas, sus pagos aparecen aquí y se editan en «Reforma».
      </p>
    </div>
  );
}
