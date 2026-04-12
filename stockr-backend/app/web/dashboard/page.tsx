'use client';
import { useEffect, useState } from 'react';

interface Order { id: string; status: string; customerName?: string | null; customerEmail?: string | null; shippingDate?: string | null; items: { quantity: number }[]; createdAt: string; }
interface Stats { totalRevenue: number; netMargin: number; totalSoldQty: number; totalReturnedQty: number; totalStock: number; }

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: '10rem' }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: color || '#e2e8f0' }}>{value}</p>
      {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>{sub}</p>}
    </div>
  );
}

function statusLabel(s: string) {
  if (s === 'pending') return { text: 'En attente', cls: 'badge-pending' };
  if (s === 'prepared') return { text: 'Préparée', cls: 'badge-prepared' };
  if (s === 'shipped') return { text: 'Expédiée', cls: 'badge-shipped' };
  return { text: s, cls: 'badge-confirmed' };
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/stats?period=30').then(r => r.json()),
    ]).then(([o, s]) => {
      setOrders(Array.isArray(o) ? o : []);
      setStats(s);
    }).finally(() => setLoading(false));
  }, []);

  const active = orders.filter(o => o.status === 'pending' || o.status === 'prepared');
  const shippingToday = orders.filter(o => {
    if (o.status === 'shipped' || !o.shippingDate) return false;
    return new Date(o.shippingDate).toDateString() === new Date().toDateString();
  });

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Dashboard</h1>

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Chiffre d'affaires (30j)" value={`${stats.totalRevenue.toFixed(2)} €`} color="#3b82f6" />
          <StatCard label="Marge nette (30j)" value={`${stats.netMargin.toFixed(2)} €`} color={stats.netMargin >= 0 ? '#22c55e' : '#ef4444'} />
          <StatCard label="Ventes (30j)" value={String(stats.totalSoldQty)} sub={`${stats.totalReturnedQty} retours`} />
          <StatCard label="Stock total" value={String(stats.totalStock)} />
        </div>
      )}

      {/* Shipping today alert */}
      {shippingToday.length > 0 && (
        <div style={{ background: '#1c1507', border: '1px solid #92400e', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#f59e0b' }}>⚠️ {shippingToday.length} commande{shippingToday.length > 1 ? 's' : ''} à expédier aujourd'hui</p>
          {shippingToday.map(o => (
            <a key={o.id} href="/web/orders" style={{ display: 'block', fontSize: '0.875rem', color: '#fbbf24', textDecoration: 'none' }}>
              → {o.customerName || o.customerEmail || o.id.slice(0, 8)}
            </a>
          ))}
        </div>
      )}

      {/* Active orders */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            Commandes actives <span style={{ color: '#64748b', fontWeight: 400, fontSize: '0.875rem' }}>({active.length})</span>
          </h2>
          <a href="/web/orders" className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', textDecoration: 'none' }}>Voir tout →</a>
        </div>
        {loading && <p style={{ color: '#475569', fontSize: '0.875rem' }}>Chargement…</p>}
        {!loading && active.length === 0 && <p style={{ color: '#475569', fontSize: '0.875rem' }}>Aucune commande active.</p>}
        {active.slice(0, 8).map(o => {
          const sl = statusLabel(o.status);
          const total = o.items.reduce((s, i) => s + i.quantity, 0);
          return (
            <a key={o.id} href="/web/orders" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #1e2535', textDecoration: 'none' }}>
              <span className={`badge ${sl.cls}`}>{sl.text}</span>
              <span style={{ flex: 1, color: '#e2e8f0', fontSize: '0.875rem' }}>{o.customerName || o.customerEmail || 'Client'}</span>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{total} art.</span>
              {o.shippingDate && (
                <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>📅 {new Date(o.shippingDate).toLocaleDateString('fr-FR')}</span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
