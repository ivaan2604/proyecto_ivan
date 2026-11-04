import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import './styles/app.css';
import './styles/identidad.css';
import './theme';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { DEMO } from './demo';
import { engine } from './sync/engine';

// La demo no se instala como app ni deja service worker
if (!DEMO) registerSW({ immediate: true });
if (DEMO) document.title = 'Piso (demo)';

void engine.init().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
