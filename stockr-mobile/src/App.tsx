import { useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import AuthGuard from './components/AuthGuard';
import { useNotifications } from './hooks/useNotifications';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Sales from './pages/Sales';
import Stats from './pages/Stats';
import Manage from './pages/Manage';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Locations from './pages/Locations';
import StockReturns from './pages/StockReturns';
import StockMovements from './pages/StockMovements';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';

const TABS = ['/', '/orders', '/sales', '/manage', '/settings'];

function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const handler = CapApp.addListener('backButton', () => {
      const isRootTab = TABS.includes(location.pathname);
      if (isRootTab) {
        if (location.pathname !== '/') navigate('/');
        else CapApp.exitApp();
      } else {
        navigate(-1);
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, [location.pathname, navigate]);

  useEffect(() => {
    const handler = CapApp.addListener('appUrlOpen', (event) => {
      // stockr://orders/<id>
      try {
        const url = new URL(event.url);
        if (url.host === 'orders') {
          const orderId = url.pathname.replace(/^\//, '');
          if (orderId) navigate('/orders', { state: { orderId } });
        }
      } catch { /* URL invalide */ }
    });
    return () => { handler.then(h => h.remove()); };
  }, [navigate]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const currentIdx = TABS.findIndex(t =>
      t === '/' ? location.pathname === '/' : location.pathname.startsWith(t)
    );
    if (currentIdx === -1) return;
    if (dx < 0 && currentIdx < TABS.length - 1) navigate(TABS[currentIdx + 1]);
    else if (dx > 0 && currentIdx > 0) navigate(TABS[currentIdx - 1]);
  };

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  useNotifications();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/" element={<AuthGuard><AppShell><Dashboard /></AppShell></AuthGuard>} />
        <Route path="/orders" element={<AuthGuard><AppShell><Orders /></AppShell></AuthGuard>} />
        <Route path="/sales" element={<AuthGuard><AppShell><Sales /></AppShell></AuthGuard>} />
        <Route path="/stats" element={<AuthGuard><AppShell><Stats /></AppShell></AuthGuard>} />
        <Route path="/manage" element={<AuthGuard><AppShell><Manage /></AppShell></AuthGuard>} />
        <Route path="/manage/products" element={<AuthGuard><AppShell><Products /></AppShell></AuthGuard>} />
        <Route path="/manage/products/:id" element={<AuthGuard><AppShell><ProductDetail /></AppShell></AuthGuard>} />
        <Route path="/manage/locations" element={<AuthGuard><AppShell><Locations /></AppShell></AuthGuard>} />
        <Route path="/manage/stock-returns" element={<AuthGuard><AppShell><StockReturns /></AppShell></AuthGuard>} />
        <Route path="/manage/stock-movements" element={<AuthGuard><AppShell><StockMovements /></AppShell></AuthGuard>} />
        <Route path="/manage/suppliers" element={<AuthGuard><AppShell><Suppliers /></AppShell></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><AppShell><Settings /></AppShell></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
