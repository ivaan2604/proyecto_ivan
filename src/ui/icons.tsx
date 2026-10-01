import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const IconHome = (p: P) => (<svg {...base(p)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>);
export const IconKey = (p: P) => (<svg {...base(p)}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" /></svg>);
export const IconReceipt = (p: P) => (<svg {...base(p)}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>);
export const IconCalendar = (p: P) => (<svg {...base(p)}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>);
export const IconBank = (p: P) => (<svg {...base(p)}><path d="M3 9.5 12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></svg>);
export const IconHeart = (p: P) => (<svg {...base(p)}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>);
export const IconNote = (p: P) => (<svg {...base(p)}><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v4h4M8 12h8M8 16h6" /></svg>);
export const IconShield = (p: P) => (<svg {...base(p)}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IconMore = (p: P) => (<svg {...base(p)}><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></svg>);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconTrash = (p: P) => (<svg {...base(p)}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /></svg>);
export const IconCopy = (p: P) => (<svg {...base(p)}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>);
export const IconPrint = (p: P) => (<svg {...base(p)}><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><rect x="7" y="14" width="10" height="7" /></svg>);
export const IconDownload = (p: P) => (<svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>);
export const IconUpload = (p: P) => (<svg {...base(p)}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></svg>);
export const IconChevron = ({ dir = 'right', ...p }: P & { dir?: 'left' | 'right' }) => (
  <svg {...base(p)}><path d={dir === 'right' ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} /></svg>
);
export const IconCheck = (p: P) => (<svg {...base(p)} strokeWidth={3}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconArrow = (p: P) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);

/** Motivo de azulejo para la marca */
export const TileMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden fill="none" stroke="var(--surface)" strokeWidth="2.6">
    <path d="M24 4c6 8 6 12 0 20-6-8-6-12 0-20zM24 44c-6-8-6-12 0-20 6 8 6 12 0 20zM4 24c8-6 12-6 20 0-8 6-12 6-20 0zM44 24c-8 6-12 6-20 0 8-6 12-6 20 0z" />
    <circle cx="24" cy="24" r="3" />
  </svg>
);

/** Flor de azahar (la flor del naranjo de la Plana): cinco pétalos y el centro. */
export const AzaharMark = ({ size = 22, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={className}>
    <g className="petals">
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} transform={`rotate(${a} 24 24)`} d="M24 23C19.5 18 19 10.5 24 5.5 29 10.5 28.5 18 24 23Z" />
      ))}
    </g>
    <circle className="core" cx="24" cy="24" r="4.2" />
  </svg>
);

export const IconTrendUp = (p: P) => (<svg {...base(p)}><path d="m4 16 6-6 4 4 6-6" /><path d="M15 8h5v5" /></svg>);
export const IconTrendDown = (p: P) => (<svg {...base(p)}><path d="m4 8 6 6 4-4 6 6" /><path d="M15 16h5v-5" /></svg>);
