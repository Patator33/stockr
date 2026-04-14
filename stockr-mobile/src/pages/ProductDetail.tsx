import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ProductDetail, type Attribute, type Location, type Promotion } from '../api';
import PullToRefresh from '../components/PullToRefresh';
import ConfirmModal from '../components/ConfirmModal';
import { scanBarcode } from '../components/BarcodeScanner';

function parseAttrs(s: string): Attribute[] {
  try { return JSON.parse(s); } catch { return []; }
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteVariant, setDeleteVariant] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string>('');
  const [savingDefault, setSavingDefault] = useState(false);
  const [scanningVariantId, setScanningVariantId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Promotions panel
  const [promoVariantId, setPromoVariantId] = useState<string | null>(null);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [promoPrice, setPromoPrice] = useState('');
  const [promoStart, setPromoStart] = useState(new Date().toISOString().slice(0,10));
  const [promoEnd, setPromoEnd] = useState('');
  const [promoErr, setPromoErr] = useState('');

  const openPromos = async (variantId: string) => {
    if (promoVariantId === variantId) { setPromoVariantId(null); return; }
    setPromoVariantId(variantId);
    setPromoErr('');
    setPromoPrice('');
    setPromoStart(new Date().toISOString().slice(0,10));
    setPromoEnd('');
    const list = await api.promotions.list(variantId);
    setPromos(list);
  };

  const handleCreatePromo = async () => {
    if (!promoVariantId || !promoPrice) { setPromoErr('Prix requis'); return; }
    setPromoErr('');
    try {
      await api.promotions.create({ variantId: promoVariantId, price: Number(promoPrice), startDate: promoStart, endDate: promoEnd || null });
      const list = await api.promotions.list(promoVariantId);
      setPromos(list);
      setPromoPrice('');
      await load();
    } catch (e) { setPromoErr(e instanceof Error ? e.message : 'Erreur'); }
  };

  const handleDeletePromo = async (promoId: string) => {
    if (!promoVariantId) return;
    await api.promotions.delete(promoId);
    const list = await api.promotions.list(promoVariantId);
    setPromos(list);
    await load();
  };

  // New variant modal
  const [showNewVariant, setShowNewVariant] = useState(false);
  const [vName, setVName] = useState('');
  const [vAttrs, setVAttrs] = useState<Attribute[]>([{ key: '', value: '' }]);
  const [vCost, setVCost] = useState('');
  const [vSale, setVSale] = useState('');
  const [vShipping, setVShipping] = useState('');
  const [vLoading, setVLoading] = useState(false);
  const [vError, setVError] = useState('');

  // Edit variant modal
  const [editVariantId, setEditVariantId] = useState<string | null>(null);
  const [evName, setEvName] = useState('');
  const [evAttrs, setEvAttrs] = useState<Attribute[]>([{ key: '', value: '' }]);
  const [evCost, setEvCost] = useState('');
  const [evSale, setEvSale] = useState('');
  const [evShipping, setEvShipping] = useState('');
  const [evLowStock, setEvLowStock] = useState('');
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [p, locs] = await Promise.all([api.products.get(id), api.locations.list()]);
    setProduct(p);
    setLocations(locs);
    if (!editName) { setEditName(p.name); setEditDesc(p.description || ''); }
    setDefaultLocationId(p.defaultLocationId ?? '');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await api.products.update(id, { name: editName, description: editDesc });
      setEditMode(false);
      await load();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleScanBarcode = async (variantId: string) => {
    setScanningVariantId(variantId);
    try {
      const code = await scanBarcode();
      if (!code) return;
      const variant = product!.variants.find(v => v.id === variantId)!;
      await api.variants.update(variantId, {
        name: variant.name,
        attributes: JSON.parse(variant.attributes),
        costPrice: variant.costPrice,
        salePrice: variant.salePrice,
        shippingCost: variant.shippingCost,
        barcode: code,
      });
      await load();
    } finally {
      setScanningVariantId(null);
    }
  };

  const handleSaveDefaultLocation = async (locationId: string) => {
    if (!id) return;
    setDefaultLocationId(locationId);
    setSavingDefault(true);
    try {
      await api.products.update(id, { name: product!.name, description: product!.description, defaultLocationId: locationId || null });
    } catch { /* ignore */ } finally { setSavingDefault(false); }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setVError('');
    setVLoading(true);
    try {
      await api.variants.create({
        productId: id,
        name: vName,
        attributes: vAttrs.filter(a => a.key && a.value),
        costPrice: Number(vCost) || 0,
        salePrice: Number(vSale) || 0,
        shippingCost: Number(vShipping) || 0,
      });
      setShowNewVariant(false);
      setVName(''); setVAttrs([{ key: '', value: '' }]); setVCost(''); setVSale(''); setVShipping('');
      await load();
    } catch (err: unknown) {
      setVError(err instanceof Error ? err.message : 'Erreur');
    } finally { setVLoading(false); }
  };

  const handleDeleteVariant = async () => {
    if (!deleteVariant) return;
    const id = deleteVariant;
    setDeleteVariant(null);
    setDeleteError('');
    try {
      await api.variants.delete(id);
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  const addAttr = () => setVAttrs(a => [...a, { key: '', value: '' }]);
  const removeAttr = (i: number) => setVAttrs(a => a.filter((_, idx) => idx !== i));
  const setAttr = (i: number, field: 'key' | 'value', val: string) =>
    setVAttrs(a => a.map((attr, idx) => idx === i ? { ...attr, [field]: val } : attr));

  // Collect distinct attribute keys from all existing variants for suggestions
  const attrKeySuggestions = product
    ? [...new Set(product.variants.flatMap(v => parseAttrs(v.attributes).map(a => a.key)).filter(Boolean))]
    : [];

  const openEditVariant = (v: import('../api').VariantWithStocks) => {
    const attrs = parseAttrs(v.attributes);
    setEditVariantId(v.id);
    setEvName(v.name);
    setEvAttrs(attrs.length > 0 ? attrs : [{ key: '', value: '' }]);
    setEvCost(String(v.costPrice));
    setEvSale(String(v.salePrice));
    setEvShipping(String(v.shippingCost));
    setEvLowStock(v.lowStockThreshold != null ? String(v.lowStockThreshold) : '');
    setEvError('');
  };

  const handleEditVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVariantId) return;
    setEvError('');
    setEvLoading(true);
    const variant = product!.variants.find(v => v.id === editVariantId)!;
    try {
      await api.variants.update(editVariantId, {
        name: evName,
        attributes: evAttrs.filter(a => a.key && a.value),
        costPrice: Number(evCost) || 0,
        salePrice: Number(evSale) || 0,
        shippingCost: Number(evShipping) || 0,
        barcode: variant.barcode,
        supplierRef: variant.supplierRef,
        lowStockThreshold: evLowStock !== '' ? Number(evLowStock) : null,
      });
      setEditVariantId(null);
      await load();
    } catch (err: unknown) {
      setEvError(err instanceof Error ? err.message : 'Erreur');
    } finally { setEvLoading(false); }
  };

  const addEvAttr = () => setEvAttrs(a => [...a, { key: '', value: '' }]);
  const removeEvAttr = (i: number) => setEvAttrs(a => a.filter((_, idx) => idx !== i));
  const setEvAttr = (i: number, field: 'key' | 'value', val: string) =>
    setEvAttrs(a => a.map((attr, idx) => idx === i ? { ...attr, [field]: val } : attr));

  if (!product) return <div className="flex items-center justify-center h-full text-text-muted text-sm">Chargement…</div>;

  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={() => navigate('/manage/products')} style={{ background: 'none', border: 'none', color: '#2b8cee', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>‹</button>
            {!editMode ? (
              <>
                <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#e2e8f0', margin: 0, flex: 1 }}>{product.name}</h1>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setEditMode(true)}>✏️ Modifier</button>
              </>
            ) : (
              <form onSubmit={handleSave} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nom" required />
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setEditMode(false)}>Annuler</button>
                  <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={saving}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
                </div>
              </form>
            )}
          </div>

          {product.description && !editMode && (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>{product.description}</p>
          )}

          {/* Default location */}
          {locations.length > 0 && !editMode && (
            <div style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Stock par défaut</span>
              <select
                value={defaultLocationId}
                onChange={e => handleSaveDefaultLocation(e.target.value)}
                style={{ flex: 1, margin: 0, fontSize: '0.8125rem' }}
                disabled={savingDefault}
              >
                <option value="">Aucun</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {deleteError && (
            <div
              onClick={() => setDeleteError('')}
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.75rem', color: '#ef4444', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              ✕ {deleteError}
            </div>
          )}

          {/* Variants header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>Variantes ({product.variants.length})</h2>
            <button className="btn-ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setShowNewVariant(true)}>+ Ajouter</button>
          </div>

          {/* Variants list */}
          {product.variants.map(v => {
            const attrs = parseAttrs(v.attributes);
            const totalStock = v.stocks.reduce((s, st) => s + st.quantity, 0);
            return (
              <div key={v.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '0.625rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', fontSize: '0.9375rem' }}>{v.name}</p>
                    {attrs.length > 0 && (
                      <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                        {attrs.map(a => `${a.key}: ${a.value}`).join(' · ')}
                      </p>
                    )}
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                      Coût: {v.costPrice.toFixed(2)} € · Vente: {v.salePrice.toFixed(2)} € · Exp: {v.shippingCost.toFixed(2)} €
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', color: totalStock === 0 ? '#ef4444' : (v.lowStockThreshold != null && totalStock <= v.lowStockThreshold) ? '#f59e0b' : '#22c55e' }}>
                      {totalStock}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>en stock</p>
                    {v.lowStockThreshold != null && totalStock <= v.lowStockThreshold && (
                      <p style={{ margin: '0.125rem 0 0', fontSize: '0.65rem', color: '#f59e0b' }}>📉 min {v.lowStockThreshold}</p>
                    )}
                  </div>
                </div>
                {v.stocks.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {v.stocks.map(s => (
                      <span key={s.locationId} style={{ background: '#1e2535', border: '1px solid #2a3045', borderRadius: '9999px', padding: '0.125rem 0.625rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {s.location.name}: <strong style={{ color: '#e2e8f0' }}>{s.quantity}</strong>
                      </span>
                    ))}
                  </div>
                )}
                {/* Supplier ref */}
                <SupplierRefField
                  variantId={v.id}
                  value={v.supplierRef ?? ''}
                  onSaved={load}
                  variant={v}
                />
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {v.barcode ? (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#1e2535', border: '1px solid #2a3045', borderRadius: '0.375rem', padding: '0.125rem 0.5rem', fontFamily: 'monospace' }}>
                      🔖 {v.barcode}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>Pas de code barre</span>
                  )}
                  <button
                    style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', background: 'rgba(43,140,238,0.12)', color: '#2b8cee', border: '1px solid rgba(43,140,238,0.3)', borderRadius: '0.375rem', cursor: 'pointer' }}
                    onClick={() => handleScanBarcode(v.id)}
                    disabled={scanningVariantId === v.id}
                  >
                    {scanningVariantId === v.id ? '…' : '📷 Scanner'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', background: promoVariantId === v.id ? 'rgba(245,158,11,0.12)' : 'none', color: promoVariantId === v.id ? '#f59e0b' : '#94a3b8', border: `1px solid ${promoVariantId === v.id ? 'rgba(245,158,11,0.4)' : '#2a3045'}`, borderRadius: '0.375rem', cursor: 'pointer' }}
                    onClick={() => openPromos(v.id)}
                  >🏷️ Promos</button>
                  <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => openEditVariant(v)}>✏️ Modifier</button>
                  <button className="btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setDeleteVariant(v.id)}>Supprimer</button>
                </div>
                {promoVariantId === v.id && (
                  <div style={{ marginTop: '0.75rem', background: '#0f1218', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.5rem', padding: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#f59e0b' }}>🏷️ Promotions</p>
                    {promos.length === 0 && <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0 0 0.5rem' }}>Aucune promotion</p>}
                    {promos.map(p => {
                      const now = new Date();
                      const active = new Date(p.startDate) <= now && (!p.endDate || new Date(p.endDate) >= now);
                      return (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem', background: active ? 'rgba(245,158,11,0.06)' : 'none', border: `1px solid ${active ? 'rgba(245,158,11,0.25)' : '#2a3045'}`, borderRadius: '0.375rem', padding: '0.25rem 0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: active ? '#f59e0b' : '#64748b' }}>
                            {active && '✓ '}{p.price.toFixed(2)} € · {new Date(p.startDate).toLocaleDateString('fr-FR')} → {p.endDate ? new Date(p.endDate).toLocaleDateString('fr-FR') : '∞'}
                          </span>
                          <button onClick={() => handleDeletePromo(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', padding: '0 0.25rem' }}>✕</button>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.375rem' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Prix promo €</label>
                          <input type="number" step="0.01" value={promoPrice} onChange={e => setPromoPrice(e.target.value)} placeholder="0.00" style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Début</label>
                          <input type="date" value={promoStart} onChange={e => setPromoStart(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Fin (opt.)</label>
                          <input type="date" value={promoEnd} onChange={e => setPromoEnd(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }} />
                        </div>
                      </div>
                      {promoErr && <p style={{ margin: 0, color: '#ef4444', fontSize: '0.75rem' }}>{promoErr}</p>}
                      <button className="btn-primary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', alignSelf: 'flex-start' }} onClick={handleCreatePromo}>+ Ajouter</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {product.variants.length === 0 && (
            <p className="text-text-muted text-sm text-center" style={{ marginTop: '1.5rem' }}>Aucune variante. Ajoutez-en une !</p>
          )}
        </div>
      </PullToRefresh>

      {/* New Variant bottom sheet */}
      {showNewVariant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowNewVariant(false)}>
          <div style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>Nouvelle variante</h2>
            <form onSubmit={handleCreateVariant} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Nom de la variante *</label>
                <input type="text" value={vName} onChange={e => setVName(e.target.value)} placeholder="Ex: Bleu XL" required />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label className="text-text-muted text-xs uppercase tracking-wide">Attributs</label>
                  <button type="button" onClick={addAttr} style={{ color: '#2b8cee', background: 'none', border: 'none', fontSize: '0.8125rem', cursor: 'pointer' }}>+ Ajouter</button>
                </div>
                <datalist id="attr-key-suggestions">
                  {attrKeySuggestions.map(k => <option key={k} value={k} />)}
                </datalist>
                {vAttrs.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.375rem', alignItems: 'center' }}>
                    <input type="text" list="attr-key-suggestions" value={a.key} onChange={e => setAttr(i, 'key', e.target.value)} placeholder="Clé (ex: Couleur)" style={{ flex: 1 }} />
                    <input type="text" value={a.value} onChange={e => setAttr(i, 'value', e.target.value)} placeholder="Valeur (ex: Bleu)" style={{ flex: 1 }} />
                    {vAttrs.length > 1 && (
                      <button type="button" onClick={() => removeAttr(i)} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Coût prod. €</label>
                  <input type="number" step="0.01" min="0" value={vCost} onChange={e => setVCost(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Prix vente €</label>
                  <input type="number" step="0.01" min="0" value={vSale} onChange={e => setVSale(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Expédition €</label>
                  <input type="number" step="0.01" min="0" value={vShipping} onChange={e => setVShipping(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              {vError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{vError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewVariant(false)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={vLoading}>{vLoading ? 'Création…' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Variant bottom sheet */}
      {editVariantId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setEditVariantId(null)}>
          <div style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>Modifier la variante</h2>
            <form onSubmit={handleEditVariant} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Nom de la variante *</label>
                <input type="text" value={evName} onChange={e => setEvName(e.target.value)} placeholder="Ex: Bleu XL" required />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label className="text-text-muted text-xs uppercase tracking-wide">Attributs</label>
                  <button type="button" onClick={addEvAttr} style={{ color: '#2b8cee', background: 'none', border: 'none', fontSize: '0.8125rem', cursor: 'pointer' }}>+ Ajouter</button>
                </div>
                <datalist id="attr-key-suggestions-edit">
                  {attrKeySuggestions.map(k => <option key={k} value={k} />)}
                </datalist>
                {evAttrs.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.375rem', alignItems: 'center' }}>
                    <input type="text" list="attr-key-suggestions-edit" value={a.key} onChange={e => setEvAttr(i, 'key', e.target.value)} placeholder="Clé (ex: Couleur)" style={{ flex: 1 }} />
                    <input type="text" value={a.value} onChange={e => setEvAttr(i, 'value', e.target.value)} placeholder="Valeur (ex: Bleu)" style={{ flex: 1 }} />
                    {evAttrs.length > 1 && (
                      <button type="button" onClick={() => removeEvAttr(i)} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Coût prod. €</label>
                  <input type="number" step="0.01" min="0" value={evCost} onChange={e => setEvCost(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Prix vente €</label>
                  <input type="number" step="0.01" min="0" value={evSale} onChange={e => setEvSale(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Expédition €</label>
                  <input type="number" step="0.01" min="0" value={evShipping} onChange={e => setEvShipping(e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Seuil alerte stock bas (optionnel)</label>
                <input type="number" min="0" step="1" value={evLowStock} onChange={e => setEvLowStock(e.target.value)} placeholder="Ex: 5" />
              </div>

              {evError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{evError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setEditVariantId(null)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={evLoading}>{evLoading ? 'Sauvegarde…' : 'Sauvegarder'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteVariant && (
        <ConfirmModal
          message="Supprimer cette variante ? Tout son stock sera effacé."
          onConfirm={handleDeleteVariant}
          onCancel={() => setDeleteVariant(null)}
          danger
        />
      )}
    </>
  );
}

function SupplierRefField({ variantId, value, onSaved, variant }: {
  variantId: string;
  value: string;
  onSaved: () => void;
  variant: import('../api').VariantWithStocks;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.variants.update(variantId, {
        name: variant.name,
        attributes: JSON.parse(variant.attributes),
        costPrice: variant.costPrice,
        salePrice: variant.salePrice,
        shippingCost: variant.shippingCost,
        barcode: variant.barcode,
        supplierRef: val.trim() || null,
      });
      setEditing(false);
      onSaved();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Réf. fournisseur"
          style={{ flex: 1, fontSize: '0.8125rem', margin: 0, padding: '0.25rem 0.5rem' }}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={save} disabled={saving} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '0.375rem', cursor: 'pointer' }}>
          {saving ? '…' : '✓'}
        </button>
        <button onClick={() => setEditing(false)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'none', color: '#64748b', border: '1px solid #2a3045', borderRadius: '0.375rem', cursor: 'pointer' }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {value ? (
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#1e2535', border: '1px solid #2a3045', borderRadius: '0.375rem', padding: '0.125rem 0.5rem', fontFamily: 'monospace' }}>
          🏭 {value}
        </span>
      ) : (
        <span style={{ fontSize: '0.75rem', color: '#475569' }}>Pas de réf. fournisseur</span>
      )}
      <button
        onClick={() => { setVal(value); setEditing(true); }}
        style={{ fontSize: '0.7rem', padding: '0.125rem 0.375rem', background: 'none', color: '#475569', border: '1px solid #2a3045', borderRadius: '0.375rem', cursor: 'pointer' }}
      >✏️</button>
    </div>
  );
}
