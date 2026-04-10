import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ProductDetail, type Attribute, type Location } from '../api';
import PullToRefresh from '../components/PullToRefresh';
import ConfirmModal from '../components/ConfirmModal';

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

  // New variant modal
  const [showNewVariant, setShowNewVariant] = useState(false);
  const [vName, setVName] = useState('');
  const [vAttrs, setVAttrs] = useState<Attribute[]>([{ key: '', value: '' }]);
  const [vCost, setVCost] = useState('');
  const [vSale, setVSale] = useState('');
  const [vShipping, setVShipping] = useState('');
  const [vLoading, setVLoading] = useState(false);
  const [vError, setVError] = useState('');

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
    try { await api.variants.delete(deleteVariant); setDeleteVariant(null); await load(); } catch { /* ignore */ }
  };

  const addAttr = () => setVAttrs(a => [...a, { key: '', value: '' }]);
  const removeAttr = (i: number) => setVAttrs(a => a.filter((_, idx) => idx !== i));
  const setAttr = (i: number, field: 'key' | 'value', val: string) =>
    setVAttrs(a => a.map((attr, idx) => idx === i ? { ...attr, [field]: val } : attr));

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
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', color: totalStock === 0 ? '#ef4444' : totalStock < 5 ? '#f59e0b' : '#22c55e' }}>
                      {totalStock}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>en stock</p>
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
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem' }}>
                  <button className="btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setDeleteVariant(v.id)}>Supprimer</button>
                </div>
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
                {vAttrs.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.375rem', alignItems: 'center' }}>
                    <input type="text" value={a.key} onChange={e => setAttr(i, 'key', e.target.value)} placeholder="Clé (ex: Couleur)" style={{ flex: 1 }} />
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
