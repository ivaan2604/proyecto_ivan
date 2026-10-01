import { useState } from 'react';
import { fmtDate, todayISO } from '../lib/format';
import { uid } from '../lib/model';
import { update, useData } from '../store';
import { useDialogs } from '../ui/dialogs';
import { DateInput, TextArea } from '../ui/fields';
import { IconPlus, IconTrash } from '../ui/icons';
import { PageHead } from '../ui/layout';

export function Notas() {
  const d = useData();
  const { confirm } = useDialogs();
  const [fecha, setFecha] = useState(todayISO());
  const [texto, setTexto] = useState('');
  const notas = [...d.notas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const add = () => {
    if (!texto.trim()) return;
    update((x) => {
      x.notas.push({ id: uid(), fecha, texto: texto.trim() });
    });
    setTexto('');
    setFecha(todayISO());
  };

  return (
    <div className="page">
      <PageHead folio="07" title="Notas" subtitle="Llamadas, dudas, lo que dijo el banco… todo lo que no encaja en otra parte." />

      <section className="card no-print" style={{ marginBottom: 18 }}>
        <div className="form note-form">
          <label className="field">
            <span>Fecha</span>
            <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="field">
            <span>Nota</span>
            <textarea
              className="input"
              rows={3}
              value={texto}
              placeholder="Escribe aquí…"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add();
              }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn primary" onClick={add} disabled={!texto.trim()}>
            <IconPlus /> Añadir nota
          </button>
        </div>
      </section>

      {notas.length === 0 ? (
        <div className="empty">Todavía no hay notas.</div>
      ) : (
        <div className="notes stagger">
          {notas.map((n) => (
            <article key={n.id} className="note">
              <div className="when">
                <span className="print-only">{fmtDate(n.fecha)}</span>
                <span className="no-print">
                  <DateInput value={n.fecha} onChange={(v) => update((x) => void (x.notas.find((y) => y.id === n.id)!.fecha = v))} ariaLabel="Fecha" />
                </span>
              </div>
              <div className="txt print-only">{n.texto}</div>
              <div className="no-print">
                <TextArea value={n.texto} rows={Math.min(8, Math.max(2, n.texto.split('\n').length))} onChange={(v) => update((x) => void (x.notas.find((y) => y.id === n.id)!.texto = v))} />
              </div>
              <button
                className="icon-btn"
                aria-label="Eliminar nota"
                onClick={async () => {
                  if (await confirm({ title: 'Eliminar nota', body: n.texto.slice(0, 160), confirmText: 'Eliminar', danger: true }))
                    update((x) => {
                      x.notas = x.notas.filter((y) => y.id !== n.id);
                    });
                }}
              >
                <IconTrash />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
