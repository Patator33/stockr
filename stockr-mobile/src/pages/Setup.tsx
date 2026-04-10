import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, getServerUrl, setServerUrl } from '../api';

export default function Setup() {
  const navigate = useNavigate();
  const [serverUrl, setServerUrlState] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getServerUrl().then(url => setServerUrlState(url));
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setServerUrl(serverUrl);
      const { token } = await api.setup.create(email, password);
      await setToken(token);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.5rem', background: '#0a0e1a' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📦</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
          Stock<span style={{ color: '#2b8cee' }}>r</span>
        </h1>
        <p className="text-text-muted text-sm mt-1">Première configuration</p>
      </div>

      <div style={{ background: 'rgba(43,140,238,0.08)', border: '1px solid rgba(43,140,238,0.2)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
        <p className="text-text-secondary text-sm" style={{ margin: 0 }}>
          Créez votre compte administrateur pour commencer à utiliser Stockr.
        </p>
      </div>

      <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">URL du serveur</label>
          <input
            type="url"
            value={serverUrl}
            onChange={e => setServerUrlState(e.target.value)}
            placeholder="http://192.168.1.x:3009"
            required
          />
        </div>
        <div>
          <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Email admin</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@exemple.com"
            required
          />
        </div>
        <div>
          <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">Mot de passe (6 car. min)</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? 'Création…' : 'Créer le compte'}
        </button>
      </form>
    </div>
  );
}
