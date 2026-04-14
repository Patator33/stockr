import { useNavigate } from 'react-router-dom';

export default function Manage() {
  const navigate = useNavigate();
  const items = [
    { icon: '📦', label: 'Produits', sub: 'Gérer vos produits et variantes', path: '/manage/products' },
    { icon: '🏭', label: 'Zones de stockage', sub: 'Entrepôts, étagères, boutiques…', path: '/manage/locations' },
    { icon: '↩', label: 'Retours de stock', sub: 'Remettre des articles en stock', path: '/manage/stock-returns' },
    { icon: '🔄', label: 'Mouvements de stock', sub: 'Historique de tous les mouvements', path: '/manage/stock-movements' },
    { icon: '🏪', label: 'Fournisseurs', sub: 'Marketplaces et prix par fournisseur', path: '/manage/suppliers' },
    { icon: '📊', label: 'Statistiques', sub: 'CA, marges, top variantes', path: '/stats' },
  ];

  return (
    <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: '0 0 1.5rem' }}>⚙️ Gestion</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: '#141824',
              border: '1px solid #2a3045',
              borderRadius: '0.75rem',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
            onTouchStart={e => (e.currentTarget.style.opacity = '0.75')}
            onTouchEnd={e => (e.currentTarget.style.opacity = '1')}
          >
            <span style={{ fontSize: '2rem' }}>{item.icon}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#e2e8f0', fontSize: '1rem' }}>{item.label}</p>
              <p style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: '#64748b' }}>{item.sub}</p>
            </div>
            <span style={{ marginLeft: 'auto', color: '#2b8cee', fontSize: '1.25rem' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
