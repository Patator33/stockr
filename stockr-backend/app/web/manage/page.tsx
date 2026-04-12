'use client';
import { useEffect, useState } from 'react';
import { wGet, wFetch } from '../_api';

interface Product  { id: string; name: string; description?: string | null; defaultLocationId?: string | null; _count?: { variants: number }; }
interface Variant  { id: string; name: string; costPrice: number; salePrice: number; shippingCost: number; barcode?: string | null; supplierRef?: string | null; stocks?: { quantity: number; location: { name: string } }[]; }
interface Location { id: string; name: string; description?: string | null; isDefault?: boolean; }
interface StockItem { variantId: string; variantName: string; productName: string; quantity: number; }
interface StockByLoc { location: Location; items: StockItem[]; }

type Tab = 'products' | 'stock' | 'locations' | 'returns';

export default function ManagePage() {
  const [tab, setTab] = useState<Tab>('products');
  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Gestion</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['products','stock','locations','returns'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '0.4375rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #2a3045', background: tab === t ? '#1a2035' : 'none', color: tab === t ? '#e2e8f0' : '#64748b', fontSize: '0.875rem', fontWeight: tab === t ? 600 : 400 }}>
            {{ products:'Produits', stock:'Stock', locations:'Zones', returns:'Retours' }[t]}
          </button>
        ))}
      </div>
      {tab === 'products'  && <ProductsTab />}
      {tab === 'stock'     && <StockTab />}
      {tab === 'locations' && <LocationsTab />}
      {tab === 'returns'   && <ReturnsTab />}
    </div>
  );
}

/* ── Products ── */
function ProductsTab() {
  const [products,  setProducts]  = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected,  setSelected]  = useState<Product | null>(null);
  const [variants,  setVariants]  = useState<Variant[]>([]);
  const [showNewP,  setShowNewP]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newDesc,   setNewDesc]   = useState('');
  const [editP,     setEditP]     = useState<Product | null>(null);
  const [showNewV,  setShowNewV]  = useState(false);
  const [vForm, setVForm] = useState({ name:'', costPrice:0, salePrice:0, shippingCost:0, barcode:'', supplierRef:'' });
  const [vError, setVError] = useState('');

  const loadProducts = () => wGet<Product[]>('/api/products').then(setProducts).catch(() => {});
  const loadVariants = (pid: string) => wGet<Variant[]>(`/api/variants?productId=${pid}`).then(setVariants).catch(() => {});

  useEffect(() => {
    loadProducts();
    wGet<Location[]>('/api/locations').then(setLocations).catch(() => {});
  }, []);

  const selectProduct = (p: Product) => { setSelected(p); setEditP(null); setShowNewV(false); loadVariants(p.id); };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await wFetch('/api/products', { method:'POST', body: JSON.stringify({ name: newName, description: newDesc }) });
    setNewName(''); setNewDesc(''); setShowNewP(false); loadProducts();
  };

  const updateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editP) return;
    await wFetch(`/api/products/${editP.id}`, { method:'PUT', body: JSON.stringify({ name: editP.name, description: editP.description, defaultLocationId: editP.defaultLocationId }) });
    setSelected(editP); setEditP(null); loadProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Supprimer ce produit et toutes ses variantes ?')) return;
    await wFetch(`/api/products/${id}`, { method:'DELETE' });
    setSelected(null); loadProducts();
  };

  const createVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setVError('');
    const res = await wFetch('/api/variants', { method:'POST', body: JSON.stringify({
      productId: selected.id, ...vForm, attributes:[],
      barcode: vForm.barcode || null, supplierRef: vForm.supplierRef || null,
    })});
    const d = await res.json();
    if (!res.ok) { setVError(d.error || 'Erreur'); return; }
    setVForm({ name:'', costPrice:0, salePrice:0, shippingCost:0, barcode:'', supplierRef:'' });
    setShowNewV(false); loadVariants(selected.id);
  };

  const deleteVariant = async (id: string) => {
    if (!confirm('Supprimer cette variante ?')) return;
    const res = await wFetch(`/api/variants/${id}`, { method:'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Erreur'); return; }
    if (selected) loadVariants(selected.id);
  };

  return (
    <div style={{ display:'flex', gap:'1.5rem' }}>
      {/* List */}
      <div style={{ width:'18rem', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
          <h2 style={{ margin:0, fontSize:'0.875rem', fontWeight:700, color:'#94a3b8' }}>PRODUITS</h2>
          <button onClick={() => setShowNewP(!showNewP)} className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.25rem 0.625rem' }}>+</button>
        </div>
        {showNewP && (
          <form onSubmit={createProduct} style={{ marginBottom:'0.75rem', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom du produit" required />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (opt)" />
            <button type="submit" className="btn-primary" style={{ fontSize:'0.8125rem' }}>Créer</button>
          </form>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
          {products.map(p => (
            <div key={p.id} onClick={() => selectProduct(p)}
              style={{ padding:'0.625rem 0.75rem', borderRadius:'0.5rem', border:`1px solid ${selected?.id===p.id?'#3b82f6':'#2a3045'}`, background:selected?.id===p.id?'#1a2035':'#141824', cursor:'pointer' }}>
              <p style={{ margin:0, fontSize:'0.875rem', color:'#e2e8f0', fontWeight:600 }}>{p.name}</p>
              <p style={{ margin:0, fontSize:'0.7rem', color:'#475569' }}>{p._count?.variants||0} variante{(p._count?.variants||0)!==1?'s':''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      {selected && (
        <div className="card" style={{ flex:1 }}>
          {editP ? (
            <form onSubmit={updateProduct} style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:700 }}>Modifier</h2>
              <div><label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Nom</label><input value={editP.name} onChange={e => setEditP(p => p?{...p,name:e.target.value}:p)} required /></div>
              <div><label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Description</label><input value={editP.description||''} onChange={e => setEditP(p => p?{...p,description:e.target.value}:p)} /></div>
              <div>
                <label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Zone par défaut</label>
                <select value={editP.defaultLocationId||''} onChange={e => setEditP(p => p?{...p,defaultLocationId:e.target.value||null}:p)}>
                  <option value="">— Aucune —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault?'★ ':''}{l.name}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button type="submit" className="btn-primary">Sauvegarder</button>
                <button type="button" onClick={() => setEditP(null)} className="btn-ghost">Annuler</button>
              </div>
            </form>
          ) : (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
              <div>
                <h2 style={{ margin:'0 0 0.25rem', fontSize:'1.125rem', fontWeight:700 }}>{selected.name}</h2>
                {selected.description && <p style={{ margin:0, fontSize:'0.875rem', color:'#64748b' }}>{selected.description}</p>}
              </div>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setEditP(selected)} className="btn-ghost" style={{ fontSize:'0.75rem' }}>Modifier</button>
                <button onClick={() => deleteProduct(selected.id)} className="btn-danger" style={{ fontSize:'0.75rem' }}>Supprimer</button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
            <h3 style={{ margin:0, fontSize:'0.875rem', fontWeight:700, color:'#94a3b8' }}>VARIANTES</h3>
            <button onClick={() => setShowNewV(!showNewV)} className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.25rem 0.625rem' }}>+</button>
          </div>

          {showNewV && (
            <form onSubmit={createVariant} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem', marginBottom:'1rem', background:'#0f1629', padding:'0.75rem', borderRadius:'0.5rem' }}>
              <div style={{ gridColumn:'1 / -1' }}><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Nom</label><input value={vForm.name} onChange={e => setVForm(f=>({...f,name:e.target.value}))} required /></div>
              <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Prix achat</label><input type="number" step="0.01" value={vForm.costPrice} onChange={e => setVForm(f=>({...f,costPrice:Number(e.target.value)}))} /></div>
              <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Prix vente</label><input type="number" step="0.01" value={vForm.salePrice} onChange={e => setVForm(f=>({...f,salePrice:Number(e.target.value)}))} /></div>
              <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Frais port</label><input type="number" step="0.01" value={vForm.shippingCost} onChange={e => setVForm(f=>({...f,shippingCost:Number(e.target.value)}))} /></div>
              <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Code barre</label><input value={vForm.barcode} onChange={e => setVForm(f=>({...f,barcode:e.target.value}))} /></div>
              <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Réf. fournisseur</label><input value={vForm.supplierRef} onChange={e => setVForm(f=>({...f,supplierRef:e.target.value}))} /></div>
              {vError && <p style={{ gridColumn:'1 / -1', margin:0, color:'#ef4444', fontSize:'0.8125rem' }}>{vError}</p>}
              <div style={{ gridColumn:'1 / -1', display:'flex', gap:'0.5rem' }}>
                <button type="submit" className="btn-primary" style={{ fontSize:'0.8125rem' }}>Créer variante</button>
                <button type="button" onClick={() => setShowNewV(false)} className="btn-ghost" style={{ fontSize:'0.8125rem' }}>Annuler</button>
              </div>
            </form>
          )}

          <table>
            <thead><tr><th>Nom</th><th>Achat</th><th>Vente</th><th>Port</th><th>Code barre</th><th>Stock</th><th></th></tr></thead>
            <tbody>
              {variants.map(v => {
                const totalStock = v.stocks?.reduce((s,st) => s+st.quantity, 0) || 0;
                return (
                  <tr key={v.id}>
                    <td style={{ fontWeight:600 }}>{v.name}</td>
                    <td style={{ fontSize:'0.8125rem' }}>{v.costPrice.toFixed(2)} €</td>
                    <td style={{ fontSize:'0.8125rem', color:'#3b82f6' }}>{v.salePrice.toFixed(2)} €</td>
                    <td style={{ fontSize:'0.8125rem' }}>{v.shippingCost.toFixed(2)} €</td>
                    <td style={{ fontSize:'0.75rem', color:'#64748b' }}>{v.barcode||'—'}</td>
                    <td style={{ fontWeight:600, color:totalStock>0?'#22c55e':'#ef4444' }}>{totalStock}</td>
                    <td><button onClick={() => deleteVariant(v.id)} style={{ background:'none', border:'1px solid #7f1d1d', borderRadius:'0.375rem', color:'#ef4444', fontSize:'0.7rem', padding:'0.2rem 0.4rem' }}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Stock ── */
function StockTab() {
  const [stock,     setStock]     = useState<StockByLoc[]>([]);
  const [variants,  setVariants]  = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState({ variantId:'', locationId:'', quantity:0 });
  const [msg,  setMsg]  = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); wGet<StockByLoc[]>('/api/stocks').then(setStock).catch(()=>{}).finally(()=>setLoading(false)); };

  useEffect(() => {
    load();
    wGet<Variant[]>('/api/variants').then(setVariants).catch(()=>{});
    wGet<Location[]>('/api/locations').then(locs => {
      setLocations(locs);
      const def = locs.find(l => l.isDefault);
      if (def) setForm(f => ({...f, locationId:def.id}));
    }).catch(()=>{});
  }, []);

  const adjust = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    const res = await wFetch('/api/stocks/adjust', { method:'POST', body:JSON.stringify({...form, quantity:Number(form.quantity)}) });
    if (!res.ok) { const d=await res.json(); setMsg(d.error||'Erreur'); return; }
    setMsg('✓ Stock ajusté'); load();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card">
        <h2 style={{ margin:'0 0 1rem', fontSize:'1rem', fontWeight:700 }}>Ajuster le stock</h2>
        <form onSubmit={adjust} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto', gap:'0.75rem', alignItems:'end' }}>
          <div><label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Variante</label>
            <select value={form.variantId} onChange={e => setForm(f=>({...f,variantId:e.target.value}))} required>
              <option value="">— Sélectionner —</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Zone</label>
            <select value={form.locationId} onChange={e => setForm(f=>({...f,locationId:e.target.value}))} required>
              <option value="">— Sélectionner —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault?'★ ':''}{l.name}</option>)}
            </select>
          </div>
          <div><label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Quantité</label>
            <input type="number" value={form.quantity} onChange={e => setForm(f=>({...f,quantity:Number(e.target.value)}))} required style={{ width:'7rem' }} />
          </div>
          <button type="submit" className="btn-primary">Ajuster</button>
        </form>
        {msg && <p style={{ marginTop:'0.5rem', fontSize:'0.875rem', color:msg.startsWith('✓')?'#22c55e':'#ef4444' }}>{msg}</p>}
      </div>
      {loading && <p style={{ color:'#475569' }}>Chargement…</p>}
      {stock.map(s => (
        <div key={s.location.id} className="card">
          <h2 style={{ margin:'0 0 0.75rem', fontSize:'0.875rem', fontWeight:700, color:'#94a3b8' }}>
            {s.location.isDefault?'★ ':''}{s.location.name}
            <span style={{ marginLeft:'0.5rem', color:'#475569', fontSize:'0.75rem', fontWeight:400 }}>({s.items.length} réf.)</span>
          </h2>
          <table>
            <thead><tr><th>Produit</th><th>Variante</th><th>Quantité</th></tr></thead>
            <tbody>
              {s.items.map(i => (
                <tr key={i.variantId}>
                  <td style={{ fontSize:'0.8125rem', color:'#94a3b8' }}>{i.productName}</td>
                  <td style={{ fontWeight:600 }}>{i.variantName}</td>
                  <td style={{ fontWeight:700, color:i.quantity>0?'#22c55e':i.quantity<0?'#ef4444':'#64748b' }}>{i.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ── Locations ── */
function LocationsTab() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [form,   setForm]   = useState({ name:'', description:'' });
  const [editId, setEditId] = useState<string|null>(null);
  const [editF,  setEditF]  = useState({ name:'', description:'' });

  const load = () => wGet<Location[]>('/api/locations').then(setLocations).catch(()=>{});
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await wFetch('/api/locations', { method:'POST', body:JSON.stringify(form) });
    setForm({ name:'', description:'' }); load();
  };
  const save = async (id: string) => {
    await wFetch(`/api/locations/${id}`, { method:'PUT', body:JSON.stringify(editF) });
    setEditId(null); load();
  };
  const setDefault = async (id: string) => {
    await wFetch(`/api/locations/${id}`, { method:'PATCH', body:JSON.stringify({ isDefault:true }) });
    load();
  };
  const del = async (id: string) => {
    if (!confirm('Supprimer cette zone ?')) return;
    await wFetch(`/api/locations/${id}`, { method:'DELETE' }); load();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:'40rem' }}>
      <div className="card">
        <h2 style={{ margin:'0 0 1rem', fontSize:'1rem', fontWeight:700 }}>Nouvelle zone</h2>
        <form onSubmit={create} style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Nom" required />
          <input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Description (opt)" />
          <button type="submit" className="btn-primary" style={{ alignSelf:'flex-start' }}>Créer</button>
        </form>
      </div>
      <div className="card">
        <h2 style={{ margin:'0 0 0.75rem', fontSize:'1rem', fontWeight:700 }}>Zones de stockage</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {locations.map(l => (
            <div key={l.id} style={{ padding:'0.75rem', border:'1px solid #2a3045', borderRadius:'0.5rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
              {editId === l.id ? (
                <>
                  <div style={{ flex:1, display:'flex', gap:'0.5rem' }}>
                    <input value={editF.name} onChange={e => setEditF(f=>({...f,name:e.target.value}))} style={{ flex:1 }} />
                    <input value={editF.description} onChange={e => setEditF(f=>({...f,description:e.target.value}))} placeholder="Description" style={{ flex:1 }} />
                  </div>
                  <button onClick={() => save(l.id)} className="btn-primary" style={{ fontSize:'0.75rem', padding:'0.375rem 0.75rem' }}>OK</button>
                  <button onClick={() => setEditId(null)} className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.375rem 0.75rem' }}>✕</button>
                </>
              ) : (
                <>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontWeight:600, fontSize:'0.875rem' }}>{l.isDefault && <span style={{ color:'#f59e0b', marginRight:'0.375rem' }}>★</span>}{l.name}</p>
                    {l.description && <p style={{ margin:0, fontSize:'0.75rem', color:'#64748b' }}>{l.description}</p>}
                  </div>
                  {!l.isDefault && <button onClick={() => setDefault(l.id)} style={{ background:'none', border:'1px solid #2a3045', borderRadius:'0.375rem', color:'#f59e0b', fontSize:'0.75rem', padding:'0.25rem 0.5rem' }}>☆ Défaut</button>}
                  <button onClick={() => { setEditId(l.id); setEditF({ name:l.name, description:l.description||'' }); }} className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.25rem 0.5rem' }}>Modifier</button>
                  <button onClick={() => del(l.id)} className="btn-danger" style={{ fontSize:'0.75rem', padding:'0.25rem 0.5rem' }}>Supprimer</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Returns ── */
function ReturnsTab() {
  const [variants,  setVariants]  = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [quantities, setQuantities] = useState<Record<string,number>>({});
  const [locationId, setLocationId] = useState('');
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    wGet<Variant[]>('/api/variants').then(setVariants).catch(()=>{});
    wGet<Location[]>('/api/locations').then(locs => {
      setLocations(locs);
      const def = locs.find(l => l.isDefault);
      if (def) setLocationId(def.id);
    }).catch(()=>{});
  }, []);

  const submit = async () => {
    setMsg('');
    const items = Object.entries(quantities).filter(([,q]) => q>0).map(([variantId,quantity]) => ({ variantId, quantity }));
    if (items.length === 0) { setMsg('Aucun article'); return; }
    if (!locationId)        { setMsg('Sélectionnez une zone'); return; }
    setLoading(true);
    const res = await wFetch('/api/stock-returns', { method:'POST', body:JSON.stringify({ items, locationId }) });
    const d = await res.json();
    if (!res.ok) setMsg(d.error||'Erreur');
    else { setMsg(`✓ ${d.count} article(s) retournés`); setQuantities({}); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth:'40rem' }}>
      <div className="card">
        <h2 style={{ margin:'0 0 1rem', fontSize:'1rem', fontWeight:700 }}>Retour en stock</h2>
        <div style={{ marginBottom:'1rem' }}>
          <label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Zone de destination</label>
          <select value={locationId} onChange={e => setLocationId(e.target.value)} style={{ width:'auto', minWidth:'14rem' }}>
            <option value="">— Sélectionner —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault?'★ ':''}{l.name}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem', marginBottom:'1rem' }}>
          {variants.map(v => (
            <div key={v.id} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem', borderRadius:'0.375rem', background:'#0f1629' }}>
              <span style={{ flex:1, fontSize:'0.875rem' }}>{v.name}</span>
              <div style={{ display:'flex', alignItems:'center', gap:'0.375rem' }}>
                <button onClick={() => setQuantities(q=>({...q,[v.id]:Math.max(0,(q[v.id]||0)-1)}))} style={{ width:'1.75rem', height:'1.75rem', background:'#1a2035', border:'1px solid #2a3045', borderRadius:'0.375rem', color:'#e2e8f0' }}>−</button>
                <input type="number" min={0} value={quantities[v.id]||0} onChange={e => setQuantities(q=>({...q,[v.id]:Math.max(0,Number(e.target.value))}))} style={{ width:'3.5rem', textAlign:'center' }} />
                <button onClick={() => setQuantities(q=>({...q,[v.id]:(q[v.id]||0)+1}))} style={{ width:'1.75rem', height:'1.75rem', background:'#1a2035', border:'1px solid #2a3045', borderRadius:'0.375rem', color:'#e2e8f0' }}>+</button>
              </div>
            </div>
          ))}
        </div>
        {msg && <p style={{ margin:'0 0 0.75rem', fontSize:'0.875rem', color:msg.startsWith('✓')?'#22c55e':'#ef4444' }}>{msg}</p>}
        <button onClick={submit} className="btn-primary" disabled={loading}>{loading?'Traitement…':'Valider les retours'}</button>
      </div>
    </div>
  );
}
