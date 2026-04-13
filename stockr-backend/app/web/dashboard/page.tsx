'use client';
import { useEffect, useState } from 'react';
import { wGet } from '../_api';

interface Order { id: string; status: string; customerName?: string | null; customerEmail?: string | null; shippingDate?: string | null; items: { quantity: number }[]; createdAt: string; }
interface LowStockAlert { variantId: string; variantName: string; productName: string; totalQty: number; threshold: number; }
interface Stats { totalRevenue: number; totalCost: number; grossMargin: number; netMargin: number; totalVat: number; totalSoldQty: number; totalReturnedQty: number; totalStock: number; lowStockAlerts: LowStockAlert[]; overdueOrders: number; }

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: '10rem' }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: color || '#e2e8f0' }}>{value}</p>
      {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>{sub}</p>}
    </div>
  );
}

function statusBadge(s: string) {
  if (s === 'pending')  return { text: 'En attente', cls: 'badge-pending' };
  if (s === 'prepared') return { text: 'Préparée',   cls: 'badge-prepared' };
  if (s === 'shipped')  return { text: 'Expédiée',   cls: 'badge-shipped' };
  return { text: s, cls: 'badge-confirmed' };
}

export default function DashboardPage() {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      wGet<Order[]>('/api/orders'),
      wGet<Stats>('/api/stats?period=30'),
    ]).then(([o, s]) => { setOrders(o); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = orders.filter(o => o.status === 'pending' || o.status === 'prepared');
  const shippingToday = orders.filter(o => {
    if (o.status === 'shipped' || !o.shippingDate) return false;
    return new Date(o.shippingDate).toDateString() === new Date().toDateString();
  });

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Dashboard</h1>

      {/* KPI cards */}
      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="CA 30j"       value={`${stats.totalRevenue.toFixed(2)} €`}  color="#3b82f6" />
          <StatCard label="Marge brute"  value={`${stats.grossMargin.toFixed(2)} €`}   color={stats.grossMargin >= 0 ? '#22c55e' : '#ef4444'}
            sub={stats.totalRevenue > 0 ? `${((stats.grossMargin / stats.totalRevenue) * 100).toFixed(1)} %` : undefined} />
          <StatCard label="Marge nette"  value={`${stats.netMargin.toFixed(2)} €`}     color={stats.netMargin >= 0 ? '#22c55e' : '#ef4444'} />
          <StatCard label="TVA collectée" value={`${(stats.totalVat ?? 0).toFixed(2)} €`} color="#a78bfa" />
          <StatCard label="Ventes 30j"   value={String(stats.totalSoldQty)}            sub={`${stats.totalReturnedQty} retours`} />
          <StatCard label="Stock total"  value={String(stats.totalStock)} />
        </div>
      )}

      {/* Shipping today alert */}
      {shippingToday.length > 0 && (
        <div style={{ background: '#1c1507', border: '1px solid #92400e', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#f59e0b' }}>⚠️ {shippingToday.length} commande{shippingToday.length > 1 ? 's' : ''} à expédier aujourd'hui</p>
          {shippingToday.map(o => (
            <a key={o.id} href="/web/orders" style={{ display: 'block', fontSize: '0.875rem', color: '#fbbf24' }}>
              → {o.customerName || o.customerEmail || o.id.slice(0, 8)}
            </a>
          ))}
        </div>
      )}

      {/* Overdue orders alert */}
      {stats && stats.overdueOrders > 0 && (
        <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#ef4444' }}>
            🔴 {stats.overdueOrders} commande{stats.overdueOrders > 1 ? 's' : ''} en attente depuis plus de 7 jours
            {' '}— <a href="/web/orders" style={{ color: '#f87171' }}>Voir les commandes →</a>
          </p>
        </div>
      )}

      {/* Low stock alerts */}
      {stats && stats.lowStockAlerts.length > 0 && (
        <div style={{ background: '#0d1205', border: '1px solid #3f6212', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#84cc16' }}>📦 Stock faible ({stats.lowStockAlerts.length} variante{stats.lowStockAlerts.length > 1 ? 's' : ''})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {stats.lowStockAlerts.map(a => (
              <span key={a.variantId} style={{ fontSize: '0.75rem', background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.3)', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', color: '#a3e635' }}>
                {a.productName} · {a.variantName} — {a.totalQty}/{a.threshold}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Active orders */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            Commandes actives <span style={{ color: '#64748b', fontWeight: 400, fontSize: '0.875rem' }}>({active.length})</span>
          </h2>
          <a href="/web/orders" className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>Voir tout →</a>
        </div>
        {loading && <p style={{ color: '#475569', fontSize: '0.875rem' }}>Chargement…</p>}
        {!loading && active.length === 0 && <p style={{ color: '#475569', fontSize: '0.875rem' }}>Aucune commande active.</p>}
        {active.slice(0, 8).map(o => {
          const sl = statusBadge(o.status);
          const total = o.items.reduce((s, i) => s + i.quantity, 0);
          const createdAt = new Date(o.createdAt);
          const ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
          return (
            <a key={o.id} href="/web/orders" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #1e2535' }}>
              <span className={`badge ${sl.cls}`}>{sl.text}</span>
              <span style={{ flex: 1, color: '#e2e8f0', fontSize: '0.875rem' }}>{o.customerName || o.customerEmail || 'Client'}</span>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{total} art.</span>
              {ageDays >= 7 && <span style={{ color: '#ef4444', fontSize: '0.7rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.25rem', padding: '0.1rem 0.375rem' }}>J+{ageDays}</span>}
              {o.shippingDate && <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>📅 {new Date(o.shippingDate).toLocaleDateString('fr-FR')}</span>}
            </a>
          );
        })}
      </div>
    </div>
  );
}
