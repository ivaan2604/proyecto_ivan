import { useState } from 'react';

/** Preferencia de este dispositivo: ver el Resumen y el Análisis con o sin la reforma. */
export function useConReforma(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem('resumen-reforma') === 'con';
    } catch {
      return false;
    }
  });
  return [
    v,
    (x: boolean) => {
      setV(x);
      try {
        localStorage.setItem('resumen-reforma', x ? 'con' : 'sin');
      } catch {
        /* sin almacenamiento: solo para esta visita */
      }
    },
  ];
}
