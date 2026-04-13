'use client';
import './web.css';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext, type AuthCtx } from './_auth';
import { wFetch } from './_api';

const NAV = [
  { href: '/web/dashboard',       label: 'Dashboard',    icon: '🏠' },
  { href: '/web/orders',          label: 'Commandes',    icon: '📦' },
  { href: '/web/sales',           label: 'Ventes',       icon: '💰' },
  { href: '/web/stats',           label: 'Stats',        icon: '📊' },
  { href: '/web/manage',          label: 'Gestion',      icon: '🗃️' },
  { href: '/web/stock-movements', label: 'Mouvements',   icon: '🔄' },
  { href: '/web/settings',        label: 'Réglages',     icon: '⚙️' },
];

export default function WebLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [auth, setAuth]       = useState<AuthCtx | null>(null);
  const [loading, setLoading] = useState(true);

  const isLogin = pathname === '/web/login';

  useEffect(() => {
    if (isLogin) { setLoading(false); return; }
    wFetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.replace('/web/login'); return; }
        setAuth({ userId: data.id, email: data.email, role: data.role || 'user' });
      })
      .catch(() => router.replace('/web/login'))
      .finally(() => setLoading(false));
  }, [pathname]);

  if (isLogin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#475569' }}>Chargement…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <aside style={{
          width: '13rem', background: '#0d1117', borderRight: '1px solid #2a3045',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #2a3045' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '1.125rem', color: '#3b82f6' }}>📦 Stockr</p>
            {auth && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {auth.email}
              </p>
            )}
          </div>
          <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {NAV.map(n => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/');
              return (
                <a key={n.href} href={n.href} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                  fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                  color: active ? '#e2e8f0' : '#64748b',
                  background: active ? '#1a2035' : 'transparent',
                }}>
                  <span>{n.icon}</span><span>{n.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>
        <main style={{ flex: 1, marginLeft: '13rem', padding: '1.5rem', minHeight: '100vh', maxWidth: 'calc(100vw - 13rem)', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
