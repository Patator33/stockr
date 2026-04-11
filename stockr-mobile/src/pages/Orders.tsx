import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, type Order, type OrderItem } from '../api';
import { scanBarcode } from '../components/BarcodeScanner';
import PullToRefresh from '../components/PullToRefresh';
import ConfirmModal from '../components/ConfirmModal';
import { useOrders } from '../hooks/useOrders';

function statusLabel(s: string) {
  if (s === 'pending') return { label: 'En attente', color: '#f59e0b' };
  if (s === 'confirmed') return { label: 'Confirmée', color: '#2b8cee' };
  if (s === 'prepared') return { label: 'Préparée', color: '#818cf8' };
  if (s === 'shipped') return { label: 'Expédiée', color: '#22c55e' };
  return { label: s, color: '#64748b' };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orders, reload } = useOrders();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locations, setLocations] = useState<import('../api').Location[]>([]);

  // Load locations once
  useEffect(() => { api.locations.list().then(setLocations).catch(() => {}); }, []);

  // Open order directly if navigated from dashboard
  useEffect(() => {
    const orderId = (location.state as { orderId?: string } | null)?.orderId;
    if (orderId && orders.length > 0) {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        api.orders.get(orderId).then(fresh => setSelectedOrder(fresh)).catch(() => setSelectedOrder(order));
        navigate('/orders', { replace: true, state: {} });
      }
    }
  }, [location.state, orders]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.orders.delete(deleteTarget);
    setDeleteTarget(null);
    if (selectedOrder?.id === deleteTarget) setSelectedOrder(null);
    await reload();
  };

  const handleScanItem = async () => {
    if (!selectedOrder) return;
    setScanning(true);
    setScanError('');
    setScanSuccess('');
    try {
      const code = await scanBarcode();
      if (!code) return;

      // 1. Direct match on OrderItem.barcode or linked variant barcode
      let item = selectedOrder.items.find(i =>
        i.barcode === code || i.variant?.barcode === code
      );

      // 2. Fallback: lookup variant by barcode via API, match by variantId
      if (!item) {
        try {
          const variant = await api.variants.findByBarcode(code);
          if (variant) {
            item = selectedOrder.items.find(i => i.variantId === variant.id);
          }
        } catch { /* variant not found in DB */ }
      }

      if (!item) {
        const expected = selectedOrder.items
          .map(i => i.variant?.barcode || i.barcode)
          .filter(Boolean)
          .join(', ');
        setScanError(`Code barre non reconnu : ${code}${expected ? ` (attendus : ${expected})` : ''}`);
        return;
      }

      if (item.scanned >= item.quantity) {
        setScanError(`${item.variantName} : déjà entièrement scanné (${item.scanned}/${item.quantity})`);
        return;
      }

      const newScanned = item.scanned + 1;
      await api.orders.updateItemScanned(selectedOrder.id, item.id, newScanned);

      // Refresh order
      const updated = await api.orders.get(selectedOrder.id);
      setSelectedOrder(updated);
      setScanSuccess(`✓ ${item.variantName} — ${newScanned}/${item.quantity}`);

      // Auto-set to "prepared" if all items fully scanned
      const allDone = updated.items.every(i => i.scanned >= i.quantity);
      if (allDone && updated.status !== 'prepared' && updated.status !== 'shipped') {
        await api.orders.updateStatus(updated.id, 'prepared');
        const prepared = await api.orders.get(updated.id);
        setSelectedOrder(prepared);
        await reload();
      }
    } catch (e) {
      setScanError(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setScanning(false);
    }
  };

  const handleMarkConfirmed = async (order: Order) => {
    await api.orders.updateStatus(order.id, 'confirmed');
    const updated = await api.orders.get(order.id);
    setSelectedOrder(updated);
    await reload();
  };

  const filtered = statusFilter ? orders.filter(o => o.status === statusFilter) : orders;

  // --- Order detail view ---
  if (selectedOrder) {
    const allScanned = selectedOrder.items.every(i => i.scanned >= i.quantity);
    const { label, color } = statusLabel(selectedOrder.status);

    return (
      <div className="pb-nav safe-top" style={{ padding: '1rem', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <button onClick={() => { setSelectedOrder(null); setScanError(''); }} style={{ background: 'none', border: 'none', color: '#2b8cee', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>‹</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
              {selectedOrder.customerName || selectedOrder.customerEmail || 'Commande'}
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{fmtDate(selectedOrder.createdAt)}</p>
          </div>
          <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '9999px', padding: '0.125rem 0.625rem', fontSize: '0.75rem', fontWeight: 600 }}>
            {label}
          </span>
        </div>

        {scanSuccess && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem', color: '#22c55e', fontSize: '0.9375rem', fontWeight: 600 }}>
            {scanSuccess}
          </div>
        )}
        {scanError && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem', color: '#ef4444', fontSize: '0.875rem' }}>
            {scanError}
          </div>
        )}

        {selectedOrder.shippingDate && (
          <div style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', marginBottom: '0.75rem', fontSize: '0.8125rem', color: '#818cf8' }}>
            📅 Expédition prévue : {new Date(selectedOrder.shippingDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        )}
        {selectedOrder.notes && (
          <div style={{ background: 'rgba(43,140,238,0.06)', border: '1px solid rgba(43,140,238,0.2)', borderRadius: '0.75rem', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
            {selectedOrder.notes}
          </div>
        )}

        {/* Location picker */}
        {locations.length > 0 && selectedOrder.status !== 'shipped' && (
          <div style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>🏭 Lieu de déstockage</span>
            <select
              value={selectedOrder.locationId || locations.find(l => l.isDefault)?.id || ''}
              onChange={async e => {
                const updated = await api.orders.updateLocation(selectedOrder.id, e.target.value);
                setSelectedOrder(updated);
              }}
              style={{ flex: 1, margin: 0, fontSize: '0.8125rem' }}
            >
              <option value="">Choisir…</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}{l.isDefault ? ' ★' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Items list */}
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 0.75rem' }}>
          Articles ({selectedOrder.items.length})
        </h2>
        {selectedOrder.items.map(item => {
          const done = item.scanned >= item.quantity;
          return (
            <div key={item.id} style={{
              background: '#141824',
              border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : '#2a3045'}`,
              borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', fontSize: '0.875rem' }}>{item.variantName}</p>
                {item.variant?.product?.name && (
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>{item.variant.product.name}</p>
                )}
                {item.barcode && !item.variantId && (
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>⚠ Variante non liée — barcode: {item.barcode}</p>
                )}
              </div>
              <div style={{ textAlign: 'right', marginLeft: '0.75rem' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', color: done ? '#22c55e' : '#e2e8f0' }}>
                  {item.scanned}/{item.quantity}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>{done ? '✓ ok' : 'à scanner'}</p>
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {selectedOrder.status !== 'shipped' && (
            <button
              onClick={handleScanItem}
              disabled={scanning}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem', background: 'rgba(43,140,238,0.12)', border: '1px solid rgba(43,140,238,0.4)', borderRadius: '0.75rem', color: '#2b8cee', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {scanning ? '⏳ Scan…' : '📷 Scanner un article'}
            </button>
          )}

          {selectedOrder.status === 'pending' && (
            <button
              onClick={() => handleMarkConfirmed(selectedOrder)}
              className="btn-primary"
            >
              ✓ Confirmer la commande
            </button>
          )}

          {selectedOrder.status === 'prepared' && (
            <button
              onClick={async () => {
                await api.orders.updateStatus(selectedOrder.id, 'shipped');
                const updated = await api.orders.get(selectedOrder.id);
                setSelectedOrder(updated);
                await reload();
              }}
              style={{ padding: '0.875rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '0.75rem', color: '#22c55e', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
            >
              🚚 Marquer expédiée
            </button>
          )}

          <button
            onClick={() => setDeleteTarget(selectedOrder.id)}
            className="btn-danger"
          >
            Supprimer la commande
          </button>
        </div>

        {deleteTarget && (
          <ConfirmModal
            message="Supprimer cette commande ?"
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            danger
          />
        )}
      </div>
    );
  }

  // --- Orders list view ---
  return (
    <PullToRefresh onRefresh={reload}>
      <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>📋 Commandes</h1>
        </div>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ marginBottom: '1rem' }}>
          <option value="">Toutes</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmées</option>
          <option value="shipped">Expédiées</option>
        </select>

        {filtered.length === 0 && (
          <p className="text-text-muted text-sm text-center" style={{ marginTop: '2rem' }}>Aucune commande.</p>
        )}

        {filtered.map(order => {
          const { label, color } = statusLabel(order.status);
          const scannedItems = order.items.reduce((s, i) => s + i.scanned, 0);
          const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
          return (
            <div
              key={order.id}
              onClick={async () => {
                setScanError('');
                setScanSuccess('');
                setSelectedOrder(order);
                // Fetch fresh detail to get latest scanned counts
                try {
                  const fresh = await api.orders.get(order.id);
                  setSelectedOrder(fresh);
                } catch { /* keep list data */ }
              }}
              style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', fontSize: '0.9375rem' }}>
                    {order.customerName || order.customerEmail || 'Client inconnu'}
                  </p>
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    {fmtDate(order.createdAt)} · {order.items.length} article{order.items.length > 1 ? 's' : ''}
                  </p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                    {order.items.map(i => `${i.variantName} ×${i.quantity}`).join(', ')}
                  </p>
                </div>
                <div style={{ marginLeft: '0.75rem', textAlign: 'right' }}>
                  <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '9999px', padding: '0.125rem 0.625rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    {label}
                  </span>
                  {totalItems > 0 && (
                    <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: scannedItems === totalItems ? '#22c55e' : '#64748b' }}>
                      {scannedItems}/{totalItems} scannés
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PullToRefresh>
  );
}
