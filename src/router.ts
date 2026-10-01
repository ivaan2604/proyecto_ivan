import { useSyncExternalStore } from 'react';
import type { SectionId } from './lib/derive';

export const SECTIONS: { id: SectionId; folio: string; label: string; short: string }[] = [
  { id: 'resumen', folio: '01', label: 'Resumen', short: 'Resumen' },
  { id: 'compra', folio: '02', label: 'Compra y financiación', short: 'Compra' },
  { id: 'gastos', folio: '03', label: 'Gastos de compra', short: 'Gastos' },
  { id: 'meses', folio: '04', label: 'Meses e ingresos', short: 'Meses' },
  { id: 'hipoteca', folio: '05', label: 'Hipoteca', short: 'Hipoteca' },
  { id: 'familiar', folio: '06', label: 'Préstamo familiar', short: 'Familiar' },
  { id: 'notas', folio: '07', label: 'Notas', short: 'Notas' },
  { id: 'copia', folio: '08', label: 'Copia y ajustes', short: 'Ajustes' },
];

const ids = new Set(SECTIONS.map((s) => s.id));

function read(): SectionId {
  const h = location.hash.replace(/^#\/?/, '') as SectionId;
  return ids.has(h) ? h : 'resumen';
}

export function go(id: SectionId) {
  if (read() !== id) location.hash = `/${id}`;
  window.scrollTo({ top: 0 });
}

export function useRoute(): SectionId {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    read,
  );
}
