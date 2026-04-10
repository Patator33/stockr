import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Location } from '../api';
import PullToRefresh from '../components/PullToRefresh';
import ConfirmModal from '../components/ConfirmModal';

export default function Locations() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  // Create / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [mName, setMName] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mLoading, setMLoading] = useState(false);
  const [mError, setMError] = useState('');

  const load = useCallback(async () => {
    const locs = await api.locations.list();
    setLocations(locs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditTarget(null); setMName(''); setMDesc(''); setMError(''); setShowModal(true); };
  const openEdit = (loc: Location) => { setEditTarget(loc); setMName(loc.name); setMDesc(loc.description || ''); setMError(''); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMError('');
    setMLoading(true);
    try {
      if (editTarget) {
        await api.locations.update(editTarget.id, { name: mName, description: mDesc });
      } else {
        await api.locations.create({ name: mName, description: mDesc });
      }
      setShowModal(false);
      await load();
    } catch (err: unknown) {
      setMError(err instanceof Error ? err.message : 'Erreur');
    } finally { setMLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await api.locations.delete(deleteTarget.id); setDeleteTarget(null); await load(); } catch { /* ignore */ }
  };

  return (
    <>
      <PullToRefresh onRefresh={load}>
        <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => navigate('/manage')} style={{ background: 'none', border: 'none', color: '#2b8cee', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>‹</button>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>🏭 Zones de stockage</h1>
            </div>
            <button className="btn-ghost" onClick={openCreate} style={{ padding: '0.375rem 0.75rem' }}>+ Nouvelle</button>
          </div>

          {locations.map(loc => (
            <div key={loc.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0' }}>{loc.name}</p>
                {loc.description && <p style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>{loc.description}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.75rem' }}>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => openEdit(loc)}>✏️</button>
                <button className="btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }} onClick={() => setDeleteTarget(loc)}>✕</button>
              </div>
            </div>
          ))}

          {locations.length === 0 && !loading && (
            <div style={{ background: 'rgba(43,140,238,0.06)', border: '1px solid rgba(43,140,238,0.2)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center' }}>
              <p className="text-text-secondary text-sm" style={{ margin: 0 }}>
                Aucune zone de stockage. Créez-en une (ex: Entrepôt A, Boutique Paris…).
              </p>
            </div>
          )}
        </div>
      </PullToRefresh>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#1e2535', borderRadius: '20px 20px 0 0', padding: '1.5rem', paddingBottom: 'calc(1.5rem + 72px)', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '2rem', height: '4px', background: '#2a3045', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem' }}>
              {editTarget ? 'Modifier la zone' : 'Nouvelle zone de stockage'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Nom *</label>
                <input type="text" value={mName} onChange={e => setMName(e.target.value)} placeholder="Ex: Entrepôt A" required />
              </div>
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Description (optionnel)</label>
                <input type="text" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Adresse ou remarque…" />
              </div>
              {mError && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{mError}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={mLoading}>
                  {mLoading ? 'Sauvegarde…' : editTarget ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Supprimer la zone "${deleteTarget.name}" ?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </>
  );
}
