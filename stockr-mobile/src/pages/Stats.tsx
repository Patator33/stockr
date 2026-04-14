import { useState, useEffect, useCallback } from 'react';
import { api, type Stats as StatsData, type Product, type Supplier, type DailyRevenue } from '../api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import PullToRefresh from '../components/PullToRefresh';

const PERIODS = [
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '3 mois', value: 90 },
  { label: '1 an', value: 365 },
];

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function Stats() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [period, setPeriod] = useState(30);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [prods, sups, st] = await Promise.all([
        api.products.list(),
        api.suppliers.list(),
        api.stats.get(productId || undefined, period, supplierId || undefined),
      ]);
      setProducts(prods);
      setSuppliers(sups);
      setStats(st);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [productId, supplierId, period]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const marginPct = stats && stats.totalRevenue > 0
    ? ((stats.netMargin / stats.totalRevenue) * 100).toFixed(1)
    : '0.0';

  return (
    <PullToRefresh onRefresh={load}>
      <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: '0 0 1rem' }}>📊 Statistiques</h1>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <select value={period} onChange={e => setPeriod(Number(e.target.value))} style={{ flex: 1, minWidth: '8rem' }}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={productId} onChange={e => setProductId(e.target.value)} style={{ flex: 1, minWidth: '8rem' }}>
            <option value="">Tous les produits</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ flex: 1, minWidth: '8rem' }}>
            <option value="">Tous les fournisseurs</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}

        {stats && (
          <>
            {/* KPIs grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <StatCard label="Chiffre d'affaires" value={fmt(stats.totalRevenue)} color="#22c55e" />
              <StatCard label="Coûts production" value={fmt(stats.totalCost)} color="#f59e0b" />
              <StatCard label="Coûts expédition" value={fmt(stats.totalShipping)} color="#f59e0b" />
              <StatCard label="Marge brute" value={fmt(stats.grossMargin)} color={stats.grossMargin >= 0 ? '#22c55e' : '#ef4444'} />
              <StatCard label="Marge nette" value={fmt(stats.netMargin)} color={stats.netMargin >= 0 ? '#22c55e' : '#ef4444'} />
              <StatCard label="% Marge nette" value={`${marginPct}%`} color={Number(marginPct) >= 0 ? '#2b8cee' : '#ef4444'} />
              <StatCard label="TVA collectée" value={fmt(stats.totalVat ?? 0)} color="#a78bfa" />
              <StatCard label="Unités vendues" value={String(stats.totalSoldQty)} color="#e2e8f0" />
              <StatCard label="Retours" value={String(stats.totalReturnedQty)} color={stats.totalReturnedQty > 0 ? '#f59e0b' : '#e2e8f0'} />
              <StatCard label="Stock total" value={String(stats.totalStock)} color="#2b8cee" />
            </div>

            {/* Daily revenue bar chart */}
            {stats.dailyRevenue && stats.dailyRevenue.length > 0 && (() => {
              const daily = stats.dailyRevenue!;
              const maxRev = Math.max(...daily.map(d => d.revenue), 0.01);
              const barCount = Math.min(daily.length, period <= 7 ? 7 : period <= 30 ? 30 : 14);
              const shown = daily.slice(-barCount);
              const barW = Math.floor(300 / barCount);
              const svgW = barW * barCount;
              return (
                <div style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', padding: '0.75rem', marginBottom: '1.25rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#94a3b8' }}>CA par jour</p>
                  <div style={{ overflowX: 'auto' }}>
                    <svg width={svgW} height={80} style={{ display: 'block', minWidth: '100%' }}>
                      {shown.map((d, i) => {
                        const h = maxRev > 0 ? Math.round((d.revenue / maxRev) * 60) : 0;
                        const x = i * barW + 2;
                        const y = 70 - h;
                        return (
                          <g key={d.date}>
                            <rect x={x} y={y} width={barW - 4} height={h || 2} rx={2} fill={h > 0 ? '#2b8cee' : '#1e2535'} />
                            {barCount <= 14 && (
                              <text x={x + (barW - 4) / 2} y={78} textAnchor="middle" fontSize={8} fill="#475569">
                                {new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              );
            })()}

            {/* Top variants */}
            {stats.topVariants.length > 0 && (
              <div style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #2a3045' }}>
                  <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#e2e8f0' }}>🏆 Top variantes</h2>
                </div>
                {stats.topVariants.map((v, i) => (
                  <div key={i} style={{ padding: '0.75rem 1rem', borderBottom: i < stats.topVariants.length - 1 ? '1px solid #1e2535' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, color: '#e2e8f0', fontSize: '0.875rem' }}>{v.name}</p>
                        <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>{v.productName}</p>
                        <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                          Vendus: {v.sold} {v.returned > 0 ? `· Retours: ${v.returned}` : ''}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 700, color: '#22c55e', fontSize: '0.9375rem' }}>{fmt(v.revenue)}</p>
                        <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: v.margin >= 0 ? '#22c55e' : '#ef4444' }}>
                          Marge: {fmt(v.margin)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stats.topVariants.length === 0 && (
              <p className="text-text-muted text-sm text-center" style={{ marginTop: '2rem' }}>
                Aucune vente sur cette période.
              </p>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border" style={{ padding: '0.75rem' }}>
      <p className="text-text-muted text-xs uppercase tracking-wide" style={{ margin: '0 0 0.25rem' }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.125rem', color }}>{value}</p>
    </div>
  );
}
