import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import './styles/app.css';
import './styles/identidad.css';
import './theme';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { engine } from './sync/engine';

registerSW({ immediate: true });

void engine.init().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
