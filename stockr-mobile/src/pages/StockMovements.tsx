import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type StockMovement, type Location } from '../api';
import PullToRefresh from '../components/PullToRefresh';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  adjust:       { label: 'Ajustement',   color: '#2b8cee' },
  transfer_in:  { label: 'Transfert +',  color: '#22c55e' },
  transfer_out: { label: 'Transfert −',  color: '#f59e0b' },
  sale:         { label: 'Vente',        color: '#ef4444' },
  return:       { label: 'Retour',       color: '#a78bfa' },
  import:       { label: 'Import',       color: '#22c55e' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function StockMovements() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const [data, locs] = await Promise.all([
        api.stockMovements.list({
          locationId: filterLocation || undefined,
          type: filterType || undefined,
          page: p,
        }),
        locations.length === 0 ? api.locations.list() : Promise.resolve(locations),
      ]);
      setMovements(data.movements);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
      if (locations.length === 0) setLocations(locs as Location[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [filterLocation, filterType]);

  useEffect(() => { load(1); }, [filterLocation, filterType]);

  return (
    <PullToRefresh onRefresh={() => load(page)}>
      <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <button onClick={() => navigate('/manage')} style={{ background: 'none', border: 'none', color: '#2b8cee', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>‹</button>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>🔄 Mouvements de stock</h1>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ flex: 1 }}>
            <option value="">Toutes les zones</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ flex: 1 }}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>{total} mouvement{total !== 1 ? 's' : ''}</p>

        {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
        {loading && <p style={{ color: '#475569', fontSize: '0.875rem' }}>Chargement…</p>}

        {movements.map(m => {
          const type = TYPE_LABELS[m.type] || { label: m.type, color: '#94a3b8' };
          const isPositive = m.delta > 0;
          return (
            <div key={m.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.variant.name}
                  </p>
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    {m.variant.product.name} · {m.location.name}
                  </p>
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: '#475569' }}>{fmtDate(m.createdAt)}</p>
                  {m.notes && <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>{m.notes}</p>}
                </div>
                <div style={{ textAlign: 'right', marginLeft: '0.75rem' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', color: isPositive ? '#22c55e' : '#ef4444' }}>
                    {isPositive ? '+' : ''}{m.delta}
                  </p>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: type.color, background: `${type.color}1a`, borderRadius: '9999px', padding: '0.1rem 0.5rem' }}>
                    {type.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {movements.length === 0 && !loading && (
          <p style={{ color: '#475569', fontSize: '0.875rem', textAlign: 'center', marginTop: '2rem' }}>Aucun mouvement.</p>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1}
              style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.5rem', color: page <= 1 ? '#475569' : '#e2e8f0', padding: '0.375rem 0.75rem', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.875rem' }}
            >‹ Préc.</button>
            <span style={{ fontSize: '0.8125rem', color: '#94a3b8', alignSelf: 'center' }}>{page} / {pages}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= pages}
              style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.5rem', color: page >= pages ? '#475569' : '#e2e8f0', padding: '0.375rem 0.75rem', cursor: page >= pages ? 'default' : 'pointer', fontSize: '0.875rem' }}
            >Suiv. ›</button>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
