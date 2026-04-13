'use client';
import { useEffect, useState } from 'react';
import { wGet } from '../_api';

interface Movement {
  id: string;
  type: string;
  delta: number;
  userId?: string | null;
  ref?: string | null;
  notes?: string | null;
  createdAt: string;
  variant: { name: string; product: { name: string } };
  location: { name: string };
}
interface MovementsPage { movements: Movement[]; total: number; pages: number; }
interface Variant { id: string; name: string; }

const TYPE_LABELS: Record<string, string> = {
  adjust:       'Ajustement',
  transfer_in:  'Transfert entrant',
  transfer_out: 'Transfert sortant',
  sale:         'Vente',
  return:       'Retour',
  import:       'Import CSV',
};
const TYPE_COLORS: Record<string, string> = {
  adjust:       '#3b82f6',
  transfer_in:  '#22c55e',
  transfer_out: '#f59e0b',
  sale:         '#ef4444',
  return:       '#a78bfa',
  import:       '#06b6d4',
};

export default function StockMovementsPage() {
  const [data,     setData]     = useState<MovementsPage>({ movements: [], total: 0, pages: 1 });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [filterVariant, setFilterVariant] = useState('');
  const [filterType,    setFilterType]    = useState('');

  const load = (p = 1, variantId = filterVariant, type = filterType) => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(p) });
    if (variantId) q.set('variantId', variantId);
    if (type)      q.set('type', type);
    wGet<MovementsPage>(`/api/stock-movements?${q}`)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    wGet<Variant[]>('/api/variants').then(setVariants).catch(() => {});
  }, []);

  const applyFilter = () => { setPage(1); load(1, filterVariant, filterType); };
  const goPage = (p: number) => { setPage(p); load(p); };

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Mouvements de stock</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Variante</label>
          <select value={filterVariant} onChange={e => setFilterVariant(e.target.value)} style={{ width: 'auto', minWidth: '14rem' }}>
            <option value="">Toutes</option>
            {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Tous</option>
            {Object.keys(TYPE_LABELS).map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <button onClick={applyFilter} className="btn-primary" style={{ fontSize: '0.8125rem' }}>Filtrer</button>
        {(filterVariant || filterType) && (
          <button onClick={() => { setFilterVariant(''); setFilterType(''); setPage(1); load(1, '', ''); }} className="btn-ghost" style={{ fontSize: '0.8125rem' }}>✕ Réinitialiser</button>
        )}
      </div>

      <div className="card">
        {loading ? <p style={{ color: '#475569' }}>Chargement…</p> : (
          <>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{data.total} mouvement{data.total !== 1 ? 's' : ''}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Produit · Variante</th>
                  <th>Zone</th>
                  <th>Delta</th>
                  <th>Notes</th>
                  <th>Réf.</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(m.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: TYPE_COLORS[m.type] || '#94a3b8', background: `${TYPE_COLORS[m.type] || '#94a3b8'}18`, border: `1px solid ${TYPE_COLORS[m.type] || '#94a3b8'}40`, borderRadius: '0.25rem', padding: '0.1rem 0.4rem' }}>
                        {TYPE_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      <span style={{ color: '#94a3b8' }}>{m.variant.product.name}</span>
                      {' · '}
                      <span style={{ fontWeight: 600 }}>{m.variant.name}</span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>{m.location.name}</td>
                    <td style={{ fontWeight: 700, color: m.delta > 0 ? '#22c55e' : '#ef4444' }}>
                      {m.delta > 0 ? '+' : ''}{m.delta}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.notes || '—'}</td>
                    <td style={{ fontSize: '0.7rem', color: '#475569' }}>{m.ref ? m.ref.slice(0, 8) : '—'}</td>
                  </tr>
                ))}
                {data.movements.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#475569' }}>Aucun mouvement</td></tr>
                )}
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
