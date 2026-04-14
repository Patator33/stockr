'use client';
import { useEffect, useState } from 'react';
import { wGet, wFetch } from '../_api';

interface OrderItem { id: string; variantName: string; quantity: number; scanned: number; barcode?: string | null; variantId?: string | null; variant?: { name: string; product?: { name: string } } | null; }
interface Order { id: string; status: string; customerName?: string | null; customerEmail?: string | null; notes?: string | null; shippingDate?: string | null; locationId?: string | null; items: OrderItem[]; createdAt: string; }
interface Location { id: string; name: string; isDefault?: boolean; }
interface Variant { id: string; name: string; barcode?: string | null; supplierRef?: string | null; }

const STATUS_LABELS: Record<string, string> = { pending: 'En attente', confirmed: 'Confirmée', prepared: 'Préparée', shipped: 'Expédiée' };
const STATUS_COLORS: Record<string, string> = { pending: 'badge-pending', confirmed: 'badge-confirmed', prepared: 'badge-prepared', shipped: 'badge-shipped' };

interface NewOrderItem { variantId: string; variantName: string; quantity: number; }

export default function OrdersPage() {
  const [orders,    setOrders]    = useState<Order[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [variants,  setVariants]  = useState<Variant[]>([]);
  const [filter,    setFilter]    = useState('active');
  const [selected,  setSelected]  = useState<Order | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [barcode,   setBarcode]   = useState('');
  const [barcodeMsg, setBarcodeMsg] = useState('');

  // New order creation state
  const [showCreate, setShowCreate] = useState(false);
  const [newOrder, setNewOrder] = useState({ customerName: '', customerEmail: '', notes: '', shippingDate: '', locationId: '' });
  const [newItems, setNewItems] = useState<NewOrderItem[]>([{ variantId: '', variantName: '', quantity: 1 }]);
  const [createErr, setCreateErr] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const loadAll = () =>
    Promise.all([
      wGet<Order[]>('/api/orders'),
      wGet<Location[]>('/api/locations'),
    ]).then(([o, l]) => {
      setOrders(o);
      setLocations(l);
      const def = l.find(x => x.isDefault);
      setNewOrder(f => ({ ...f, locationId: def?.id || '' }));
    }).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => {
    loadAll();
    wGet<Variant[]>('/api/variants').then(setVariants).catch(() => {});
  }, []);

  const refresh = () =>
    wGet<Order[]>('/api/orders').then(arr => {
      setOrders(arr);
      if (selected) setSelected(arr.find(x => x.id === selected.id) ?? null);
    }).catch(() => {});

  const selectOrder = (o: Order) => {
    if (!o.locationId) {
      const def = locations.find(l => l.isDefault);
      if (def) {
        setSelected({ ...o, locationId: def.id });
        updateLocation(o.id, def.id);
        return;
      }
    }
    setSelected(o);
  };

  const filtered = orders.filter(o =>
    filter === 'active'  ? (o.status === 'pending' || o.status === 'prepared') :
    filter === 'shipped' ? o.status === 'shipped' : true
  );

  const updateStatus = async (id: string, status: string) => {
    await wFetch(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await refresh();
  };

  const updateLocation = async (id: string, locationId: string) => {
    await wFetch(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ locationId }) });
    await refresh();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Supprimer cette commande ?')) return;
    await wFetch(`/api/orders/${id}`, { method: 'DELETE' });
    setSelected(null);
    await refresh();
  };

  const scanBarcode = async () => {
    if (!selected || !barcode.trim()) return;
    const bc = barcode.trim();
    setBarcodeMsg('');
    let item = selected.items.find(i => i.barcode === bc);
    if (!item) {
      const res = await wFetch(`/api/variants?barcode=${encodeURIComponent(bc)}`);
      if (!res.ok) { setBarcodeMsg('Code barre non reconnu'); return; }
      const variant = await res.json();
      item = selected.items.find(i => i.variantId === variant.id);
      if (!item) { setBarcodeMsg('Produit non trouvé dans cette commande'); return; }
    }
    if (item.scanned >= item.quantity) { setBarcodeMsg('Déjà scanné entièrement'); return; }
    await wFetch(`/api/orders/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ itemId: item.id, scanned: item.scanned + 1 }) });
    setBarcode('');
    await refresh();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr('');
    setCreateLoading(true);
    try {
      const items = newItems
        .filter(i => i.variantId || i.variantName)
        .map(i => {
          const v = variants.find(x => x.id === i.variantId);
          return { variantName: i.variantName || v?.name || '', quantity: i.quantity, barcode: v?.barcode || undefined };
        });
      if (items.length === 0) { setCreateErr('Ajoutez au moins un article'); setCreateLoading(false); return; }
      const res = await wFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...newOrder,
          source: 'web',
          shippingDate: newOrder.shippingDate || null,
          items,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setCreateErr(d.error || 'Erreur'); setCreateLoading(false); return; }
      setShowCreate(false);
      setNewOrder({ customerName: '', customerEmail: '', notes: '', shippingDate: '', locationId: locations.find(l => l.isDefault)?.id || '' });
      setNewItems([{ variantId: '', variantName: '', quantity: 1 }]);
      await loadAll();
      selectOrder(d);
    } catch (err) { setCreateErr(err instanceof Error ? err.message : 'Erreur'); }
    finally { setCreateLoading(false); }
  };

  const setNewItem = (i: number, field: keyof NewOrderItem, val: string | number) => {
    setNewItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: val };
      if (field === 'variantId') {
        const v = variants.find(x => x.id === val);
        if (v) updated.variantName = v.name;
      }
      return updated;
    }));
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

        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary" style={{ fontSize: '0.8125rem' }}>
          {showCreate ? '✕ Annuler' : '+ Nouvelle commande'}
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading && <p style={{ color: '#475569', fontSize: '0.875rem' }}>Chargement…</p>}
          {filtered.map(o => {
            const total   = o.items.reduce((s, i) => s + i.quantity, 0);
            const scanned = o.items.reduce((s, i) => s + i.scanned, 0);
            const ageDays = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 86400000);
            return (
              <div key={o.id} onClick={() => selectOrder(o)}
                style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1px solid ${selected?.id === o.id ? '#3b82f6' : '#2a3045'}`, background: selected?.id === o.id ? '#1a2035' : '#141824', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span className={`badge ${STATUS_COLORS[o.status] || 'badge-confirmed'}`}>{STATUS_LABELS[o.status] || o.status}</span>
                  <span style={{ fontSize: '0.7rem', color: '#475569' }}>{new Date(o.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <p style={{ margin: '0 0 0.125rem', fontSize: '0.875rem', color: '#e2e8f0', fontWeight: 600 }}>{o.customerName || o.customerEmail || 'Client'}</p>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{total} art. · {scanned} scanné{scanned !== 1 ? 's' : ''}</p>
                  {ageDays >= 7 && o.status === 'pending' && <span style={{ fontSize: '0.65rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.25rem', padding: '0.05rem 0.3rem' }}>J+{ageDays}</span>}
                </div>
                {o.shippingDate && <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: '#f59e0b' }}>📅 {new Date(o.shippingDate).toLocaleDateString('fr-FR')}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Create form or Detail */}
      {showCreate ? (
        <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Nouvelle commande</h2>
          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Nom client</label>
                <input value={newOrder.customerName} onChange={e => setNewOrder(f => ({ ...f, customerName: e.target.value }))} placeholder="Nom…" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Email client</label>
                <input type="email" value={newOrder.customerEmail} onChange={e => setNewOrder(f => ({ ...f, customerEmail: e.target.value }))} placeholder="email@…" />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Date d'expédition</label>
                <input type="date" value={newOrder.shippingDate} onChange={e => setNewOrder(f => ({ ...f, shippingDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Zone de stockage</label>
                <select value={newOrder.locationId} onChange={e => setNewOrder(f => ({ ...f, locationId: e.target.value }))}>
                  <option value="">— Aucune —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault ? '★ ' : ''}{l.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Notes</label>
                <input value={newOrder.notes} onChange={e => setNewOrder(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Articles</label>
                <button type="button" onClick={() => setNewItems(p => [...p, { variantId: '', variantName: '', quantity: 1 }])}
                  style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', cursor: 'pointer' }}>+ Ajouter article</button>
              </div>
              {newItems.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', marginBottom: '0.375rem', alignItems: 'end' }}>
                  <select value={item.variantId} onChange={e => setNewItem(i, 'variantId', e.target.value)}>
                    <option value="">— Variante —</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <input type="number" min={1} value={item.quantity} onChange={e => setNewItem(i, 'quantity', Number(e.target.value))} style={{ width: '5rem' }} />
                  {newItems.length > 1 && (
                    <button type="button" onClick={() => setNewItems(p => p.filter((_, idx) => idx !== i))}
                      style={{ background: 'none', border: '1px solid #7f1d1d', borderRadius: '0.375rem', color: '#ef4444', fontSize: '0.75rem', padding: '0.375rem 0.5rem' }}>✕</button>
                  )}
                </div>
              ))}
            </div>

            {createErr && <p style={{ margin: 0, color: '#ef4444', fontSize: '0.875rem' }}>{createErr}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn-primary" disabled={createLoading}>{createLoading ? '…' : 'Créer la commande'}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Annuler</button>
            </div>
          </form>
        </div>
      ) : selected ? (
        <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 700 }}>{selected.customerName || selected.customerEmail || 'Client'}</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>#{selected.id.slice(0, 8)} · <span className={`badge ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status] || selected.status}</span></p>
            </div>
            <button onClick={() => deleteOrder(selected.id)} className="btn-danger" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>Supprimer</button>
          </div>

          {selected.notes && <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', background: '#0f1629', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>{selected.notes}</p>}

          <div>
            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Zone de stockage</label>
            <select value={selected.locationId || ''} onChange={e => updateLocation(selected.id, e.target.value)} style={{ width: 'auto', minWidth: '12rem' }}>
              <option value="">— Aucune —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault ? '★ ' : ''}{l.name}</option>)}
            </select>
          </div>

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

          <table>
            <thead><tr><th>Article</th><th>Qté</th><th>Scanné</th></tr></thead>
            <tbody>
              {selected.items.map(item => (
                <tr key={item.id}>
                  <td>{item.variant?.name || item.variantName}</td>
                  <td>{item.quantity}</td>
                  <td><span style={{ color: item.scanned >= item.quantity ? '#22c55e' : item.scanned > 0 ? '#f59e0b' : '#64748b', fontWeight: 600 }}>{item.scanned}/{item.quantity}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

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
          <p style={{ color: '#475569' }}>Sélectionnez une commande ou créez-en une</p>
        </div>
      )}
    </div>
  );
}
