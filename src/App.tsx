import { useMemo, useRef, useState, type ReactElement } from 'react';
import { avisos, type SectionId } from './lib/derive';
import { parseBackup } from './lib/backup';
import { emptyData } from './lib/model';
import { go, SECTIONS, useRoute } from './router';
import { Compra } from './sections/Compra';
import { Copia } from './sections/Copia';
import { Gastos } from './sections/Gastos';
import { Meses } from './sections/Meses';
import { Notas } from './sections/Notas';
import { Prestamo } from './sections/Prestamo';
import { Reforma } from './sections/Reforma';
import { Resumen } from './sections/Resumen';
import { useEngine } from './store';
import { engine } from './sync/engine';
import { cloudEnabled } from './sync/remote';
import { useTheme } from './theme';
import { DialogProvider, useDialogs } from './ui/dialogs';
import { AzaharMark, IconBank, IconCalendar, IconHome, IconMore, IconReceipt } from './ui/icons';
import { ConflictModal, SignInForm, SyncPill } from './ui/sync';

export default function App() {
  return (
    <DialogProvider>
      <Root />
      <ConflictModal />
    </DialogProvider>
  );
}

function Root() {
  const s = useEngine();
  if (s.status === 'loading') return null;
  if (!s.data) return <Welcome />;
  return <Shell />;
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="brand-mark">
      <span className="brand-tile">
        <AzaharMark size={compact ? 20 : 26} />
      </span>
      <div>
        <div className="brand-title">Piso Castellón</div>
        {!compact && <div className="brand-sub">Compra · Alquiler · Cuentas</div>}
      </div>
    </div>
  );
}

function Shell() {
  const route = useRoute();
  const s = useEngine();
  const [theme, setTheme] = useTheme();
  const [sheet, setSheet] = useState(false);
  const nAvisos = useMemo(() => (s.data ? avisos(s.data).filter((a) => a.nivel !== 'info').length : 0), [s.data]);

  const page = (() => {
    switch (route) {
      case 'resumen': return <Resumen />;
      case 'compra': return <Compra />;
      case 'gastos': return <Gastos />;
      case 'reforma': return <Reforma />;
      case 'meses': return <Meses />;
      case 'hipoteca': return <Prestamo kind="hipoteca" key="h" />;
      case 'familiar': return <Prestamo kind="familiar" key="f" />;
      case 'notas': return <Notas />;
      case 'copia': return <Copia theme={theme} setTheme={setTheme} />;
    }
  })();

  const nav = (onPick?: () => void) => (
    <nav className="nav" aria-label="Secciones">
      {SECTIONS.map((sec) => (
        <a
          key={sec.id}
          href={`#/${sec.id}`}
          aria-current={route === sec.id ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            go(sec.id);
            onPick?.();
          }}
        >
          <span className="folio">{sec.folio}</span>
          {sec.label}
          {sec.id === 'resumen' && nAvisos > 0 && <span className="chip ochre badge">{nAvisos}</span>}
        </a>
      ))}
    </nav>
  );

  const tabs: { id: SectionId; label: string; icon: ReactElement }[] = [
    { id: 'resumen', label: 'Resumen', icon: <IconHome /> },
    { id: 'gastos', label: 'Gastos', icon: <IconReceipt /> },
    { id: 'meses', label: 'Meses', icon: <IconCalendar /> },
    { id: 'hipoteca', label: 'Hipoteca', icon: <IconBank /> },
  ];
  const inTabs = tabs.some((t) => t.id === route);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Brand />
        </div>
        {nav()}
        <div className="sidebar-foot">
          <SyncPill />
        </div>
      </aside>

      <header className="topbar">
        <Brand compact />
        <SyncPill />
      </header>

      <main className="main" id="main">
        {page}
      </main>

      <nav className="bottomnav" aria-label="Navegación principal">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`#/${t.id}`}
            aria-current={route === t.id ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go(t.id);
            }}
          >
            {t.icon}
            {t.label}
            {t.id === 'resumen' && nAvisos > 0 && <span className="dotcount" aria-label={`${nAvisos} avisos`} />}
          </a>
        ))}
        <button aria-current={!inTabs ? 'page' : undefined} onClick={() => setSheet(true)}>
          <IconMore />
          Más
        </button>
      </nav>

      {sheet && (
        <div className="scrim" style={{ placeItems: 'end stretch', padding: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="sheet" role="dialog" aria-label="Todas las secciones">
            <div className="grab" />
            {nav(() => setSheet(false))}
          </div>
        </div>
      )}
    </div>
  );
}

function Welcome() {
  const s = useEngine();
  const { alert, toast } = useDialogs();
  const fileRef = useRef<HTMLInputElement>(null);
  const waitingCloud = cloudEnabled && s.session && (s.status === 'syncing' || s.status === 'loading');

  const importar = async (f: File) => {
    const r = parseBackup(await f.text());
    if (!r.ok) {
      await alert({ title: 'No se puede importar', body: r.error, danger: true });
      return;
    }
    await engine.start(r.data);
    toast(`Importado: ${r.resumen}.`);
  };

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-tiles">
          <AzaharMark className="welcome-blossom" size={220} />
          <AzaharMark className="welcome-mark" size={44} />
        </div>
        <div className="welcome-body">
          <div className="eyebrow">Castellón de la Plana</div>
          <h1>Las cuentas del piso, en orden.</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Compra, financiación, alquiler y préstamos en un solo sitio, sincronizado entre tus dispositivos.
          </p>

          {waitingCloud ? (
            <p>Descargando tus datos de la nube…</p>
          ) : (
            <>
              {cloudEnabled && !s.session && (
                <div style={{ marginTop: 18 }}>
                  <h2 style={{ fontSize: 18, marginBottom: 8 }}>Entrar</h2>
                  <SignInForm />
                  <p className="muted" style={{ fontSize: 13 }}>Si ya usas la app en otro dispositivo, al entrar se descargan tus datos.</p>
                </div>
              )}
              {s.error && <p className="neg" style={{ fontSize: 13 }}>{s.error}</p>}
              <div className="choice">
                <button className="btn primary" onClick={() => fileRef.current?.click()}>
                  <span>
                    Importar copia de seguridad (JSON)
                    <small>Del prototipo o de esta app</small>
                  </span>
                </button>
                <button className="btn" onClick={() => void engine.start(emptyData())}>
                  <span>
                    Empezar desde cero
                    <small>Rellenarás los datos en «Compra y financiación»</small>
                  </span>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void importar(f);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
