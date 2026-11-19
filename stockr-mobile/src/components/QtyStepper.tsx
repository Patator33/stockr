interface Props {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  invalid?: boolean;
  width?: string;
  required?: boolean;
}

// Champ numérique avec boutons − / + (la saisie au clavier reste possible).
export default function QtyStepper({ value, onChange, min = 0, max, invalid, width = '3.5rem', required }: Props) {
  const current = Math.floor(Number(value) || 0);
  const set = (n: number) => {
    const clamped = Math.max(min, max !== undefined ? Math.min(max, n) : n);
    onChange(String(clamped));
  };
  const btn = {
    width: '2.25rem', height: '2.5rem', flexShrink: 0, background: '#141824', border: '1px solid #2a3045',
    color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 700, cursor: 'pointer', padding: 0, lineHeight: 1,
  } as const;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <button type="button" aria-label="Moins" style={{ ...btn, borderRadius: '0.5rem 0 0 0.5rem' }}
        disabled={current <= min} onClick={() => set(current - 1)}>−</button>
      <input
        type="number" inputMode="numeric" min={min} max={max} placeholder="0" required={required}
        value={value} onChange={e => onChange(e.target.value)}
        style={{ width, margin: 0, textAlign: 'center', borderRadius: 0, borderColor: invalid ? '#ef4444' : undefined }}
      />
      <button type="button" aria-label="Plus" style={{ ...btn, borderRadius: '0 0.5rem 0.5rem 0' }}
        disabled={max !== undefined && current >= max} onClick={() => set(current + 1)}>+</button>
    </div>
  );
}
