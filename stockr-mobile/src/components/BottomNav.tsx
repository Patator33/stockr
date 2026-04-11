import { NavLink } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';

const tabs = [
  { to: '/', label: 'Stocks', icon: '📦' },
  { to: '/orders', label: 'Commandes', icon: '📋' },
  { to: '/sales', label: 'Ventes', icon: '💰' },
  { to: '/manage', label: 'Gestion', icon: '⚙️' },
  { to: '/settings', label: 'Réglages', icon: '🔧' },
];

export default function BottomNav() {
  const { pendingCount } = useOrders();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border safe-bottom z-50">
      <div className="flex">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 text-xs transition-colors ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`
            }
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span className="text-xl mb-0.5">{tab.icon}</span>
              {tab.to === '/orders' && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -8,
                  background: '#ef4444', color: '#fff',
                  borderRadius: '9999px', fontSize: '0.625rem',
                  fontWeight: 700, padding: '0 4px', minWidth: 16,
                  textAlign: 'center', lineHeight: '16px',
                }}>
                  {pendingCount}
                </span>
              )}
            </div>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
