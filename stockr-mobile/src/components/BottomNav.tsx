import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Stocks', icon: '📦' },
  { to: '/sales', label: 'Ventes', icon: '💰' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/manage', label: 'Gestion', icon: '⚙️' },
  { to: '/settings', label: 'Réglages', icon: '🔧' },
];

export default function BottomNav() {
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
            <span className="text-xl mb-0.5">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
