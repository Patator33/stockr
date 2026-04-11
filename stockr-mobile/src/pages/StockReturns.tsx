import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ProductDetail, type Location } from '../api';

interface ReturnItem {
  variantId: string;
  variantName: string;
  productName: string;
  quantity: number;
}

export default function StockReturns() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [prods, locs] = await Promise.all([api.products.list(), api.locations.list()]);
    const details = await Promise.all(prods.map(p => api.products.get(p.id)));
    setProducts(details);
    setLocations(locs);
    const def = locs.find(l => l.isDefault);
    if (def) setSelectedLocationId(def.id);
    setItems(
      details.flatMap(p =>
        p.variants.map(v => ({
          variantId: v.id,
          variantName: v.name,
          productName: p.name,
          quantity: 0,
        }))
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setQty = (variantId: string, value: string) => {
    const qty = Math.max(0, parseInt(value) || 0);
    setItems(prev => prev.map(i => i.variantId === variantId ? { ...i, quantity: qty } : i));
  };

  const totalItems = items.filter(i => i.quantity > 0).length;

  const handleSubmit = async () => {
    const toReturn = items.filter(i => i.quantity > 0);
    if (toReturn.length === 0) return;
    if (!selectedLocationId) { setError('Choisissez une zone de stockage'); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await api.stockReturns.bulk(
        toReturn.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
        selectedLocationId
      );
      const locName = locations.find(l => l.id === selectedLocationId)?.name || '';
      setSuccess(`✓ ${result.count} variante${result.count > 1 ? 's' : ''} remise${result.count > 1 ? 's' : ''} en stock${locName ? ` → ${locName}` : ''}`);
      setItems(prev => prev.map(i => ({ ...i, quantity: 0 })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '0.875rem' }}>Chargement…</div>;

  // Group by product
  const grouped = products.map(p => ({
    product: p,
    items: items.filter(i => i.productName === p.name),
  })).filter(g => g.items.length > 0);

  return (
    <div className="pb-nav safe-top" style={{ padding: '1rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/manage')} style={{ background: 'none', border: 'none', color: '#2b8cee', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>‹</button>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>↩ Retours de stock</h1>
      </div>

      {locations.length > 0 && (
        <div style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '0.8125rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>🏭 Zone</span>
          <select
            value={selectedLocationId}
            onChange={e => setSelectedLocationId(e.target.value)}
            style={{ flex: 1, margin: 0, fontSize: '0.8125rem' }}
          >
            <option value="">Choisir…</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}{l.isDefault ? ' ★' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <p style={{ color: '#64748b', fontSize: '0.8125rem', marginBottom: '1rem' }}>
        Saisissez les quantités à remettre en stock.
      </p>

      {success && (
        <div onClick={() => setSuccess('')} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem', color: '#22c55e', fontSize: '0.9rem', cursor: 'pointer' }}>
          {success}
        </div>
      )}
      {error && (
        <div onClick={() => setError('')} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem', color: '#ef4444', fontSize: '0.875rem', cursor: 'pointer' }}>
          {error}
        </div>
      )}

      {grouped.map(({ product, items: gItems }) => (
        <div key={product.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ padding: '0.625rem 1rem', borderBottom: '1px solid #2a3045', background: '#1e2535' }}>
            <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.9375rem' }}>{product.name}</span>
          </div>
          {gItems.map(item => (
            <div key={item.variantId} style={{ display: 'flex', alignItems: 'center', padding: '0.625rem 1rem', borderBottom: '1px solid #1a2030', gap: '0.75rem' }}>
              <span style={{ flex: 1, fontSize: '0.875rem', color: item.quantity > 0 ? '#e2e8f0' : '#94a3b8' }}>{item.variantName}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <button
                  onClick={() => setQty(item.variantId, String(Math.max(0, item.quantity - 1)))}
                  style={{ width: '2rem', height: '2rem', background: '#2a3045', border: 'none', borderRadius: '0.375rem', color: '#e2e8f0', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >−</button>
                <input
                  type="number"
                  min="0"
                  value={item.quantity || ''}
                  onChange={e => setQty(item.variantId, e.target.value)}
                  placeholder="0"
                  style={{ width: '3.5rem', textAlign: 'center', margin: 0, padding: '0.25rem 0.375rem', fontSize: '1rem', fontWeight: 700, color: item.quantity > 0 ? '#22c55e' : '#e2e8f0' }}
                />
                <button
                  onClick={() => setQty(item.variantId, String(item.quantity + 1))}
                  style={{ width: '2rem', height: '2rem', background: '#2a3045', border: 'none', borderRadius: '0.375rem', color: '#e2e8f0', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {totalItems > 0 && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: '100%', padding: '0.875rem', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '0.75rem', color: '#22c55e', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem' }}
        >
          {submitting ? 'Enregistrement…' : `↩ Remettre en stock (${totalItems} variante${totalItems > 1 ? 's' : ''})`}
        </button>
      )}
    </div>
  );
}
