'use client';
import { useEffect, useState } from 'react';

interface OrderItem { id: string; variantName: string; quantity: number; scanned: number; barcode?: string | null; variantId?: string | null; }
interface Order { id: string; status: string; customerName?: string | null; customerEmail?: string | null; notes?: string | null; shippingDate?: string | null; locationId?: string | null; items: OrderItem[]; createdAt: string; }
interface Location { id: string; name: string; isDefault?: boolean; }

const STATUS_LABELS: Record<string, string> = { pending: 'En attente', confirmed: 'Confirmée', prepared: 'Préparée', shipped: 'Expédiée' };
const STATUS_COLORS: Record<string, string> = { pending: 'badge-pending', confirmed: 'badge-confirmed', prepared: 'badge-prepared', shipped: 'badge-shipped' };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filter, setFilter] = useState('active');
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [barcodeMsg, setBarcodeMsg] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/locations').then(r => r.json()),
    ]).then(([o, l]) => {
      setOrders(Array.isArray(o) ? o : []);
      setLocations(Array.isArray(l) ? l : []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o => {
    if (filter === 'active') return o.status === 'pending' || o.status === 'prepared';
    if (filter === 'shipped') return o.status === 'shipped';
    return true;
  });

  const refresh = () => fetch('/api/orders').then(r => r.json()).then(o => {
    const arr = Array.isArray(o) ? o : [];
    setOrders(arr);
    if (selected) setSelected(arr.find(x => x.id === selected.id) ?? null);
  });

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await refresh();
  };

  const updateLocation = async (id: string, locationId: string) => {
    await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId }) });
    await refresh();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Supprimer cette commande ?')) return;
    await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    setSelected(null);
    await refresh();
  };

  const scanBarcode = async () => {
    if (!selected || !barcode.trim()) return;
    const bc = barcode.trim();
    setBarcodeMsg('');
    const item = selected.items.find(i => i.barcode === bc);
    if (!item) {
      // try API lookup
      const res = await fetch(`/api/variants?barcode=${encodeURIComponent(bc)}`);
      if (!res.ok) { setBarcodeMsg('Code barre non reconnu'); return; }
      const variant = await res.json();
      const match = selected.items.find(i => i.variantId === variant.id);
      if (!match) { setBarcodeMsg('Produit non trouvé dans cette commande'); return; }
      if (match.scanned >= match.quantity) { setBarcodeMsg('Déjà scanné entièrement'); return; }
      await fetch(`/api/orders/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: match.id, scanned: match.scanned + 1 }) });
    } else {
      if (item.scanned >= item.quantity) { setBarcodeMsg('Déjà scanné entièrement'); return; }
      await fetch(`/api/orders/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id, scanned: item.scanned + 1 }) });
    }
    setBarcode('');
    await refresh();
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 3rem)' }}>
      {/* List */}
      <div style={{ width: '22rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['active', 'shipped', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ flex: 1, padding: '0.375rem', borderRadius: '0.5rem', border: '1px solid #2a3045', background: filter === f ? '#1a2035' : 'none', color: filter === f ? '#e2e8f0' : '#64748b', fontSize: '0.75rem', fontWeight: filter === f ? 600 : 400 }}>
              {f === 'active' ? 'Actives' : f === 'shipped' ? 'Expédiées' : 'Toutes'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading && <p style={{ color: '#475569', fontSize: '0.875rem' }}>Chargement…</p>}
          {filtered.map(o => {
            const total = o.items.reduce((s, i) => s + i.quantity, 0);
            const scanned = o.items.reduce((s, i) => s + i.scanned, 0);
            return (
              <div key={o.id} onClick={() => setSelected(o)}
                style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1px solid ${selected?.id === o.id ? '#3b82f6' : '#2a3045'}`, background: selected?.id === o.id ? '#1a2035' : '#141824', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span className={`badge ${STATUS_COLORS[o.status] || 'badge-confirmed'}`}>{STATUS_LABELS[o.status] || o.status}</span>
                  <span style={{ fontSize: '0.7rem', color: '#475569' }}>{new Date(o.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <p style={{ margin: '0 0 0.125rem', fontSize: '0.875rem', color: '#e2e8f0', fontWeight: 600 }}>{o.customerName || o.customerEmail || 'Client'}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{total} art. · {scanned} scanné{scanned !== 1 ? 's' : ''}</p>
                {o.shippingDate && <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: '#f59e0b' }}>📅 {new Date(o.shippingDate).toLocaleDateString('fr-FR')}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 700 }}>{selected.customerName || selected.customerEmail || 'Client'}</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>#{selected.id.slice(0, 8)} · <span className={`badge ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status] || selected.status}</span></p>
            </div>
            <button onClick={() => deleteOrder(selected.id)} className="btn-danger" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>Supprimer</button>
          </div>

          {selected.notes && <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', background: '#0f1629', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>{selected.notes}</p>}

          {/* Location picker */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Zone de stockage</label>
            <select
              value={selected.locationId || ''}
              onChange={e => updateLocation(selected.id, e.target.value)}
              style={{ width: 'auto', minWidth: '12rem' }}
            >
              <option value="">— Aucune —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault ? '★ ' : ''}{l.name}</option>)}
            </select>
          </div>

          {/* Barcode scan */}
          {(selected.status === 'pending' || selected.status === 'confirmed' || selected.status === 'prepared') && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Scanner un code barre</label>
                <input value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') scanBarcode(); }} placeholder="Code barre…" />
              </div>
              <button onClick={scanBarcode} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Valider</button>
            </div>
          )}
          {barcodeMsg && <p style={{ margin: 0, fontSize: '0.8125rem', color: '#ef4444' }}>{barcodeMsg}</p>}

          {/* Items */}
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>Qté</th>
                <th>Scanné</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map(item => (
                <tr key={item.id}>
                  <td>{item.variantName}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <span style={{ color: item.scanned >= item.quantity ? '#22c55e' : item.scanned > 0 ? '#f59e0b' : '#64748b', fontWeight: 600 }}>
                      {item.scanned}/{item.quantity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {selected.status === 'pending' && (
              <button onClick={() => updateStatus(selected.id, 'prepared')} className="btn-primary">Marquer préparée</button>
            )}
            {selected.status === 'prepared' && (
              <button onClick={() => updateStatus(selected.id, 'shipped')}
                style={{ background: '#14532d', color: '#86efac', border: '1px solid #166534', borderRadius: '0.5rem', padding: '0.625rem 1rem', fontWeight: 600, fontSize: '0.875rem' }}>
                📦 Marquer expédiée
              </button>
            )}
            {selected.status === 'shipped' && (
              <button onClick={() => updateStatus(selected.id, 'pending')} className="btn-ghost" style={{ fontSize: '0.8125rem' }}>Réouvrir</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#475569' }}>Sélectionnez une commande</p>
        </div>
      )}
    </div>
  );
}
