'use client';
import { useEffect, useState } from 'react';
import { wGet, wFetch, getWebToken } from '../_api';

interface Sale { id: string; variantId: string; locationId: string; quantity: number; unitSalePrice: number; unitCostPrice: number; unitShippingCost: number; vatRate: number; notes?: string | null; createdAt: string; variant?: { name: string; product: { name: string } }; location?: { name: string }; returns?: { id: string; quantity: number; reason?: string | null }[]; order?: { id: string; customerName?: string | null; customerEmail?: string | null } | null; }
interface Variant { id: string; name: string; salePrice: number; costPrice: number; shippingCost: number; vatRate: number; activePromotion?: { price: number; startDate: string; endDate?: string | null } | null; product?: { defaultLocationId?: string | null }; }
interface Location { id: string; name: string; isDefault?: boolean; }
interface SalesPage { sales: Sale[]; total: number; pages: number; }

export default function SalesPage() {
  const [data,      setData]      = useState<SalesPage>({ sales: [], total: 0, pages: 1 });
  const [variants,  setVariants]  = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ variantId: '', locationId: '', quantity: 1, unitSalePrice: 0, unitCostPrice: 0, unitShippingCost: 0, notes: '' });
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo,   setExportTo]   = useState('');

  const load = (p = 1, q = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set('search', q);
    wGet<SalesPage>(`/api/sales?${params}`).then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    wGet<Location[]>('/api/locations').then(locs => {
      setLocations(locs);
      const def = locs.find(l => l.isDefault);
      if (def) setForm(f => ({ ...f, locationId: def.id }));
    }).catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    load(1, searchInput);
  };

  const openCreate = async () => {
    setShowCreate(true);
    setVariantsLoading(true);
    try {
      const fresh = await wGet<Variant[]>('/api/variants');
      setVariants(fresh);
      setForm(f => ({ ...f, variantId: '', unitSalePrice: 0, unitCostPrice: 0, unitShippingCost: 0 }));
    } catch { /* ignore */ } finally { setVariantsLoading(false); }
  };

  const handleVariantChange = (variantId: string) => {
    const v = variants.find(x => x.id === variantId);
    const price = v?.activePromotion ? v.activePromotion.price : (v?.salePrice || 0);
    const defLoc = v?.product?.defaultLocationId;
    setForm(f => ({ ...f, variantId, unitSalePrice: price, unitCostPrice: v?.costPrice || 0, unitShippingCost: v?.shippingCost || 0, ...(defLoc ? { locationId: defLoc } : {}) }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr('');
    try {
      const res = await wFetch('/api/sales', { method: 'POST', body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) });
      const d = await res.json();
      if (!res.ok) { setCreateErr(d.error || 'Erreur'); return; }
      setShowCreate(false);
      load(1);
    } catch (err) { setCreateErr(err instanceof Error ? err.message : 'Erreur'); }
  };

  const deleteSale = async (id: string) => {
    if (!confirm('Supprimer cette vente ?')) return;
    await wFetch(`/api/sales/${id}`, { method: 'DELETE' });
    load(page);
  };

  const deleteReturn = async (returnId: string) => {
    if (!confirm('Supprimer ce retour ?')) return;
    await wFetch(`/api/returns/${returnId}`, { method: 'DELETE' });
    load(page);
  };

  const addReturn = async (saleId: string, max: number) => {
    const qStr = prompt(`Quantité à retourner (max ${max}):`);
    if (!qStr) return;
    const q = parseInt(qStr);
    if (!q || q <= 0 || q > max) return;
    const reason = prompt('Raison (optionnel):') || 'Retour';
    await wFetch('/api/returns', { method: 'POST', body: JSON.stringify({ saleId, quantity: q, reason }) });
    load(page);
  };

  const goPage = (p: number) => { setPage(p); load(p); };

  const exportCSV = () => {
    const params = new URLSearchParams();
    if (exportFrom) params.set('from', exportFrom);
    if (exportTo)   params.set('to',   exportTo);
    const token = getWebToken();
    const url = `/api/export/sales?${params}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ventes_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Ventes</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* CSV Export */}
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} style={{ width: '9rem', fontSize: '0.75rem', padding: '0.375rem 0.5rem' }} placeholder="Début" />
            <input type="date" value={exportTo}   onChange={e => setExportTo(e.target.value)}   style={{ width: '9rem', fontSize: '0.75rem', padding: '0.375rem 0.5rem' }} placeholder="Fin" />
            <button onClick={exportCSV} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', whiteSpace: 'nowrap' }}>⬇ CSV</button>
          </div>
          <button onClick={() => showCreate ? setShowCreate(false) : openCreate()} className="btn-primary">+ Nouvelle vente</button>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Rechercher produit, variante, notes…" style={{ flex: 1 }} />
        <button type="submit" className="btn-ghost" style={{ fontSize: '0.8125rem' }}>Rechercher</button>
        {search && <button type="button" onClick={() => { setSearchInput(''); setSearch(''); load(1, ''); }} className="btn-ghost" style={{ fontSize: '0.8125rem' }}>✕</button>}
      </form>

      {showCreate && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Nouvelle vente</h2>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Variante</label>
              <select value={form.variantId} onChange={e => handleVariantChange(e.target.value)} required disabled={variantsLoading}>
                <option value="">{variantsLoading ? 'Chargement…' : '— Sélectionner —'}</option>
                {variants.map(v => <option key={v.id} value={v.id}>{v.name}{v.activePromotion ? ` 🏷️ ${v.activePromotion.price.toFixed(2)} €` : ''}</option>)}
              </select>
              {form.variantId && variants.find(v => v.id === form.variantId)?.activePromotion && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>
                  🏷️ Promotion active — prix : {variants.find(v => v.id === form.variantId)!.activePromotion!.price.toFixed(2)} €
                </p>
              )}
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Zone</label>
              <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))} required>
                <option value="">— Sélectionner —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault ? '★ ' : ''}{l.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Quantité</label>
              <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} required />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Prix vente (€)</label>
              <input type="number" step="0.01" value={form.unitSalePrice} onChange={e => setForm(f => ({ ...f, unitSalePrice: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Prix achat (€)</label>
              <input type="number" step="0.01" value={form.unitCostPrice} onChange={e => setForm(f => ({ ...f, unitCostPrice: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Frais port (€)</label>
              <input type="number" step="0.01" value={form.unitShippingCost} onChange={e => setForm(f => ({ ...f, unitShippingCost: Number(e.target.value) }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes optionnelles" />
            </div>
            {createErr && <p style={{ gridColumn: '1 / -1', margin: 0, color: '#ef4444', fontSize: '0.875rem' }}>{createErr}</p>}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn-primary">Enregistrer</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Annuler</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? <p style={{ color: '#475569' }}>Chargement…</p> : (
          <>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{data.total} vente{data.total !== 1 ? 's' : ''}{search && ` — recherche: "${search}"`}</p>
            <table>
              <thead><tr><th>Date</th><th>Produit</th><th>Zone</th><th>Qté</th><th>CA</th><th>TVA</th><th>Marge</th><th>Commande</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {data.sales.flatMap(s => {
                  const ret = s.returns?.reduce((sum, r) => sum + r.quantity, 0) || 0;
                  const net = s.quantity - ret;
                  const revenue = net * s.unitSalePrice;
                  const vatRate = s.vatRate ?? 20;
                  const vat = revenue * vatRate / (100 + vatRate);
                  const margin  = revenue - net * s.unitCostPrice - net * s.unitShippingCost;
                  const orderRef = s.order ? (s.order.customerName || s.order.customerEmail || s.order.id.slice(0, 8)) : null;
                  return [
                    <tr key={s.id}>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(s.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td>{s.variant ? `${s.variant.product.name} · ${s.variant.name}` : s.variantId.slice(0, 8)}</td>
                      <td style={{ fontSize: '0.75rem' }}>{s.location?.name || '—'}</td>
                      <td>{s.quantity}{ret > 0 && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}> -{ret}</span>}</td>
                      <td style={{ color: '#3b82f6' }}>{revenue.toFixed(2)} €</td>
                      <td style={{ color: '#a78bfa', fontSize: '0.8125rem' }}>{vat.toFixed(2)} €</td>
                      <td style={{ color: margin >= 0 ? '#22c55e' : '#ef4444' }}>{margin.toFixed(2)} €</td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{orderRef ? <span style={{ color: '#94a3b8' }}>{orderRef}</span> : '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.notes || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => addReturn(s.id, s.quantity - ret)} style={{ background: 'none', border: '1px solid #2a3045', borderRadius: '0.375rem', color: '#94a3b8', fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}>↩</button>
                          <button onClick={() => deleteSale(s.id)} style={{ background: 'none', border: '1px solid #7f1d1d', borderRadius: '0.375rem', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}>✕</button>
                        </div>
                      </td>
                    </tr>,
                    ...(s.returns || []).map(r => (
                      <tr key={`ret-${r.id}`} style={{ background: '#0f1218' }}>
                        <td></td>
                        <td colSpan={7} style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: '2rem' }}>↩ Retour: {r.quantity} · {r.reason || '—'}</td>
                        <td></td>
                        <td><button onClick={() => deleteReturn(r.id)} style={{ background: 'none', border: '1px solid #7f1d1d', borderRadius: '0.375rem', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}>✕</button></td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
            {data.pages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                <button onClick={() => goPage(page - 1)} disabled={page === 1} className="btn-ghost" style={{ fontSize: '0.75rem' }}>← Préc</button>
                <span style={{ color: '#64748b', fontSize: '0.875rem', alignSelf: 'center' }}>Page {page}/{data.pages}</span>
                <button onClick={() => goPage(page + 1)} disabled={page === data.pages} className="btn-ghost" style={{ fontSize: '0.75rem' }}>Suiv →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
