import React, { useEffect, useState } from 'react';
import { api, Supplier, SupplierPrice, Variant } from '../api';

interface FlatVariant {
  id: string;
  name: string;
  productName: string;
  costPrice: number;
  salePrice: number;
  shippingCost: number;
  vatRate: number;
}

type View = 'list' | 'prices';

export default function SuppliersPage() {
  const [view, setView] = useState<View>('list');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [variants, setVariants] = useState<FlatVariant[]>([]);
  const [prices, setPrices] = useState<Record<string, SupplierPrice>>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, { salePrice: string; costPrice: string; shippingCost: string; vatRate: string }>>({});
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const data = await api.suppliers.list();
    setSuppliers(data);
  };

  useEffect(() => { load(); }, []);

  const openPrices = async (sup: Supplier) => {
    setSelected(sup);
    setView('prices');
    const [rawVariants, existingPrices] = await Promise.all([
      api.variants.list(),
      api.supplierPrices.list(sup.id),
    ]);
    const flat: FlatVariant[] = (rawVariants as (Variant & { product?: { name: string } })[]).map(v => ({
      id: v.id, name: v.name,
      productName: (v as { product?: { name: string } }).product?.name ?? '',
      costPrice: v.costPrice, salePrice: v.salePrice, shippingCost: v.shippingCost, vatRate: v.vatRate,
    }));
    setVariants(flat);
    const byVariant: Record<string, SupplierPrice> = {};
    existingPrices.forEach(p => { byVariant[p.variantId] = p; });
    setPrices(byVariant);
    const inputs: Record<string, { salePrice: string; costPrice: string; shippingCost: string; vatRate: string }> = {};
    flat.forEach(v => {
      const p = byVariant[v.id];
      inputs[v.id] = {
        salePrice: String(p ? p.salePrice : v.salePrice),
        costPrice: String(p ? p.costPrice : v.costPrice),
        shippingCost: String(p ? p.shippingCost : v.shippingCost),
        vatRate: String(p ? p.vatRate : v.vatRate),
      };
    });
    setPriceInputs(inputs);
  };

  const create = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api.suppliers.create({ name: newName.trim(), description: newDesc.trim() || null });
      setNewName(''); setNewDesc(''); setShowCreate(false);
      setMsg('✓ Fournisseur créé');
      await load();
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Erreur'); }
    setLoading(false);
  };

  const saveEdit = async () => {
    if (!editId) return;
    setLoading(true);
    try {
      await api.suppliers.update(editId, { name: editName.trim(), description: editDesc.trim() || null });
      setEditId(null);
      setMsg('✓ Mis à jour');
      await load();
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Erreur'); }
    setLoading(false);
  };

  const deleteSup = async (id: string) => {
    if (!window.confirm('Supprimer ce fournisseur ?')) return;
    try {
      await api.suppliers.delete(id);
      if (selected?.id === id) { setSelected(null); setView('list'); }
      await load();
      setMsg('✓ Supprimé');
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Erreur'); }
  };

  const savePrice = async (variantId: string) => {
    if (!selected) return;
    setSavingId(variantId);
    try {
      const inp = priceInputs[variantId];
      await api.supplierPrices.upsert({
        variantId, supplierId: selected.id,
        salePrice: Number(inp.salePrice), costPrice: Number(inp.costPrice),
        shippingCost: Number(inp.shippingCost), vatRate: Number(inp.vatRate),
      });
      // Refresh prices
      const fresh = await api.supplierPrices.list(selected.id);
      const byVariant: Record<string, SupplierPrice> = {};
      fresh.forEach(p => { byVariant[p.variantId] = p; });
      setPrices(byVariant);
      setMsg('✓ Prix enregistré');
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Erreur'); }
    setSavingId(null);
  };

  const deletePrice = async (variantId: string) => {
    const p = prices[variantId];
    if (!p || !selected) return;
    try {
      await api.supplierPrices.delete(p.id);
      const fresh = await api.supplierPrices.list(selected.id);
      const byVariant: Record<string, SupplierPrice> = {};
      fresh.forEach(pr => { byVariant[pr.variantId] = pr; });
      setPrices(byVariant);
      // Reset input to variant defaults
      const v = variants.find(x => x.id === variantId);
      if (v) {
        setPriceInputs(prev => ({ ...prev, [variantId]: { salePrice: String(v.salePrice), costPrice: String(v.costPrice), shippingCost: String(v.shippingCost), vatRate: String(v.vatRate) } }));
      }
      setMsg('✓ Prix supprimé');
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Erreur'); }
  };

  const inp = { style: { background: '#1a2035', border: '1px solid #2a3045', borderRadius: 6, color: '#e2e8f0', padding: '8px 10px', fontSize: 14, width: '100%', boxSizing: 'border-box' as const } };

  // Group variants by product
  const byProduct: Record<string, FlatVariant[]> = {};
  variants.forEach(v => { (byProduct[v.productName] = byProduct[v.productName] || []).push(v); });

  if (view === 'prices' && selected) {
    return (
      <div style={{ padding: 16, paddingBottom: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setView('list')} style={{ background: 'none', border: '1px solid #2a3045', borderRadius: 8, color: '#94a3b8', padding: '6px 12px', fontSize: 13 }}>← Retour</button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Prix — {selected.name}</h2>
        </div>
        {msg && <p style={{ margin: '0 0 12px', fontSize: 13, color: msg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{msg}</p>}
        {Object.entries(byProduct).map(([productName, pvs]) => (
          <div key={productName} style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{productName}</p>
            {pvs.map(v => {
              const pi = priceInputs[v.id] ?? { salePrice: String(v.salePrice), costPrice: String(v.costPrice), shippingCost: String(v.shippingCost), vatRate: String(v.vatRate) };
              const hasOverride = !!prices[v.id];
              return (
                <div key={v.id} style={{ background: '#1a2035', borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${hasOverride ? '#3b82f6' : '#2a3045'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</span>
                    {hasOverride && <span style={{ fontSize: 10, background: '#1e3a5f', color: '#3b82f6', borderRadius: 4, padding: '2px 6px' }}>personnalisé</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {(['salePrice', 'costPrice', 'shippingCost', 'vatRate'] as const).map(field => (
                      <div key={field}>
                        <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b' }}>{{ salePrice: 'Vente €', costPrice: 'Achat €', shippingCost: 'Port €', vatRate: 'TVA %' }[field]}</p>
                        <input type="number" step="0.01" min={0} value={pi[field]}
                          onChange={e => setPriceInputs(prev => ({ ...prev, [v.id]: { ...prev[v.id], [field]: e.target.value } }))}
                          {...inp} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => savePrice(v.id)} disabled={savingId === v.id}
                      style={{ flex: 1, padding: '8px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600 }}>
                      {savingId === v.id ? '…' : '✓ Enregistrer'}
                    </button>
                    {hasOverride && (
                      <button onClick={() => deletePrice(v.id)}
                        style={{ padding: '8px 16px', background: '#7f1d1d', border: 'none', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
                        ✕ Réinitialiser
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 16, paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Fournisseurs</h2>
        <button onClick={() => setShowCreate(s => !s)}
          style={{ background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 14px', fontSize: 13, fontWeight: 600 }}>
          {showCreate ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {msg && <p style={{ margin: '0 0 12px', fontSize: 13, color: msg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{msg}</p>}

      {showCreate && (
        <div style={{ background: '#1a2035', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>Nouveau fournisseur</p>
          <input placeholder="Nom (ex: Amazon, Cdiscount)" value={newName} onChange={e => setNewName(e.target.value)} {...inp} style={{ ...inp.style, marginBottom: 8 }} />
          <input placeholder="Description (optionnel)" value={newDesc} onChange={e => setNewDesc(e.target.value)} {...inp} style={{ ...inp.style, marginBottom: 12 }} />
          <button onClick={create} disabled={loading || !newName.trim()}
            style={{ width: '100%', padding: '10px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {loading ? 'Création…' : 'Créer'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suppliers.map(s => (
          <div key={s.id} style={{ background: '#1a2035', borderRadius: 10, padding: 14, border: '1px solid #2a3045' }}>
            {editId === s.id ? (
              <div>
                <input value={editName} onChange={e => setEditName(e.target.value)} {...inp} style={{ ...inp.style, marginBottom: 8 }} />
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" {...inp} style={{ ...inp.style, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEdit} disabled={loading} style={{ flex: 1, padding: '8px', background: '#3b82f6', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13 }}>{loading ? '…' : '✓ Sauvegarder'}</button>
                  <button onClick={() => setEditId(null)} style={{ padding: '8px 14px', background: '#374151', border: 'none', borderRadius: 8, color: '#e2e8f0', fontSize: 13 }}>Annuler</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{s.name}</p>
                  {s.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{s.description}</p>}
                </div>
                <button onClick={() => openPrices(s)}
                  style={{ background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: 8, color: '#3b82f6', padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
                  Prix
                </button>
                <button onClick={() => { setEditId(s.id); setEditName(s.name); setEditDesc(s.description ?? ''); }}
                  style={{ background: 'none', border: '1px solid #2a3045', borderRadius: 8, color: '#94a3b8', padding: '6px 10px', fontSize: 13 }}>✏️</button>
                <button onClick={() => deleteSup(s.id)}
                  style={{ background: 'none', border: '1px solid #7f1d1d', borderRadius: 8, color: '#ef4444', padding: '6px 10px', fontSize: 13 }}>🗑</button>
              </div>
            )}
          </div>
        ))}
        {suppliers.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', paddingTop: 32 }}>Aucun fournisseur. Ajoutez-en un.</p>
        )}
      </div>
    </div>
  );
}
