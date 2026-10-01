import type { ReactNode } from 'react';
import { fmtDateTime } from '../lib/format';
import { IconPrint } from './icons';

export function PageHead({
  folio, title, subtitle, actions,
}: { folio: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <div className="eyebrow">Folio {folio}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        <p className="print-only muted">Impreso el {fmtDateTime(new Date().toISOString())}</p>
      </div>
      <div className="page-actions no-print">
        {actions}
        <button className="btn ghost" onClick={() => window.print()} title="Imprimir o guardar como PDF">
          <IconPrint /> <span>Imprimir</span>
        </button>
      </div>
    </header>
  );
}
