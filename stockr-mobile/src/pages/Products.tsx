import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Product } from '../api';
import PullToRefresh from '../components/PullToRefresh';
import ConfirmModal from '../components/ConfirmModal';

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = useCallback(async () => {
    const prods = await api.products.list();
    setProducts(prods);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      await api.products.create({ name: newName, description: newDesc });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      await load();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.products.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch { /* ignore */ }
  };

  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => navigate('/manage')} style={{ background: 'none', border: 'none', color: '#2b8cee', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>‹</button>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>📦 Produits</h1>
            </div>
            <button className="btn-ghost" onClick={() => setShowCreate(true)} style={{ padding: '0.375rem 0.75rem' }}>+ Nouveau</button>
          </div>

          {products.map(p => (
            <div key={p.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/manage/products/${p.id}`)}>
                <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0' }}>{p.name}</p>
                {p.description && <p style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>{p.description}</p>}
                <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  {p._count?.variants ?? 0} variante{(p._count?.variants ?? 0) > 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.75rem' }}>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => navigate(`/manage/products/${p.id}`)}>
                  Voir
                </button>
                <button className="btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setDeleteTarget(p)}>
                  ✕
                </button>
              </div>
            </div>
          ))}

          {products.length === 0 && !loading && (
            <p className="text-text-muted text-sm text-center" style={{ marginTop: '2rem' }}>Aucun produit. Créez-en un !</p>
          )}
        </div>
      </PullToRefresh>

      {/* Create bottom sheet */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>Nouveau produit</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Nom du produit *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: T-shirt" required />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Description (optionnel)</label>
                <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description courte…" />
              </div>
              {createError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{createError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={createLoading}>
                  {createLoading ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Supprimer "${deleteTarget.name}" et toutes ses variantes ?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </>
  );
}
