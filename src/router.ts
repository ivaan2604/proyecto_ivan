import { useSyncExternalStore } from 'react';
import type { SectionId } from './lib/derive';

export const SECTIONS: { id: SectionId; folio: string; label: string; short: string }[] = [
  { id: 'resumen', folio: '01', label: 'Resumen', short: 'Resumen' },
  { id: 'analisis', folio: '02', label: 'Análisis', short: 'Análisis' },
  { id: 'compra', folio: '03', label: 'Compra y financiación', short: 'Compra' },
  { id: 'gastos', folio: '04', label: 'Gastos de compra', short: 'Gastos' },
  { id: 'reforma', folio: '05', label: 'Reforma', short: 'Reforma' },
  { id: 'meses', folio: '06', label: 'Meses e ingresos', short: 'Meses' },
  { id: 'hipoteca', folio: '07', label: 'Hipoteca', short: 'Hipoteca' },
  { id: 'familiar', folio: '08', label: 'Préstamo familiar', short: 'Familiar' },
  { id: 'irpf', folio: '09', label: 'Hacienda (IRPF)', short: 'IRPF' },
  { id: 'notas', folio: '10', label: 'Notas', short: 'Notas' },
  { id: 'copia', folio: '11', label: 'Copia y ajustes', short: 'Ajustes' },
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
