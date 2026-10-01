import { useEffect, useState, type ReactNode } from 'react';
import { centsToInput, parseMoney, parsePct } from '../lib/format';
import type { Estado } from '../lib/model';
import { IconCheck } from './icons';

/** Campo de texto que confirma el valor al salir (blur) o con Enter. */
function useDraft<T>(value: T, format: (v: T) => string) {
  const [draft, setDraft] = useState(format(value));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(format(value));
  }, [value, focused, format]);
  return { draft, setDraft, focused, setFocused, invalid, setInvalid };
}

interface MoneyProps {
  value: number;
  onChange: (cents: number) => void;
  allowNegative?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  suffix?: string;
}

export function MoneyInput({ value, onChange, allowNegative, placeholder = '0,00', ariaLabel, suffix = '€' }: MoneyProps) {
  const s = useDraft(value, centsToInput);
  const commit = () => {
    s.setFocused(false);
    const v = parseMoney(s.draft);
    if (v === null || (!allowNegative && v < 0)) {
      s.setInvalid(true);
      s.setDraft(centsToInput(value));
      setTimeout(() => s.setInvalid(false), 1200);
      return;
    }
    if (v !== value) onChange(v);
    s.setDraft(centsToInput(v));
  };
  return (
    <span className="affix" data-suffix={suffix}>
      <input
        className={`input money${s.invalid ? ' invalid' : ''}`}
        inputMode="decimal"
        value={s.draft}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={(e) => {
          s.setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => s.setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </span>
  );
}

/** Importe opcional: vacío = automático (null). */
export function OptionalMoneyInput({
  value, auto, onChange, ariaLabel,
}: { value: number | null; auto: number; onChange: (v: number | null) => void; ariaLabel?: string }) {
  const fmt = (v: number | null) => (v === null ? '' : centsToInput(v));
  const s = useDraft(value, fmt);
  const commit = () => {
    s.setFocused(false);
    if (s.draft.trim() === '') {
      if (value !== null) onChange(null);
      return;
    }
    const v = parseMoney(s.draft);
    if (v === null || v < 0) {
      s.setInvalid(true);
      s.setDraft(fmt(value));
      setTimeout(() => s.setInvalid(false), 1200);
      return;
    }
    if (v !== value) onChange(v);
  };
  return (
    <span className="affix" data-suffix="€">
      <input
        className={`input money${s.invalid ? ' invalid' : ''}`}
        inputMode="decimal"
        value={s.draft}
        placeholder={centsToInput(auto) || '0'}
        aria-label={ariaLabel}
        title="Vacío = valor calculado automáticamente"
        onFocus={(e) => {
          s.setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => s.setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </span>
  );
}

export function NumberInput({
  value, onChange, suffix, step, ariaLabel,
}: { value: number; onChange: (v: number) => void; suffix?: string; step?: number; ariaLabel?: string }) {
  const fmt = (v: number) => (v ? v.toLocaleString('es-ES', { maximumFractionDigits: 4, useGrouping: false }) : '');
  const s = useDraft(value, fmt);
  const commit = () => {
    s.setFocused(false);
    const v = parsePct(s.draft);
    if (v === null || v < 0) {
      s.setInvalid(true);
      s.setDraft(fmt(value));
      setTimeout(() => s.setInvalid(false), 1200);
      return;
    }
    if (v !== value) onChange(v);
  };
  return (
    <span className="affix" data-suffix={suffix ?? ''}>
      <input
        className={`input numeric${s.invalid ? ' invalid' : ''}`}
        inputMode="decimal"
        value={s.draft}
        placeholder="0"
        step={step}
        aria-label={ariaLabel}
        onFocus={() => s.setFocused(true)}
        onChange={(e) => s.setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </span>
  );
}

export function TextInput({
  value, onChange, placeholder, ariaLabel,
}: { value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string }) {
  const s = useDraft(value, (v) => v);
  return (
    <input
      className="input"
      value={s.draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => s.setFocused(true)}
      onChange={(e) => s.setDraft(e.target.value)}
      onBlur={() => {
        s.setFocused(false);
        if (s.draft !== value) onChange(s.draft);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export function TextArea({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const s = useDraft(value, (v) => v);
  return (
    <textarea
      className="input"
      rows={rows}
      value={s.draft}
      placeholder={placeholder}
      onFocus={() => s.setFocused(true)}
      onChange={(e) => s.setDraft(e.target.value)}
      onBlur={() => {
        s.setFocused(false);
        if (s.draft !== value) onChange(s.draft);
      }}
    />
  );
}

export function DateInput({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <input
      type="date"
      className="input"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Field({ label, hint, wide, children }: { label: string; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function EstadoToggle({ value, onChange }: { value: Estado; onChange: (v: Estado) => void }) {
  const on = value === 'pagado';
  return (
    <button
      type="button"
      className={`toggle${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={() => onChange(on ? 'pendiente' : 'pagado')}
    >
      <span className="knob">{on && <IconCheck width={11} height={11} />}</span>
      {on ? 'Pagado' : 'Pendiente'}
    </button>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, ariaLabel,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
