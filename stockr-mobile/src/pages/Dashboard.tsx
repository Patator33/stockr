import { useState, useEffect, useCallback } from 'react';
import { api, type Product, type StockByLocation, type Location, type Variant, type Stats } from '../api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import PullToRefresh from '../components/PullToRefresh';

interface TransferModal {
  variantId: string;
  variantName: string;
  fromLocationId: string;
  fromLocationName: string;
  availableQty: number;
}

interface SaleModal {
  variantId: string;
  variantName: string;
  locationId: string;
  locationName: string;
  availableQty: number;
  defaultSalePrice: number;
  defaultCostPrice: number;
  defaultShippingCost: number;
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [stocks, setStocks] = useState<StockByLocation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [transferModal, setTransferModal] = useState<TransferModal | null>(null);
  const [saleModal, setSaleModal] = useState<SaleModal | null>(null);

  // Transfer form state
  const [transferToId, setTransferToId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Sale form state
  const [saleQty, setSaleQty] = useState('1');
  const [salePriceOverride, setSalePriceOverride] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleLoading, setSaleLoading] = useState(false);
  const [saleError, setSaleError] = useState('');

  const load = useCallback(async () => {
    try {
      const [prods, locs] = await Promise.all([api.products.list(), api.locations.list()]);
      setProducts(prods);
      setLocations(locs);
      const pid = selectedProductId || (prods[0]?.id ?? '');
      if (pid) {
        const [stks, st] = await Promise.all([
          api.stocks.byProduct(pid),
          api.stats.get(pid, 30),
        ]);
        setStocks(stks);
        setStats(st);
        if (!selectedProductId && prods[0]) setSelectedProductId(prods[0].id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  const onProductChange = async (pid: string) => {
    setSelectedProductId(pid);
    setLoading(true);
    try {
      const [stks, st] = await Promise.all([
        api.stocks.byProduct(pid),
        api.stats.get(pid, 30),
      ]);
      setStocks(stks);
      setStats(st);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModal) return;
    setTransferError('');
    setTransferLoading(true);
    try {
      await api.stocks.transfer({
        variantId: transferModal.variantId,
        fromLocationId: transferModal.fromLocationId,
        toLocationId: transferToId,
        quantity: Number(transferQty),
        notes: transferNotes,
      });
      setTransferModal(null);
      await load();
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleModal) return;
    setSaleError('');
    setSaleLoading(true);
    try {
      await api.sales.create({
        variantId: saleModal.variantId,
        locationId: saleModal.locationId,
        quantity: Number(saleQty),
        unitSalePrice: salePriceOverride ? Number(salePriceOverride) : saleModal.defaultSalePrice,
        unitCostPrice: saleModal.defaultCostPrice,
        unitShippingCost: saleModal.defaultShippingCost,
        notes: saleNotes,
      });
      setSaleModal(null);
      await load();
    } catch (err: unknown) {
      setSaleError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaleLoading(false);
    }
  };

  const totalStock = stats?.totalStock ?? 0;

  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📦</span>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
              Stock<span style={{ color: '#2b8cee' }}>r</span>
            </h1>
          </div>

          {/* Product selector */}
          {products.length > 0 && (
            <select
              value={selectedProductId}
              onChange={e => onProductChange(e.target.value)}
              style={{ marginBottom: '1rem' }}
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p._count ? `(${p._count.variants} variante${p._count.variants > 1 ? 's' : ''})` : ''}
                </option>
              ))}
            </select>
          )}

          {products.length === 0 && !loading && (
            <div style={{ background: 'rgba(43,140,238,0.06)', border: '1px solid rgba(43,140,238,0.2)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem', textAlign: 'center' }}>
              <p className="text-text-secondary text-sm" style={{ margin: 0 }}>
                Aucun produit. Allez dans <strong>Gestion</strong> pour créer vos premiers produits.
              </p>
            </div>
          )}

          {/* KPIs */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <KpiCard label="Stock total" value={String(totalStock)} color="text-text-main" />
              <KpiCard label="CA (30j)" value={fmt(stats.totalRevenue)} color="text-paid" />
              <KpiCard label="Marge nette (30j)" value={fmt(stats.netMargin)} color={stats.netMargin >= 0 ? 'text-paid' : 'text-late'} />
              <KpiCard label="Retours (30j)" value={String(stats.totalReturnedQty)} color="text-pending" />
            </div>
          )}

          {/* Error */}
          {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

          {/* Stock by location */}
          {stocks.map(({ location, items }) => {
            const locItems = items.filter(i => i.productId === selectedProductId);
            if (locItems.length === 0) return null;
            return (
              <div key={location.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #2a3045', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>🏭</span>
                  <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9375rem' }}>{location.name}</span>
                </div>
                {locItems.map(item => (
                  <div key={item.variantId} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1e2535', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.variantName}</p>
                      {item.attributes.length > 0 && (
                        <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                          {item.attributes.map(a => `${a.key}: ${a.value}`).join(' · ')}
                        </p>
                      )}
                      <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                        Vente: {fmt(item.salePrice)} · Coût: {fmt(item.costPrice)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.75rem' }}>
                      <span style={{
                        fontWeight: 700,
                        fontSize: '1.125rem',
                        color: item.quantity === 0 ? '#ef4444' : item.quantity < 5 ? '#f59e0b' : '#22c55e',
                        minWidth: '2rem',
                        textAlign: 'right',
                      }}>{item.quantity}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <button
                          className="btn-ghost"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setSaleModal({
                              variantId: item.variantId,
                              variantName: item.variantName,
                              locationId: location.id,
                              locationName: location.name,
                              availableQty: item.quantity,
                              defaultSalePrice: item.salePrice,
                              defaultCostPrice: item.costPrice,
                              defaultShippingCost: item.shippingCost,
                            });
                            setSaleQty('1');
                            setSalePriceOverride('');
                            setSaleNotes('');
                            setSaleError('');
                          }}
                        >+Vente</button>
                        <button
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'rgba(91,95,199,0.12)', color: '#8b8ef0', border: '1px solid rgba(91,95,199,0.3)', borderRadius: '0.375rem', cursor: 'pointer' }}
                          onClick={() => {
                            setTransferModal({
                              variantId: item.variantId,
                              variantName: item.variantName,
                              fromLocationId: location.id,
                              fromLocationName: location.name,
                              availableQty: item.quantity,
                            });
                            setTransferToId('');
                            setTransferQty('');
                            setTransferNotes('');
                            setTransferError('');
                          }}
                        >⇄ Transfert</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {stocks.length > 0 && stocks.every(s => s.items.filter(i => i.productId === selectedProductId).length === 0) && (
            <p className="text-text-muted text-sm text-center" style={{ marginTop: '2rem' }}>Aucun stock pour ce produit.</p>
          )}
        </div>
      </PullToRefresh>

      {/* Transfer Bottom Sheet */}
      {transferModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setTransferModal(null)}
        >
          <div
            style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>⇄ Transfert de stock</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              <strong style={{ color: '#e2e8f0' }}>{transferModal.variantName}</strong> depuis <strong style={{ color: '#e2e8f0' }}>{transferModal.fromLocationName}</strong>
              {' '}(dispo: {transferModal.availableQty})
            </p>
            <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Destination</label>
                <select value={transferToId} onChange={e => setTransferToId(e.target.value)} required>
                  <option value="">Choisir une zone…</option>
                  {locations.filter(l => l.id !== transferModal.fromLocationId).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Quantité</label>
                <input type="number" min="1" max={transferModal.availableQty} value={transferQty} onChange={e => setTransferQty(e.target.value)} required />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Notes (optionnel)</label>
                <input type="text" value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="Remarque…" />
              </div>
              {transferError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{transferError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setTransferModal(null)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={transferLoading}>
                  {transferLoading ? 'Transfert…' : 'Transférer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Bottom Sheet */}
      {saleModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setSaleModal(null)}
        >
          <div
            style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>💰 Nouvelle vente</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 1rem' }}>
              <strong style={{ color: '#e2e8f0' }}>{saleModal.variantName}</strong> depuis <strong style={{ color: '#e2e8f0' }}>{saleModal.locationName}</strong>
              {' '}(dispo: {saleModal.availableQty})
            </p>
            <form onSubmit={handleSale} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Quantité</label>
                <input type="number" min="1" max={saleModal.availableQty} value={saleQty} onChange={e => setSaleQty(e.target.value)} required />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">
                  Prix de vente (défaut: {saleModal.defaultSalePrice.toFixed(2)} €)
                </label>
                <input type="number" step="0.01" min="0" value={salePriceOverride} onChange={e => setSalePriceOverride(e.target.value)} placeholder={String(saleModal.defaultSalePrice)} />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Notes (optionnel)</label>
                <input type="text" value={saleNotes} onChange={e => setSaleNotes(e.target.value)} placeholder="Numéro commande, client…" />
              </div>
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '0.5rem', padding: '0.625rem', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-text-muted">Marge nette estimée</span>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>
                    {((Number(salePriceOverride) || saleModal.defaultSalePrice) - saleModal.defaultCostPrice - saleModal.defaultShippingCost).toFixed(2)} € / unité
                  </span>
                </div>
              </div>
              {saleError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{saleError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setSaleModal(null)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={saleLoading}>
                  {saleLoading ? 'Enregistrement…' : 'Valider la vente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border" style={{ padding: '0.75rem' }}>
      <p className="text-text-muted text-xs uppercase tracking-wide" style={{ margin: '0 0 0.25rem' }}>{label}</p>
      <p className={`text-xl font-bold ${color}`} style={{ margin: 0 }}>{value}</p>
    </div>
  );
}
