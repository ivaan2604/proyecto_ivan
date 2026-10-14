import { useSyncExternalStore } from 'react';
import type { AppData } from './lib/model';
import { engine, type EngineState } from './sync/engine';

export function useEngine(): EngineState {
  return useSyncExternalStore(engine.subscribe, engine.getState);
}

/** Datos actuales (solo usar dentro de la app, cuando ya existen). */
export function useData(): AppData {
  const d = useEngine().data;
  if (!d) throw new Error('Sin datos');
  return d;
}

export const update = (fn: (d: AppData) => AppData | void) => engine.update(fn);

/** Datos actuales fuera de React (p. ej. tras un cambio, dentro de un manejador). */
export function getData(): AppData {
  const d = engine.getState().data;
  if (!d) throw new Error('Sin datos');
  return d;
}
