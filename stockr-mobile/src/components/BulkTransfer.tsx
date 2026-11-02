import { useEffect, useState } from 'react';
import { api, type Location, type StockItem } from '../api';

interface Props {
  locations: Location[];
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}

export default function BulkTransfer({ locations, onCancel, onDone }: Props) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [items, setItems] = useState<StockItem[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadItems = async (locationId: string) => {
    const all = await api.stocks.byProduct();
    setItems((all.find(s => s.location.id === locationId)?.items ?? []).filter(i => i.quantity > 0));
  };

  useEffect(() => {
    setQty({});
    setError('');
    if (!fromId) { setItems([]); return; }
    loadItems(fromId).catch(() => setError('Impossible de charger le stock de cette zone'));
  }, [fromId]);

  const lines = items.map(i => ({ variantId: i.variantId, quantity: Math.floor(Number(qty[i.variantId]) || 0), max: i.quantity }));
  const toMove = lines.filter(l => l.quantity > 0);
  const total = toMove.reduce((a, l) => a + l.quantity, 0);
  const tooMuch = lines.some(l => l.quantity > l.max);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.stocks.transferBulk({
        fromLocationId: fromId,
        toLocationId: toId,
        notes: notes.trim() || undefined,
        items: toMove.map(l => ({ variantId: l.variantId, quantity: l.quantity })),
      });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const label = 'text-text-muted text-xs uppercase tracking-wide block mb-1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        <label className={label}>Zone de départ</label>
        <select value={fromId} onChange={e => { setFromId(e.target.value); if (e.target.value === toId) setToId(''); }}>
          <option value="">Choisir une zone…</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Zone d'arrivée</label>
        <select value={toId} onChange={e => setToId(e.target.value)}>
          <option value="">Choisir une zone…</option>
          {locations.filter(l => l.id !== fromId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {fromId && items.length === 0 && !error && (
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Aucun article en stock dans cette zone.</p>
      )}

      {items.length > 0 && (
        <div style={{ maxHeight: '38vh', overflowY: 'auto', border: '1px solid #2a3045', borderRadius: '0.75rem' }}>
          {items.map(i => {
            const v = Math.floor(Number(qty[i.variantId]) || 0);
            return (
              <div key={i.variantId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid #1e2535' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: '#e2e8f0' }}>{i.variantName}</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>{i.productName} · en stock : {i.quantity}</p>
                </div>
                <input
                  type="number" inputMode="numeric" min={0} max={i.quantity} placeholder="0"
                  value={qty[i.variantId] ?? ''}
                  onChange={e => setQty(q => ({ ...q, [i.variantId]: e.target.value }))}
                  style={{ width: '4.5rem', margin: 0, textAlign: 'center', borderColor: v > i.quantity ? '#ef4444' : undefined }}
                />
                <button
                  type="button"
                  onClick={() => setQty(q => ({ ...q, [i.variantId]: String(i.quantity) }))}
                  style={{ background: 'none', border: '1px solid #2a3045', borderRadius: '0.375rem', color: '#a855f7', fontSize: '0.7rem', padding: '0.375rem 0.5rem', cursor: 'pointer' }}
                >Tout</button>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div>
          <label className={label}>Remarque (facultatif)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Remarque…" />
        </div>
      )}

      {tooMuch && <p style={{ color: '#ef4444', fontSize: '0.8125rem', margin: 0 }}>Une quantité dépasse le stock disponible.</p>}
      {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
        <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Annuler</button>
        <button
          type="button" className="btn-primary" style={{ flex: 2, background: '#a855f7' }}
          disabled={busy || !fromId || !toId || total === 0 || tooMuch}
          onClick={submit}
        >
          {busy ? '…' : total > 0 ? `Déplacer ${total} unité${total > 1 ? 's' : ''}` : 'Déplacer'}
        </button>
      </div>
    </div>
  );
}
