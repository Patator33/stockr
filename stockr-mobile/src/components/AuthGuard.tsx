import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../api';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const status = await api.setup.status();
        if (status.needsSetup) {
          navigate('/setup', { replace: true });
          return;
        }
        const token = await getToken();
        if (!token) {
          navigate('/login', { replace: true });
          return;
        }
        await api.auth.me();
      } catch {
        navigate('/login', { replace: true });
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted text-sm">Chargement…</div>
      </div>
    );
  }

  return <>{children}</>;
}
