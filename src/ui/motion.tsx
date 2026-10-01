import { useEffect, useRef, useState, type ReactNode } from 'react';

/** El usuario pide menos movimiento: se muestran los valores finales sin animar. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Curva de salida fuerte (rápida al principio, se posa al final). */
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Último valor mostrado de cada cifra con nombre (vive mientras la app está abierta). */
const lastShown = new Map<string, number>();

/**
 * Valor numérico que «cuenta» hasta `target`. Sin `id`, desde 0. Con `id`, la primera vez
 * desde 0 y después desde el último valor mostrado: al volver a una pantalla solo se anima
 * lo que ha cambiado. Solo cambia el número mostrado; el dato real nunca se toca.
 */
export function useCountUp(target: number, duration = 900, id?: string): number {
  const initial = prefersReducedMotion() ? target : id && lastShown.has(id) ? lastShown.get(id)! : 0;
  const [shown, setShown] = useState(initial);
  const from = useRef(initial);
  const raf = useRef(0);

  useEffect(() => {
    if (id) lastShown.set(id, target);
    if (prefersReducedMotion() || from.current === target) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = origin + (target - origin) * easeOutExpo(t);
      setShown(v);
      from.current = v;
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, id]);

  return shown;
}

/** Número animado con el formato que se le pase (céntimos → texto). */
export function Counter({
  value, format, duration, className, id,
}: { value: number; format: (v: number) => string; duration?: number; className?: string; id?: string }) {
  const v = useCountUp(value, duration, id);
  // Al terminar se muestra exactamente el valor real (sin redondeos intermedios)
  const text = Math.abs(v - value) < 0.5 ? format(value) : format(Math.round(v));
  return (
    <span className={className} aria-label={format(value)}>
      <span aria-hidden>{text}</span>
    </span>
  );
}

/** Valor de cada cifra con nombre la última vez que se vio, para detectar cambios al volver. */
const lastSeen = new Map<string, number>();

/**
 * Devuelve 'up' / 'down' durante un instante cuando `value` cambia, también si cambió
 * mientras estabas en otra pantalla (`id`): la cifra destella en verde o en coral.
 */
export function useChangeFlash(value: number, id: string, ms = 1100): 'up' | 'down' | null {
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    const prev = lastSeen.get(id);
    lastSeen.set(id, value);
    if (prev === undefined || prev === value) return;
    setDir(value > prev ? 'up' : 'down');
    const t = setTimeout(() => setDir(null), ms);
    return () => clearTimeout(t);
  }, [value, id, ms]);
  return dir;
}

/** Marca `data-inview` cuando el elemento entra en pantalla (una sola vez). */
export function InView({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') return setSeen(true);
    // Visto si entra en pantalla o si ya ha quedado por encima (un salto de scroll se lo puede saltar)
    const check = () => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) setSeen(true);
    };
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    window.addEventListener('scroll', check, { passive: true });
    check();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', check);
    };
  }, [seen]);
  return (
    <Tag ref={ref} className={className} data-inview={seen || undefined}>
      {children}
    </Tag>
  );
}
