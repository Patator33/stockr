'use client';
import { useEffect, useState } from 'react';
import { wGet, wFetch } from '../_api';

interface Product  { id: string; name: string; description?: string | null; defaultLocationId?: string | null; _count?: { variants: number }; }
interface Variant  { id: string; name: string; attributes: string; costPrice: number; salePrice: number; shippingCost: number; vatRate: number; barcode?: string | null; supplierRef?: string | null; lowStockThreshold?: number | null; stocks?: { quantity: number; location: { name: string } }[]; activePromotion?: Promotion | null; supplierPrices?: SupplierPrice[]; }
interface Promotion { id: string; variantId: string; price: number; startDate: string; endDate?: string | null; supplierId?: string | null; supplier?: { id: string; name: string } | null; }
interface Attr     { key: string; value: string; }
interface Location { id: string; name: string; description?: string | null; isDefault?: boolean; }
interface StockItem { variantId: string; variantName: string; productName: string; quantity: number; }
interface StockByLoc { location: Location; items: StockItem[]; }
interface Supplier { id: string; name: string; description?: string | null; createdAt: string; }
interface SupplierPrice { id: string; variantId: string; supplierId: string; supplierRef?: string | null; salePrice: number; costPrice: number; shippingCost: number; vatRate: number; supplier: Supplier; }

type Tab = 'products' | 'stock' | 'locations' | 'returns' | 'suppliers';

function parseAttrs(s: string): Attr[] { try { return JSON.parse(s) || []; } catch { return []; } }

// Collect all distinct attribute keys used across a list of variants
function collectAttrKeys(variants: Variant[]): string[] {
  const keys = new Set<string>();
  variants.forEach(v => parseAttrs(v.attributes).forEach(a => { if (a.key) keys.add(a.key); }));
  return [...keys];
}

export default function ManagePage() {
  const [tab, setTab] = useState<Tab>('products');
  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Gestion</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['products','stock','locations','returns','suppliers'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '0.4375rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #2a3045', background: tab === t ? '#1a2035' : 'none', color: tab === t ? '#e2e8f0' : '#64748b', fontSize: '0.875rem', fontWeight: tab === t ? 600 : 400 }}>
            {{ products:'Produits', stock:'Stock', locations:'Zones', returns:'Retours', suppliers:'Fournisseurs' }[t]}
          </button>
        ))}
      </div>
      {tab === 'products'  && <ProductsTab />}
      {tab === 'stock'     && <StockTab />}
      {tab === 'locations' && <LocationsTab />}
      {tab === 'returns'   && <ReturnsTab />}
      {tab === 'suppliers' && <SuppliersTab />}
    </div>
  );
}

/* ─── Variant form (shared by create + edit) ─── */
interface VFormData { name: string; costPrice: number; salePrice: number; shippingCost: number; vatRate: number; barcode: string; supplierRef: string; lowStockThreshold: string; attrs: Attr[]; }
const emptyVForm = (): VFormData => ({ name:'', costPrice:0, salePrice:0, shippingCost:0, vatRate:20, barcode:'', supplierRef:'', lowStockThreshold:'', attrs:[{ key:'', value:'' }] });

function VariantForm({
  title, initial, attrKeys, onSubmit, onCancel, error, loading,
}: {
  title: string;
  initial: VFormData;
  attrKeys: string[];
  onSubmit: (f: VFormData) => void;
  onCancel: () => void;
  error: string;
  loading: boolean;
}) {
  const [f, setF] = useState<VFormData>(initial);

  // When attr keys change (e.g. first time opening), pre-fill missing keys
  useEffect(() => {
    if (f.attrs.length === 1 && f.attrs[0].key === '' && attrKeys.length > 0) {
      setF(prev => ({ ...prev, attrs: attrKeys.map(k => ({ key: k, value: '' })) }));
    }
  }, [attrKeys.join(',')]);

  const setAttr = (i: number, field: 'key'|'value', val: string) =>
    setF(prev => ({ ...prev, attrs: prev.attrs.map((a, idx) => idx === i ? { ...a, [field]: val } : a) }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f); }}
      style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem', background:'#0f1629', padding:'0.75rem', borderRadius:'0.5rem', marginBottom:'1rem' }}>
      <p style={{ gridColumn:'1 / -1', margin:'0 0 0.25rem', fontWeight:700, fontSize:'0.875rem', color:'#e2e8f0' }}>{title}</p>

      <div style={{ gridColumn:'1 / -1' }}>
        <label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Nom *</label>
        <input value={f.name} onChange={e => setF(p=>({...p,name:e.target.value}))} required />
      </div>

      {/* Attributes */}
      <div style={{ gridColumn:'1 / -1' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.25rem' }}>
          <label style={{ fontSize:'0.7rem', color:'#64748b' }}>Attributs</label>
          <button type="button" onClick={() => setF(p=>({...p,attrs:[...p.attrs,{key:'',value:''}]}))}
            style={{ background:'none', border:'none', color:'#3b82f6', fontSize:'0.75rem', cursor:'pointer' }}>+ Ajouter</button>
        </div>
        {f.attrs.map((a, i) => (
          <div key={i} style={{ display:'flex', gap:'0.375rem', marginBottom:'0.25rem', alignItems:'center' }}>
            <input value={a.key} onChange={e => setAttr(i,'key',e.target.value)} placeholder="Clé"
              list={`attrkeys-${i}`} style={{ flex:1 }} />
            {attrKeys.length > 0 && (
              <datalist id={`attrkeys-${i}`}>
                {attrKeys.map(k => <option key={k} value={k} />)}
              </datalist>
            )}
            <input value={a.value} onChange={e => setAttr(i,'value',e.target.value)} placeholder="Valeur" style={{ flex:1 }} />
            {f.attrs.length > 1 && (
              <button type="button" onClick={() => setF(p=>({...p,attrs:p.attrs.filter((_,idx)=>idx!==i)}))}
                style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:'0 0.25rem' }}>✕</button>
            )}
          </div>
        ))}
      </div>

      <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Prix achat €</label><input type="number" step="0.01" value={f.costPrice} onChange={e => setF(p=>({...p,costPrice:Number(e.target.value)}))} /></div>
      <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Prix vente €</label><input type="number" step="0.01" value={f.salePrice} onChange={e => setF(p=>({...p,salePrice:Number(e.target.value)}))} /></div>
      <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Frais port €</label><input type="number" step="0.01" value={f.shippingCost} onChange={e => setF(p=>({...p,shippingCost:Number(e.target.value)}))} /></div>
      <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>TVA %</label><input type="number" step="0.1" min="0" max="100" value={f.vatRate} onChange={e => setF(p=>({...p,vatRate:Number(e.target.value)}))} /></div>
      <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Code barre</label><input value={f.barcode} onChange={e => setF(p=>({...p,barcode:e.target.value}))} /></div>
      <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Réf. fournisseur</label><input value={f.supplierRef} onChange={e => setF(p=>({...p,supplierRef:e.target.value}))} /></div>
      <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Alerte stock bas (seuil)</label><input type="number" min="0" step="1" value={f.lowStockThreshold} onChange={e => setF(p=>({...p,lowStockThreshold:e.target.value}))} placeholder="ex: 5" /></div>

      {error && <p style={{ gridColumn:'1 / -1', margin:0, color:'#ef4444', fontSize:'0.8125rem' }}>{error}</p>}
      <div style={{ gridColumn:'1 / -1', display:'flex', gap:'0.5rem' }}>
        <button type="submit" className="btn-primary" style={{ fontSize:'0.8125rem' }} disabled={loading}>{loading?'…':'Enregistrer'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost" style={{ fontSize:'0.8125rem' }}>Annuler</button>
      </div>
    </form>
  );
}

/* ── Products Tab ── */
function ProductsTab() {
  const [products,  setProducts]  = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [selected,  setSelected]  = useState<Product | null>(null);
  const [variants,  setVariants]  = useState<Variant[]>([]);
  const [showNewP,  setShowNewP]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newDesc,   setNewDesc]   = useState('');
  const [editP,     setEditP]     = useState<Product | null>(null);
  const [showNewV,  setShowNewV]  = useState(false);
  const [editV,     setEditV]     = useState<Variant | null>(null);
  const [vError,    setVError]    = useState('');
  const [vLoading,  setVLoading]  = useState(false);
  // Supplier refs for the variant being edited
  const [supplierRefInputs, setSupplierRefInputs] = useState<Record<string, string>>({}); // supplierId → ref value
  const [supplierRefMsg,    setSupplierRefMsg]    = useState('');

  // Promotions (per variant)
  const [promoV,    setPromoV]    = useState<string | null>(null); // variantId showing promo panel
  const [promos,    setPromos]    = useState<Record<string, Promotion[]>>({});
  const [promoForm, setPromoForm] = useState({ price:'', startDate: new Date().toISOString().slice(0,10), endDate:'' });
  const [promoErr,  setPromoErr]  = useState('');

  // Product-level promo
  const [showProductPromo, setShowProductPromo] = useState(false);
  const [productPromoForm, setProductPromoForm] = useState({ price:'', startDate: new Date().toISOString().slice(0,10), endDate:'' });
  const [productPromoErr,  setProductPromoErr]  = useState('');
  const [productPromoOk,   setProductPromoOk]   = useState('');

  const loadPromos = (variantId: string) =>
    wGet<Promotion[]>(`/api/promotions?variantId=${variantId}`)
      .then(p => setPromos(prev => ({ ...prev, [variantId]: p })))
      .catch(()=>{});

  const openPromos = (variantId: string) => {
    if (promoV === variantId) { setPromoV(null); return; }
    setPromoV(variantId);
    setPromoErr('');
    setPromoForm({ price:'', startDate: new Date().toISOString().slice(0,10), endDate:'' });
    loadPromos(variantId);
  };

  const createPromo = async (variantId: string) => {
    setPromoErr('');
    if (!promoForm.price) { setPromoErr('Prix requis'); return; }
    const body = { variantId, price: Number(promoForm.price), startDate: promoForm.startDate, endDate: promoForm.endDate || null };
    const res = await wFetch('/api/promotions', { method:'POST', body:JSON.stringify(body) });
    if (!res.ok) { const d=await res.json(); setPromoErr(d.error||'Erreur'); return; }
    setPromoForm({ price:'', startDate: new Date().toISOString().slice(0,10), endDate:'' });
    loadPromos(variantId);
    if (selected) loadVariants(selected.id);
  };

  const deletePromo = async (promoId: string, variantId: string) => {
    await wFetch(`/api/promotions/${promoId}`, { method:'DELETE' });
    loadPromos(variantId);
    if (selected) loadVariants(selected.id);
  };

  const createProductPromo = async () => {
    if (!selected) return;
    setProductPromoErr(''); setProductPromoOk('');
    if (!productPromoForm.price) { setProductPromoErr('Prix requis'); return; }
    const body = { productId: selected.id, price: Number(productPromoForm.price), startDate: productPromoForm.startDate, endDate: productPromoForm.endDate || null };
    const res = await wFetch('/api/promotions/product', { method:'POST', body:JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) { setProductPromoErr(d.error || 'Erreur'); return; }
    setProductPromoOk(`✓ Promotion créée pour ${d.created} variante${d.created !== 1 ? 's' : ''}`);
    setProductPromoForm({ price:'', startDate: new Date().toISOString().slice(0,10), endDate:'' });
    loadVariants(selected.id);
  };

  const loadProducts = () => wGet<Product[]>('/api/products').then(setProducts).catch(()=>{});
  const loadVariants = (pid: string) => wGet<Variant[]>(`/api/variants?productId=${pid}`).then(setVariants).catch(()=>{});

  useEffect(() => {
    loadProducts();
    wGet<Location[]>('/api/locations').then(setLocations).catch(()=>{});
    wGet<Supplier[]>('/api/suppliers').then(setAllSuppliers).catch(()=>{});
  }, []);

  const selectProduct = (p: Product) => { setSelected(p); setEditP(null); setShowNewV(false); setEditV(null); loadVariants(p.id); };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await wFetch('/api/products', { method:'POST', body:JSON.stringify({ name:newName, description:newDesc }) });
    setNewName(''); setNewDesc(''); setShowNewP(false); loadProducts();
  };
  const updateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editP) return;
    await wFetch(`/api/products/${editP.id}`, { method:'PUT', body:JSON.stringify({ name:editP.name, description:editP.description, defaultLocationId:editP.defaultLocationId }) });
    setSelected(editP); setEditP(null); loadProducts();
  };
  const deleteProduct = async (id: string) => {
    if (!confirm('Supprimer ce produit et toutes ses variantes ?')) return;
    await wFetch(`/api/products/${id}`, { method:'DELETE' });
    setSelected(null); loadProducts();
  };

  const attrKeys = collectAttrKeys(variants);

  const createVariant = async (f: VFormData) => {
    if (!selected) return;
    setVError(''); setVLoading(true);
    const res = await wFetch('/api/variants', { method:'POST', body:JSON.stringify({
      productId:selected.id, name:f.name, attributes:f.attrs.filter(a=>a.key&&a.value),
      costPrice:f.costPrice, salePrice:f.salePrice, shippingCost:f.shippingCost, vatRate:f.vatRate,
      barcode:f.barcode||null, supplierRef:f.supplierRef||null,
      lowStockThreshold: f.lowStockThreshold !== '' ? Number(f.lowStockThreshold) : null,
    })});
    const d = await res.json();
    setVLoading(false);
    if (!res.ok) { setVError(d.error||'Erreur'); return; }
    setShowNewV(false); setVError(''); loadVariants(selected.id);
  };

  const updateVariant = async (f: VFormData) => {
    if (!editV) return;
    setVError(''); setVLoading(true);
    const res = await wFetch(`/api/variants/${editV.id}`, { method:'PUT', body:JSON.stringify({
      name:f.name, attributes:f.attrs.filter(a=>a.key&&a.value),
      costPrice:f.costPrice, salePrice:f.salePrice, shippingCost:f.shippingCost, vatRate:f.vatRate,
      barcode:f.barcode||null, supplierRef:f.supplierRef||null,
      lowStockThreshold: f.lowStockThreshold !== '' ? Number(f.lowStockThreshold) : null,
    })});
    const d = await res.json();
    setVLoading(false);
    if (!res.ok) { setVError(d.error||'Erreur'); return; }
    setEditV(null); setVError(''); if (selected) loadVariants(selected.id);
  };

  const deleteVariant = async (id: string) => {
    if (!confirm('Supprimer cette variante ?')) return;
    const res = await wFetch(`/api/variants/${id}`, { method:'DELETE' });
    if (!res.ok) { const d=await res.json(); alert(d.error||'Erreur'); return; }
    if (selected) loadVariants(selected.id);
  };

  return (
    <div style={{ display:'flex', gap:'1.5rem' }}>
      {/* Product list */}
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

      {/* Product detail */}
      {selected && (
        <div className="card" style={{ flex:1 }}>
          {/* Product header */}
          {editP ? (
            <form onSubmit={updateProduct} style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1rem', fontWeight:700 }}>Modifier le produit</h2>
              <div><label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Nom</label><input value={editP.name} onChange={e => setEditP(p=>p?{...p,name:e.target.value}:p)} required /></div>
              <div><label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Description</label><input value={editP.description||''} onChange={e => setEditP(p=>p?{...p,description:e.target.value}:p)} /></div>
              <div>
                <label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Zone par défaut</label>
                <select value={editP.defaultLocationId||''} onChange={e => setEditP(p=>p?{...p,defaultLocationId:e.target.value||null}:p)}>
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
                <button onClick={() => { setShowProductPromo(!showProductPromo); setProductPromoErr(''); setProductPromoOk(''); }} className="btn-ghost" style={{ fontSize:'0.75rem', color: showProductPromo ? '#f59e0b' : undefined }}>🏷️ Promo produit</button>
                <button onClick={() => setEditP(selected)} className="btn-ghost" style={{ fontSize:'0.75rem' }}>Modifier</button>
                <button onClick={() => deleteProduct(selected.id)} className="btn-danger" style={{ fontSize:'0.75rem' }}>Supprimer</button>
              </div>
            </div>
          )}

          {/* Product promo panel */}
          {showProductPromo && (
            <div style={{ background:'#0a0e1a', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem' }}>
              <p style={{ margin:'0 0 0.5rem', fontSize:'0.8125rem', fontWeight:700, color:'#f59e0b' }}>🏷️ Promotion sur toutes les variantes de "{selected.name}"</p>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'flex-end', flexWrap:'wrap' }}>
                <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.2rem' }}>Prix promo €</label><input type="number" step="0.01" value={productPromoForm.price} onChange={e=>setProductPromoForm(p=>({...p,price:e.target.value}))} style={{ width:'7rem' }} /></div>
                <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.2rem' }}>Début</label><input type="date" value={productPromoForm.startDate} onChange={e=>setProductPromoForm(p=>({...p,startDate:e.target.value}))} style={{ width:'9rem' }} /></div>
                <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.2rem' }}>Fin (optionnel)</label><input type="date" value={productPromoForm.endDate} onChange={e=>setProductPromoForm(p=>({...p,endDate:e.target.value}))} style={{ width:'9rem' }} /></div>
                <button onClick={createProductPromo} className="btn-primary" style={{ fontSize:'0.75rem', padding:'0.375rem 0.75rem' }}>Créer pour toutes</button>
              </div>
              {productPromoErr && <p style={{ margin:'0.25rem 0 0', color:'#ef4444', fontSize:'0.75rem' }}>{productPromoErr}</p>}
              {productPromoOk  && <p style={{ margin:'0.25rem 0 0', color:'#22c55e', fontSize:'0.75rem' }}>{productPromoOk}</p>}
            </div>
          )}

          {/* Variants header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
            <h3 style={{ margin:0, fontSize:'0.875rem', fontWeight:700, color:'#94a3b8' }}>VARIANTES</h3>
            <button onClick={() => { setShowNewV(!showNewV); setEditV(null); setVError(''); }} className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.25rem 0.625rem' }}>+</button>
          </div>

          {showNewV && !editV && (
            <VariantForm
              title="Nouvelle variante"
              initial={emptyVForm()}
              attrKeys={attrKeys}
              onSubmit={createVariant}
              onCancel={() => { setShowNewV(false); setVError(''); }}
              error={vError}
              loading={vLoading}
            />
          )}

          {editV && (
            <>
              <VariantForm
                title={`Modifier — ${editV.name}`}
                initial={{
                  name: editV.name,
                  costPrice: editV.costPrice,
                  salePrice: editV.salePrice,
                  shippingCost: editV.shippingCost,
                  vatRate: editV.vatRate,
                  barcode: editV.barcode || '',
                  supplierRef: editV.supplierRef || '',
                  lowStockThreshold: editV.lowStockThreshold != null ? String(editV.lowStockThreshold) : '',
                  attrs: parseAttrs(editV.attributes).length > 0 ? parseAttrs(editV.attributes) : [{ key:'', value:'' }],
                }}
                attrKeys={attrKeys}
                onSubmit={updateVariant}
                onCancel={() => { setEditV(null); setVError(''); }}
                error={vError}
                loading={vLoading}
              />
              {allSuppliers.length > 0 && (
                <div style={{ background:'#0f1629', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem' }}>
                  <p style={{ margin:'0 0 0.5rem', fontWeight:700, fontSize:'0.8125rem', color:'#94a3b8' }}>Références fournisseurs</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
                    {allSuppliers.map(s => (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <span style={{ width:'8rem', fontSize:'0.8125rem', color:'#64748b', flexShrink:0 }}>{s.name}</span>
                        <input
                          value={supplierRefInputs[s.id] ?? ''}
                          onChange={e => setSupplierRefInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="SKU, ASIN, ref…"
                          style={{ flex:1 }}
                        />
                        <button
                          onClick={async () => {
                            setSupplierRefMsg('');
                            await wFetch('/api/supplier-prices', { method:'POST', body:JSON.stringify({ variantId:editV.id, supplierId:s.id, supplierRef:supplierRefInputs[s.id]||null }) });
                            setSupplierRefMsg('✓ Ref sauvegardée');
                            if (selected) loadVariants(selected.id);
                          }}
                          className="btn-ghost" style={{ fontSize:'0.75rem', padding:'0.2rem 0.6rem', whiteSpace:'nowrap' }}>✓</button>
                      </div>
                    ))}
                  </div>
                  {supplierRefMsg && <p style={{ margin:'0.375rem 0 0', fontSize:'0.75rem', color: supplierRefMsg.startsWith('✓')?'#22c55e':'#ef4444' }}>{supplierRefMsg}</p>}
                </div>
              )}
            </>
          )}

          <table>
            <thead><tr><th>Nom</th><th>Attributs</th><th>Achat</th><th>Vente</th><th>TVA</th><th>Code barre</th><th>Stock</th><th></th></tr></thead>
            <tbody>
              {variants.map(v => {
                const attrs = parseAttrs(v.attributes);
                const totalStock = v.stocks?.reduce((s,st)=>s+st.quantity,0)||0;
                return (
                  <>
                    <tr key={v.id}>
                      <td style={{ fontWeight:600 }}>{v.name}{v.activePromotion && <span style={{ marginLeft:'0.375rem', fontSize:'0.7rem', color:'#f59e0b', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'0.25rem', padding:'0.1rem 0.3rem' }}>🏷️ {v.activePromotion.price.toFixed(2)} €</span>}</td>
                      <td style={{ fontSize:'0.75rem', color:'#94a3b8' }}>{attrs.map(a=>`${a.key}: ${a.value}`).join(' · ')||'—'}</td>
                      <td style={{ fontSize:'0.8125rem' }}>{v.costPrice.toFixed(2)} €</td>
                      <td style={{ fontSize:'0.8125rem', color:'#3b82f6' }}>{v.salePrice.toFixed(2)} €</td>
                      <td style={{ fontSize:'0.75rem', color:'#64748b' }}>{(v.vatRate??20).toFixed(0)} %</td>
                      <td style={{ fontSize:'0.75rem', color:'#64748b' }}>{v.barcode||'—'}</td>
                      <td style={{ fontWeight:700, color: v.lowStockThreshold != null && totalStock <= v.lowStockThreshold ? '#f59e0b' : totalStock>0?'#22c55e':totalStock<0?'#ef4444':'#64748b' }}>
                        {totalStock}{v.lowStockThreshold != null && <span style={{ fontSize:'0.65rem', color:'#64748b', marginLeft:'0.25rem' }}>/{v.lowStockThreshold}</span>}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:'0.25rem' }}>
                          <button onClick={() => openPromos(v.id)}
                            style={{ background:'none', border:`1px solid ${promoV===v.id?'rgba(245,158,11,0.5)':'#2a3045'}`, borderRadius:'0.375rem', color:promoV===v.id?'#f59e0b':'#94a3b8', fontSize:'0.7rem', padding:'0.2rem 0.4rem' }}>🏷️</button>
                          <button onClick={() => {
                              setEditV(v); setShowNewV(false); setVError(''); setPromoV(null); setSupplierRefMsg('');
                              // Pre-populate supplier ref inputs from existing supplierPrices
                              const refs: Record<string, string> = {};
                              (v.supplierPrices || []).forEach(sp => { refs[sp.supplierId] = sp.supplierRef ?? ''; });
                              setSupplierRefInputs(refs);
                            }}
                            style={{ background:'none', border:'1px solid #2a3045', borderRadius:'0.375rem', color:'#94a3b8', fontSize:'0.7rem', padding:'0.2rem 0.4rem' }}>✏️</button>
                          <button onClick={() => deleteVariant(v.id)}
                            style={{ background:'none', border:'1px solid #7f1d1d', borderRadius:'0.375rem', color:'#ef4444', fontSize:'0.7rem', padding:'0.2rem 0.4rem' }}>✕</button>
                        </div>
                      </td>
                    </tr>
                    {promoV === v.id && (
                      <tr key={`promo-${v.id}`}>
                        <td colSpan={8} style={{ background:'#0a0e1a', padding:'0.75rem' }}>
                          <p style={{ margin:'0 0 0.5rem', fontSize:'0.8125rem', fontWeight:700, color:'#f59e0b' }}>🏷️ Promotions — {v.name}</p>
                          {/* Existing promos */}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.375rem', marginBottom:'0.75rem' }}>
                            {(promos[v.id]||[]).length === 0 && <span style={{ fontSize:'0.75rem', color:'#475569' }}>Aucune promotion</span>}
                            {(promos[v.id]||[]).map(p => {
                              const now = new Date();
                              const start = new Date(p.startDate);
                              const end = p.endDate ? new Date(p.endDate) : null;
                              const active = start <= now && (!end || end >= now);
                              return (
                                <span key={p.id} style={{ display:'inline-flex', alignItems:'center', gap:'0.375rem', fontSize:'0.75rem', background: active?'rgba(245,158,11,0.08)':'rgba(100,116,139,0.08)', border:`1px solid ${active?'rgba(245,158,11,0.3)':'#2a3045'}`, borderRadius:'0.375rem', padding:'0.25rem 0.5rem', color: active?'#f59e0b':'#64748b' }}>
                                  {active && '✓ '}{p.price.toFixed(2)} € · {new Date(p.startDate).toLocaleDateString('fr-FR')} → {p.endDate ? new Date(p.endDate).toLocaleDateString('fr-FR') : '∞'}
                                  <button onClick={() => deletePromo(p.id, v.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:0, fontSize:'0.75rem' }}>✕</button>
                                </span>
                              );
                            })}
                          </div>
                          {/* New promo form */}
                          <div style={{ display:'flex', gap:'0.5rem', alignItems:'flex-end', flexWrap:'wrap' }}>
                            <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.2rem' }}>Prix promo €</label><input type="number" step="0.01" value={promoForm.price} onChange={e=>setPromoForm(p=>({...p,price:e.target.value}))} style={{ width:'7rem' }} /></div>
                            <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.2rem' }}>Début</label><input type="date" value={promoForm.startDate} onChange={e=>setPromoForm(p=>({...p,startDate:e.target.value}))} style={{ width:'9rem' }} /></div>
                            <div><label style={{ fontSize:'0.7rem', color:'#64748b', display:'block', marginBottom:'0.2rem' }}>Fin (optionnel)</label><input type="date" value={promoForm.endDate} onChange={e=>setPromoForm(p=>({...p,endDate:e.target.value}))} style={{ width:'9rem' }} /></div>
                            <button onClick={() => createPromo(v.id)} className="btn-primary" style={{ fontSize:'0.75rem', padding:'0.375rem 0.75rem' }}>+ Créer</button>
                          </div>
                          {promoErr && <p style={{ margin:'0.25rem 0 0', color:'#ef4444', fontSize:'0.75rem' }}>{promoErr}</p>}
                        </td>
                      </tr>
                    )}
                    {editV?.id === v.id && (
                      <tr key={`edit-${v.id}`}>
                        <td colSpan={7} style={{ padding:'0.5rem 0', background:'transparent' }}>
                          <VariantForm
                            title={`Modifier — ${v.name}`}
                            initial={{
                              name:v.name, costPrice:v.costPrice, salePrice:v.salePrice, shippingCost:v.shippingCost, vatRate:v.vatRate??20,
                              barcode:v.barcode||'', supplierRef:v.supplierRef||'',
                              lowStockThreshold: v.lowStockThreshold != null ? String(v.lowStockThreshold) : '',
                              attrs:attrs.length>0?attrs:[{key:'',value:''}],
                            }}
                            attrKeys={attrKeys}
                            onSubmit={updateVariant}
                            onCancel={() => { setEditV(null); setVError(''); }}
                            error={vError}
                            loading={vLoading}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Stock Tab ── */
function StockTab() {
  const [stock,     setStock]     = useState<StockByLoc[]>([]);
  const [variants,  setVariants]  = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState({ variantId:'', locationId:'', quantity:1, mode:'add' as 'add'|'remove'|'set' });
  const [msg,  setMsg]  = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); wGet<StockByLoc[]>('/api/stocks').then(setStock).catch(()=>{}).finally(()=>setLoading(false)); };

  useEffect(() => {
    load();
    wGet<Variant[]>('/api/variants').then(setVariants).catch(()=>{});
    wGet<Location[]>('/api/locations').then(locs => {
      setLocations(locs);
      const def = locs.find(l=>l.isDefault);
      if (def) setForm(f=>({...f,locationId:def.id}));
    }).catch(()=>{});
  }, []);

  const adjust = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg('');
    const qty = form.mode === 'remove' ? -Math.abs(form.quantity) : form.quantity;
    const apiMode = form.mode === 'set' ? 'set' : 'add';
    const res = await wFetch('/api/stocks/adjust', { method:'POST', body:JSON.stringify({ variantId:form.variantId, locationId:form.locationId, quantity:qty, mode:apiMode }) });
    if (!res.ok) { const d=await res.json(); setMsg(d.error||'Erreur'); return; }
    setMsg(`✓ Stock ${form.mode === 'add' ? 'ajouté' : form.mode === 'remove' ? 'retiré' : 'défini'}`);
    load();
  };

  const modeLabel = { add:'Ajouter', remove:'Retirer', set:'Définir' };
  const modeColor = { add:'#22c55e', remove:'#ef4444', set:'#3b82f6' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card">
        <h2 style={{ margin:'0 0 1rem', fontSize:'1rem', fontWeight:700 }}>Ajustement de stock</h2>
        <form onSubmit={adjust} style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr auto auto', gap:'0.75rem', alignItems:'end' }}>
          {/* Mode selector */}
          <div>
            <label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Opération</label>
            <div style={{ display:'flex', gap:'0.25rem' }}>
              {(['add','remove','set'] as const).map(m => (
                <button key={m} type="button" onClick={() => setForm(f=>({...f,mode:m}))}
                  style={{ padding:'0.5rem 0.75rem', borderRadius:'0.375rem', border:`1px solid ${form.mode===m ? modeColor[m] : '#2a3045'}`, background:form.mode===m ? `${modeColor[m]}20` : 'none', color:form.mode===m ? modeColor[m] : '#64748b', fontSize:'0.8125rem', fontWeight:form.mode===m?600:400 }}>
                  {modeLabel[m]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Variante</label>
            <select value={form.variantId} onChange={e => setForm(f=>({...f,variantId:e.target.value}))} required>
              <option value="">— Sélectionner —</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Zone</label>
            <select value={form.locationId} onChange={e => setForm(f=>({...f,locationId:e.target.value}))} required>
              <option value="">— Sélectionner —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.isDefault?'★ ':''}{l.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'0.75rem', color:'#64748b', display:'block', marginBottom:'0.25rem' }}>Quantité</label>
            <input type="number" min={0} step={1} value={form.quantity} onChange={e => setForm(f=>({...f,quantity:Number(e.target.value)}))} required style={{ width:'6rem' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ background:modeColor[form.mode] }}>
            {modeLabel[form.mode]}
          </button>
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

/* ── Locations Tab ── */
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
                    <p style={{ margin:0, fontWeight:600, fontSize:'0.875rem' }}>{l.isDefault&&<span style={{ color:'#f59e0b', marginRight:'0.375rem' }}>★</span>}{l.name}</p>
                    {l.description&&<p style={{ margin:0, fontSize:'0.75rem', color:'#64748b' }}>{l.description}</p>}
                  </div>
                  {!l.isDefault&&<button onClick={() => setDefault(l.id)} style={{ background:'none', border:'1px solid #2a3045', borderRadius:'0.375rem', color:'#f59e0b', fontSize:'0.75rem', padding:'0.25rem 0.5rem' }}>☆ Défaut</button>}
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

/* ── Returns Tab ── */
function ReturnsTab() {
  const [variants,   setVariants]   = useState<Variant[]>([]);
  const [locations,  setLocations]  = useState<Location[]>([]);
  const [quantities, setQuantities] = useState<Record<string,number>>({});
  const [locationId, setLocationId] = useState('');
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    wGet<Variant[]>('/api/variants').then(setVariants).catch(()=>{});
    wGet<Location[]>('/api/locations').then(locs => {
      setLocations(locs);
      const def = locs.find(l=>l.isDefault);
      if (def) setLocationId(def.id);
    }).catch(()=>{});
  }, []);

  const submit = async () => {
    setMsg('');
    const items = Object.entries(quantities).filter(([,q])=>q>0).map(([variantId,quantity])=>({ variantId, quantity }));
    if (items.length===0) { setMsg('Aucun article'); return; }
    if (!locationId)      { setMsg('Sélectionnez une zone'); return; }
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
        {msg&&<p style={{ margin:'0 0 0.75rem', fontSize:'0.875rem', color:msg.startsWith('✓')?'#22c55e':'#ef4444' }}>{msg}</p>}
        <button onClick={submit} className="btn-primary" disabled={loading}>{loading?'Traitement…':'Valider les retours'}</button>
      </div>
    </div>
  );
}

/* ── Suppliers Tab ── */
function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [variants, setVariants] = useState<{ id: string; name: string; productName: string; costPrice: number; salePrice: number; shippingCost: number; vatRate: number }[]>([]);
  const [prices, setPrices] = useState<Record<string, SupplierPrice>>({});  // keyed by variantId
  const [priceInputs, setPriceInputs] = useState<Record<string, { salePrice: string; costPrice: string; shippingCost: string; vatRate: string; supplierRef: string }>>({});
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSuppliers = async () => {
    const data = await wGet<Supplier[]>('/api/suppliers');
    setSuppliers(data);
  };

  const loadVariantsAndPrices = async (sup: Supplier) => {
    const [vars, existingPrices] = await Promise.all([
      wGet<{ id: string; name: string; product: { name: string }; costPrice: number; salePrice: number; shippingCost: number; vatRate: number }[]>('/api/variants'),
      wGet<SupplierPrice[]>(`/api/supplier-prices?supplierId=${sup.id}`),
    ]);
    const flat = vars.map(v => ({ id: v.id, name: v.name, productName: v.product?.name ?? '', costPrice: v.costPrice, salePrice: v.salePrice, shippingCost: v.shippingCost, vatRate: v.vatRate }));
    setVariants(flat);
    const byVariant: Record<string, SupplierPrice> = {};
    existingPrices.forEach(p => { byVariant[p.variantId] = p; });
    setPrices(byVariant);
    const inputs: Record<string, { salePrice: string; costPrice: string; shippingCost: string; vatRate: string; supplierRef: string }> = {};
    flat.forEach(v => {
      const p = byVariant[v.id];
      inputs[v.id] = {
        salePrice: String(p ? p.salePrice : v.salePrice),
        costPrice: String(p ? p.costPrice : v.costPrice),
        shippingCost: String(p ? p.shippingCost : v.shippingCost),
        vatRate: String(p ? p.vatRate : v.vatRate),
        supplierRef: p ? (p.supplierRef ?? '') : '',
      };
    });
    setPriceInputs(inputs);
  };

  useEffect(() => { loadSuppliers(); }, []);

  const selectSupplier = (s: Supplier) => {
    setSelected(s);
    setEditId(null);
    loadVariantsAndPrices(s);
  };

  const createSupplier = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await wFetch('/api/suppliers', { method: 'POST', body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }) });
      setNewName(''); setNewDesc('');
      setMsg('✓ Fournisseur créé');
      await loadSuppliers();
    } catch { setMsg('Erreur création'); }
    setLoading(false);
  };

  const saveEdit = async (id: string) => {
    setLoading(true);
    try {
      await wFetch(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }) });
      setEditId(null);
      setMsg('✓ Mis à jour');
      await loadSuppliers();
      if (selected?.id === id) setSelected(s => s ? { ...s, name: editName.trim(), description: editDesc.trim() || null } : s);
    } catch { setMsg('Erreur mise à jour'); }
    setLoading(false);
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm('Supprimer ce fournisseur ?')) return;
    await wFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (selected?.id === id) { setSelected(null); setVariants([]); setPrices({}); }
    await loadSuppliers();
    setMsg('✓ Supprimé');
  };

  const savePrice = async (variantId: string) => {
    if (!selected) return;
    const inp = priceInputs[variantId];
    await wFetch('/api/supplier-prices', {
      method: 'POST',
      body: JSON.stringify({ variantId, supplierId: selected.id, salePrice: Number(inp.salePrice), costPrice: Number(inp.costPrice), shippingCost: Number(inp.shippingCost), vatRate: Number(inp.vatRate), supplierRef: inp.supplierRef || null }),
    });
    await loadVariantsAndPrices(selected);
    setMsg('✓ Prix enregistré');
  };

  const deletePrice = async (priceId: string) => {
    if (!selected) return;
    await wFetch(`/api/supplier-prices/${priceId}`, { method: 'DELETE' });
    await loadVariantsAndPrices(selected);
    setMsg('✓ Prix supprimé');
  };

  const inp = (style?: React.CSSProperties) => ({ style: { background: '#0f1629', border: '1px solid #2a3045', borderRadius: '0.375rem', color: '#e2e8f0', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', ...style } });

  // Group variants by product
  const byProduct: Record<string, typeof variants> = {};
  variants.forEach(v => { (byProduct[v.productName] = byProduct[v.productName] || []).push(v); });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Left: supplier list */}
      <div style={{ background: '#1a2035', borderRadius: '0.75rem', padding: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700 }}>Fournisseurs</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ borderRadius: '0.5rem', border: `1px solid ${selected?.id === s.id ? '#3b82f6' : '#2a3045'}`, background: selected?.id === s.id ? '#1e3a5f' : '#0f1629', padding: '0.5rem 0.75rem' }}>
              {editId === s.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nom" {...inp({ width: '100%', boxSizing: 'border-box' })} />
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" {...inp({ width: '100%', boxSizing: 'border-box' })} />
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button onClick={() => saveEdit(s.id)} disabled={loading} style={{ flex: 1, padding: '0.3125rem', background: '#3b82f6', border: 'none', borderRadius: '0.375rem', color: '#fff', fontSize: '0.8125rem', cursor: 'pointer' }}>✓</button>
                    <button onClick={() => setEditId(null)} style={{ flex: 1, padding: '0.3125rem', background: '#374151', border: 'none', borderRadius: '0.375rem', color: '#e2e8f0', fontSize: '0.8125rem', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => selectSupplier(s)}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.description}</div>}
                  </div>
                  <button onClick={() => { setEditId(s.id); setEditName(s.name); setEditDesc(s.description ?? ''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.875rem' }}>✏️</button>
                  <button onClick={() => deleteSupplier(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Create form */}
        <div style={{ borderTop: '1px solid #2a3045', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom du fournisseur" {...inp({ width: '100%', boxSizing: 'border-box' })} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optionnel)" {...inp({ width: '100%', boxSizing: 'border-box' })} />
          <button onClick={createSupplier} disabled={loading || !newName.trim()} className="btn-primary" style={{ fontSize: '0.8125rem' }}>+ Ajouter</button>
        </div>
        {msg && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: msg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{msg}</p>}
      </div>

      {/* Right: per-variant prices */}
      {selected ? (
        <div>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700 }}>Prix pour <span style={{ color: '#3b82f6' }}>{selected.name}</span></h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#64748b' }}>Les prix vides utilisent les prix par défaut de la variante. Enregistrez une ligne pour surcharger.</p>
          {Object.entries(byProduct).map(([productName, pvs]) => (
            <div key={productName} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8' }}>{productName}</h4>
              <div style={{ background: '#1a2035', borderRadius: '0.75rem', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#0f1629' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Variante</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Réf. fournisseur</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>Prix vente</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>Coût</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>Livraison</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>TVA %</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#64748b', fontWeight: 500 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pvs.map((v, i) => {
                      const pi = priceInputs[v.id] ?? { salePrice: String(v.salePrice), costPrice: String(v.costPrice), shippingCost: String(v.shippingCost), vatRate: String(v.vatRate), supplierRef: '' };
                      const hasOverride = !!prices[v.id];
                      return (
                        <tr key={v.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #2a3045' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {v.name}
                            {hasOverride && <span style={{ marginLeft: '0.375rem', fontSize: '0.6875rem', background: '#1e3a5f', color: '#3b82f6', borderRadius: '0.25rem', padding: '0.125rem 0.375rem' }}>personnalisé</span>}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem' }}>
                            <input type="text" value={pi.supplierRef}
                              onChange={e => setPriceInputs(prev => ({ ...prev, [v.id]: { ...prev[v.id], supplierRef: e.target.value } }))}
                              placeholder="SKU, ASIN…"
                              {...inp({ width: '8rem' })} />
                          </td>
                          {(['salePrice','costPrice','shippingCost','vatRate'] as const).map(field => (
                            <td key={field} style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>
                              <input type="number" step="0.01" min={0} value={pi[field]}
                                onChange={e => setPriceInputs(prev => ({ ...prev, [v.id]: { ...prev[v.id], [field]: e.target.value } }))}
                                {...inp({ width: '5rem', textAlign: 'right' })} />
                            </td>
                          ))}
                          <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button onClick={() => savePrice(v.id)} style={{ padding: '0.3125rem 0.625rem', background: '#3b82f6', border: 'none', borderRadius: '0.375rem', color: '#fff', fontSize: '0.8125rem', cursor: 'pointer', marginRight: '0.25rem' }}>✓</button>
                            {hasOverride && <button onClick={() => deletePrice(prices[v.id].id)} style={{ padding: '0.3125rem 0.625rem', background: '#7f1d1d', border: 'none', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.8125rem', cursor: 'pointer' }}>✕</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748b', fontSize: '0.875rem' }}>
          Sélectionnez un fournisseur pour gérer ses prix
        </div>
      )}
    </div>
  );
}
