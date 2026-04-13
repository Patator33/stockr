'use client';
import { useEffect, useState } from 'react';
import { wGet } from '../_api';

interface Stats { period: number; totalRevenue: number; totalCost: number; totalShipping: number; grossMargin: number; netMargin: number; totalVat: number; totalSoldQty: number; totalReturnedQty: number; totalStock: number; topVariants: { name: string; productName: string; sold: number; returned: number; revenue: number; margin: number }[]; }
interface Product { id: string; name: string; }

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: '9rem' }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: color || '#e2e8f0' }}>{value}</p>
      {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>{sub}</p>}
    </div>
  );
}

export default function StatsPage() {
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [period,    setPeriod]    = useState('30');
  const [productId, setProductId] = useState('');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    wGet<Product[]>('/api/products').then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ period });
    if (productId) q.set('productId', productId);
    wGet<Stats>(`/api/stats?${q}`).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [period, productId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Statistiques</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto' }}>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
            <option value="365">1 an</option>
          </select>
          <select value={productId} onChange={e => setProductId(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Tous les produits</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <p style={{ color: '#475569' }}>Chargement…</p>}

      {stats && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <Card label="CA"          value={`${stats.totalRevenue.toFixed(2)} €`} color="#3b82f6" />
            <Card label="Coût"        value={`${stats.totalCost.toFixed(2)} €`}    color="#f59e0b" />
            <Card label="Marge brute" value={`${stats.grossMargin.toFixed(2)} €`}  color={stats.grossMargin >= 0 ? '#22c55e' : '#ef4444'}
              sub={stats.totalRevenue > 0 ? `${((stats.grossMargin / stats.totalRevenue) * 100).toFixed(1)}%` : undefined} />
            <Card label="Marge nette" value={`${stats.netMargin.toFixed(2)} €`}    color={stats.netMargin >= 0 ? '#22c55e' : '#ef4444'}
              sub={`Port: ${stats.totalShipping.toFixed(2)} €`} />
            <Card label="TVA collectée" value={`${(stats.totalVat ?? 0).toFixed(2)} €`} color="#a78bfa"
              sub={stats.totalRevenue > 0 ? `${(((stats.totalVat ?? 0) / stats.totalRevenue) * 100).toFixed(1)}%` : undefined} />
            <Card label="Vendus"      value={String(stats.totalSoldQty)}            sub={`${stats.totalReturnedQty} retours`} />
            <Card label="Stock"       value={String(stats.totalStock)} />
          </div>

          <div className="card">
            <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Top variantes ({period}j)</h2>
            {stats.topVariants.length === 0
              ? <p style={{ color: '#475569', fontSize: '0.875rem' }}>Aucune vente sur cette période.</p>
              : (
                <table>
                  <thead><tr><th>#</th><th>Produit</th><th>Variante</th><th>Vendus</th><th>Retours</th><th>CA</th><th>Marge</th></tr></thead>
                  <tbody>
                    {stats.topVariants.map((v, i) => (
                      <tr key={i}>
                        <td style={{ color: '#475569', fontSize: '0.75rem' }}>{i + 1}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{v.productName}</td>
                        <td style={{ fontWeight: 600 }}>{v.name}</td>
                        <td>{v.sold}</td>
                        <td style={{ color: v.returned > 0 ? '#ef4444' : '#64748b' }}>{v.returned}</td>
                        <td style={{ color: '#3b82f6' }}>{v.revenue.toFixed(2)} €</td>
                        <td style={{ color: v.margin >= 0 ? '#22c55e' : '#ef4444' }}>{v.margin.toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}
    </div>
  );
}
