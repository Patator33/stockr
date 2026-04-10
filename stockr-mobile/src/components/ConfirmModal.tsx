interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({ message, onConfirm, onCancel, danger = false }: ConfirmModalProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#1e2535', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '20rem' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-text-main text-base mb-4">{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} className="btn-ghost" style={{ flex: 1 }}>Annuler</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '0.625rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              background: danger ? '#ef4444' : '#2b8cee',
              color: 'white',
            }}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
