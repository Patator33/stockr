'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthCtx { userId: string; email: string; role: string }
export const AuthContext = createContext<AuthCtx | null>(null);
export function useAuth() { return useContext(AuthContext); }

const NAV = [
  { href: '/web/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/web/orders', label: 'Commandes', icon: '📦' },
  { href: '/web/sales', label: 'Ventes', icon: '💰' },
  { href: '/web/stats', label: 'Stats', icon: '📊' },
  { href: '/web/manage', label: 'Gestion', icon: '🗃️' },
  { href: '/web/settings', label: 'Réglages', icon: '⚙️' },
];

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #0a0e1a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
  input, select, textarea {
    background: #0f1629; border: 1px solid #2a3045; border-radius: 0.5rem;
    color: #e2e8f0; padding: 0.625rem 0.75rem; font-size: 0.875rem; width: 100%; outline: none;
  }
  input:focus, select:focus, textarea:focus { border-color: #3b82f6; }
  button { cursor: pointer; font-family: inherit; }
  .btn-primary { background: #3b82f6; color: white; border: none; border-radius: 0.5rem; padding: 0.625rem 1rem; font-size: 0.875rem; font-weight: 600; }
  .btn-primary:hover { background: #2563eb; }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .btn-ghost { background: none; border: 1px solid #2a3045; border-radius: 0.5rem; color: #94a3b8; padding: 0.5rem 0.875rem; font-size: 0.875rem; }
  .btn-ghost:hover { border-color: #3b82f6; color: #e2e8f0; }
  .btn-ghost:disabled { opacity: 0.5; cursor: default; }
  .btn-danger { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; border-radius: 0.5rem; padding: 0.5rem 0.875rem; font-size: 0.875rem; }
  .btn-danger:hover { background: #991b1b; }
  .card { background: #141824; border: 1px solid #2a3045; border-radius: 0.75rem; padding: 1rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.5rem 0.75rem; border-bottom: 1px solid #2a3045; }
  td { padding: 0.625rem 0.75rem; border-bottom: 1px solid #1e2535; color: #e2e8f0; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #1a2035; }
  .badge { display: inline-flex; align-items: center; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
  .badge-pending { background: #1e3a5f; color: #93c5fd; }
  .badge-prepared { background: #312e81; color: #a5b4fc; }
  .badge-shipped { background: #14532d; color: #86efac; }
  .badge-confirmed { background: #1c1917; color: #a8a29e; }
  a { color: inherit; text-decoration: none; }
`;

export default function WebLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthCtx | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname === '/web/login') { setLoading(false); return; }
    fetch('/api/auth/me').then(r => {
      if (!r.ok) { router.replace('/web/login'); return null; }
      return r.json();
    }).then(data => {
      if (data) setAuth({ userId: data.id, email: data.email, role: data.role || 'user' });
    }).catch(() => router.replace('/web/login')).finally(() => setLoading(false));
  }, [pathname]);

  if (pathname === '/web/login') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#475569' }}>Chargement…</p>
        </div>
      </>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{ width: '13rem', background: '#0d1117', borderRight: '1px solid #2a3045', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10 }}>
          <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #2a3045' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '1.125rem', color: '#3b82f6' }}>📦 Stockr</p>
            {auth && <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{auth.email}</p>}
          </div>
          <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {NAV.map(n => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/');
              return (
                <a
                  key={n.href}
                  href={n.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                    fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                    color: active ? '#e2e8f0' : '#64748b',
                    background: active ? '#1a2035' : 'transparent',
                  }}
                >
                  <span>{n.icon}</span><span>{n.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, marginLeft: '13rem', padding: '1.5rem', minHeight: '100vh', maxWidth: 'calc(100vw - 13rem)', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
