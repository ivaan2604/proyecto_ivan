import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Diálogos y avisos propios. NUNCA se usan alert/confirm/prompt nativos: en iframes o
 * entornos restringidos pueden bloquearse y fallar en silencio.
 */

interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** Texto que el usuario debe escribir para habilitar el botón (confirmación fuerte) */
  typeToConfirm?: string;
}

interface ModalState extends ConfirmOpts {
  kind: 'confirm' | 'alert';
  resolve: (v: boolean) => void;
}

interface Toast {
  id: number;
  text: string;
  error?: boolean;
}

interface DialogApi {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  alert: (o: Omit<ConfirmOpts, 'cancelText' | 'typeToConfirm'>) => Promise<void>;
  toast: (text: string, opts?: { error?: boolean }) => void;
}

const Ctx = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('DialogProvider ausente');
  return c;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setModal({ ...o, kind: 'confirm', resolve })),
    [],
  );
  const alert = useCallback(
    (o: Omit<ConfirmOpts, 'cancelText' | 'typeToConfirm'>) =>
      new Promise<void>((resolve) => setModal({ ...o, kind: 'alert', resolve: () => resolve() })),
    [],
  );
  const toast = useCallback((text: string, opts?: { error?: boolean }) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, error: opts?.error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.error ? 6000 : 3200);
  }, []);

  const close = (v: boolean) => {
    modal?.resolve(v);
    setModal(null);
  };

  return (
    <Ctx.Provider value={{ confirm, alert, toast }}>
      {children}
      {modal && <ModalView m={modal} onClose={close} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ModalView({ m, onClose }: { m: ModalState; onClose: (v: boolean) => void }) {
  const [typed, setTyped] = useState('');
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = !!m.typeToConfirm && typed.trim().toUpperCase() !== m.typeToConfirm.toUpperCase();

  useEffect(() => {
    (m.typeToConfirm ? inputRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [m, onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className={`modal${m.danger ? ' danger' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">{m.title}</h2>
        {m.body && <div className="body">{m.body}</div>}
        {m.typeToConfirm && (
          <label className="field" style={{ marginTop: 16 }}>
            <span>
              Escribe <b>{m.typeToConfirm}</b> para confirmar
            </span>
            <input
              ref={inputRef}
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              onKeyDown={(e) => e.key === 'Enter' && !blocked && onClose(true)}
            />
          </label>
        )}
        <div className="actions">
          {m.kind === 'confirm' && (
            <button className="btn ghost" onClick={() => onClose(false)}>
              {m.cancelText ?? 'Cancelar'}
            </button>
          )}
          <button
            ref={okRef}
            className={`btn ${m.danger ? 'danger' : 'primary'}`}
            disabled={blocked}
            onClick={() => onClose(true)}
          >
            {m.confirmText ?? (m.kind === 'alert' ? 'Entendido' : 'Aceptar')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal genérico controlado (para contenido propio: conflicto, historial…) */
export function Modal({
  title, children, onClose, wide, actions,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => onClose && e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}
