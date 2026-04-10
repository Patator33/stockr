import { useState, useEffect, useCallback } from 'react';
import { api, type Sale, type Product, type Variant, type StockByLocation } from '../api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import PullToRefresh from '../components/PullToRefresh';
import ConfirmModal from '../components/ConfirmModal';

function fmt(n: number) {
  return n.toFixed(2) + ' €';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface NewSaleModal {
  open: true;
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [returnModal, setReturnModal] = useState<Sale | null>(null);
  const [returnQty, setReturnQty] = useState('1');
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');

  // New sale modal
  const [newSaleModal, setNewSaleModal] = useState<NewSaleModal | null>(null);
  const [nsProductId, setNsProductId] = useState('');
  const [nsVariants, setNsVariants] = useState<Variant[]>([]);
  const [nsVariantId, setNsVariantId] = useState('');
  const [nsStocks, setNsStocks] = useState<StockByLocation[]>([]);
  const [nsLocationId, setNsLocationId] = useState('');
  const [nsQty, setNsQty] = useState('1');
  const [nsPrice, setNsPrice] = useState('');
  const [nsNotes, setNsNotes] = useState('');
  const [nsLoading, setNsLoading] = useState(false);
  const [nsError, setNsError] = useState('');

  const load = useCallback(async () => {
    try {
      const [res, prods] = await Promise.all([
        api.sales.list({ productId: productFilter || undefined }),
        api.products.list(),
      ]);
      setSales(res.sales);
      setTotal(res.total);
      setProducts(prods);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [productFilter]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const openNewSale = () => {
    setNsProductId('');
    setNsVariants([]);
    setNsVariantId('');
    setNsStocks([]);
    setNsLocationId('');
    setNsQty('1');
    setNsPrice('');
    setNsNotes('');
    setNsError('');
    setNewSaleModal({ open: true });
  };

  const onNsProductChange = async (pid: string) => {
    setNsProductId(pid);
    setNsVariantId('');
    setNsLocationId('');
    setNsStocks([]);
    setNsVariants([]);
    if (!pid) return;
    const [variants, stocks] = await Promise.all([
      api.variants.list(pid),
      api.stocks.byProduct(pid),
    ]);
    setNsVariants(variants);
    setNsStocks(stocks);
    // Pre-select default location if set on product
    const product = products.find(p => p.id === pid);
    if (product?.defaultLocationId) setNsLocationId(product.defaultLocationId);
  };

  const onNsVariantChange = (vid: string) => {
    setNsVariantId(vid);
    const variant = nsVariants.find(v => v.id === vid);
    if (variant) setNsPrice(String(variant.salePrice));
  };

  // Locations that have stock for selected variant
  const availableLocations = nsVariantId
    ? nsStocks
        .map(s => ({
          location: s.location,
          qty: s.items.find(i => i.variantId === nsVariantId)?.quantity ?? 0,
        }))
        .filter(s => s.qty > 0)
    : [];

  const selectedLocationStock = availableLocations.find(l => l.location.id === nsLocationId)?.qty ?? 0;
  const selectedVariant = nsVariants.find(v => v.id === nsVariantId);

  const handleNewSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setNsError('');
    setNsLoading(true);
    try {
      await api.sales.create({
        variantId: nsVariantId,
        locationId: nsLocationId,
        quantity: Number(nsQty),
        unitSalePrice: Number(nsPrice),
        unitCostPrice: selectedVariant?.costPrice ?? 0,
        unitShippingCost: selectedVariant?.shippingCost ?? 0,
        notes: nsNotes || undefined,
      });
      setNewSaleModal(null);
      await load();
    } catch (err: unknown) {
      setNsError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setNsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.sales.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch { /* ignore */ }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModal) return;
    setReturnError('');
    setReturnLoading(true);
    try {
      await api.returns.create({ saleId: returnModal.id, quantity: Number(returnQty), reason: returnReason });
      setReturnModal(null);
      await load();
    } catch (err: unknown) {
      setReturnError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setReturnLoading(false);
    }
  };

  const netMargin = (s: Sale) => {
    const returned = s.returns?.reduce((sum, r) => sum + r.quantity, 0) ?? 0;
    const eff = s.quantity - returned;
    return eff * (s.unitSalePrice - s.unitCostPrice - s.unitShippingCost);
  };

  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>💰 Ventes</h1>
            <button className="btn-primary" style={{ padding: '0.5rem 0.875rem', fontSize: '0.875rem' }} onClick={openNewSale}>
              + Vente
            </button>
          </div>

          {/* Filter */}
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)} style={{ marginBottom: '1rem' }}>
            <option value="">Tous les produits</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <p className="text-text-muted text-xs" style={{ marginBottom: '0.75rem' }}>{total} vente{total > 1 ? 's' : ''}</p>

          {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}

          {sales.map(sale => {
            const returned = sale.returns?.reduce((sum, r) => sum + r.quantity, 0) ?? 0;
            const margin = netMargin(sale);
            return (
              <div key={sale.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sale.variant?.name ?? sale.variantId}
                    </p>
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      {sale.variant?.product?.name} · {sale.location?.name}
                    </p>
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {fmtDate(sale.createdAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '0.75rem' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#22c55e' }}>
                      +{fmt(sale.quantity * sale.unitSalePrice)}
                    </p>
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: margin >= 0 ? '#22c55e' : '#ef4444' }}>
                      Marge: {fmt(margin)}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  <span>Qté: <strong style={{ color: '#e2e8f0' }}>{sale.quantity}</strong></span>
                  {returned > 0 && <span style={{ color: '#f59e0b' }}>Retours: <strong>{returned}</strong></span>}
                  <span>Prix: <strong style={{ color: '#e2e8f0' }}>{fmt(sale.unitSalePrice)}</strong></span>
                  <span>Exp: <strong style={{ color: '#e2e8f0' }}>{fmt(sale.unitShippingCost)}</strong></span>
                </div>

                {sale.notes && <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#64748b', fontStyle: 'italic' }}>{sale.notes}</p>}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {returned < sale.quantity && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                      onClick={() => {
                        setReturnModal(sale);
                        setReturnQty('1');
                        setReturnReason('');
                        setReturnError('');
                      }}
                    >↩ Retour</button>
                  )}
                  <button
                    className="btn-danger"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                    onClick={() => setDeleteTarget(sale)}
                  >Supprimer</button>
                </div>
              </div>
            );
          })}

          {sales.length === 0 && !loading && (
            <p className="text-text-muted text-sm text-center" style={{ marginTop: '2rem' }}>Aucune vente enregistrée.</p>
          )}
        </div>
      </PullToRefresh>

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmModal
          message={`Supprimer cette vente de ${deleteTarget.quantity}× ${deleteTarget.variant?.name} ? Le stock sera restauré.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}

      {/* New sale bottom sheet */}
      {newSaleModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setNewSaleModal(null)}
        >
          <div
            style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>💰 Nouvelle vente</h2>
            <form onSubmit={handleNewSale} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Produit</label>
                <select value={nsProductId} onChange={e => onNsProductChange(e.target.value)} required>
                  <option value="">Choisir un produit…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {nsVariants.length > 0 && (
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Variante</label>
                  <select value={nsVariantId} onChange={e => onNsVariantChange(e.target.value)} required>
                    <option value="">Choisir une variante…</option>
                    {nsVariants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              )}

              {nsVariantId && (
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">
                    Stock source {availableLocations.length === 0 ? '— aucun stock disponible' : ''}
                  </label>
                  <select value={nsLocationId} onChange={e => setNsLocationId(e.target.value)} required disabled={availableLocations.length === 0}>
                    <option value="">Choisir une zone…</option>
                    {availableLocations.map(({ location, qty }) => (
                      <option key={location.id} value={location.id}>{location.name} ({qty} dispo)</option>
                    ))}
                  </select>
                </div>
              )}

              {nsLocationId && (
                <>
                  <div>
                    <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Quantité (max: {selectedLocationStock})</label>
                    <input type="number" min="1" max={selectedLocationStock} value={nsQty} onChange={e => setNsQty(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">
                      Prix de vente € {selectedVariant ? `(défaut: ${selectedVariant.salePrice.toFixed(2)} €)` : ''}
                    </label>
                    <input type="number" step="0.01" min="0" value={nsPrice} onChange={e => setNsPrice(e.target.value)} required />
                  </div>
                  {selectedVariant && nsPrice && (
                    <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '0.5rem', padding: '0.625rem', fontSize: '0.8125rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-text-muted">Marge nette / unité</span>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>
                          {(Number(nsPrice) - selectedVariant.costPrice - selectedVariant.shippingCost).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Notes (optionnel)</label>
                    <input type="text" value={nsNotes} onChange={e => setNsNotes(e.target.value)} placeholder="Numéro commande, client…" />
                  </div>
                </>
              )}

              {nsError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{nsError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setNewSaleModal(null)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={nsLoading || !nsLocationId}>
                  {nsLoading ? 'Enregistrement…' : 'Valider la vente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return bottom sheet */}
      {returnModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setReturnModal(null)}
        >
          <div
            style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>↩ Retour produit</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              <strong style={{ color: '#e2e8f0' }}>{returnModal.variant?.name}</strong> · Vendu: {returnModal.quantity}
            </p>
            <form onSubmit={handleReturn} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Quantité retournée</label>
                <input type="number" min="1" max={returnModal.quantity - (returnModal.returns?.reduce((s, r) => s + r.quantity, 0) ?? 0)} value={returnQty} onChange={e => setReturnQty(e.target.value)} required />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Raison (optionnel)</label>
                <input type="text" value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Défaut, erreur commande…" />
              </div>
              {returnError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{returnError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setReturnModal(null)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2, background: '#f59e0b' }} disabled={returnLoading}>
                  {returnLoading ? 'Enregistrement…' : 'Valider le retour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
