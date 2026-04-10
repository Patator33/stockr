import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServerUrl, setServerUrl, clearToken } from '../api';

export default function Settings() {
  const navigate = useNavigate();
  const [serverUrl, setServerUrlState] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getServerUrl().then(url => setServerUrlState(url));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await setServerUrl(serverUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: '0 0 1.5rem' }}>🔧 Réglages</h1>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">URL du serveur Stockr</label>
          <input
            type="url"
            value={serverUrl}
            onChange={e => setServerUrlState(e.target.value)}
            placeholder="http://192.168.1.x:3009"
            required
          />
          <p className="text-text-muted text-xs" style={{ marginTop: '0.375rem' }}>
            Adresse IP ou domaine de votre serveur Docker.
          </p>
        </div>
        <button type="submit" className="btn-primary">
          {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </form>

      <div style={{ borderTop: '1px solid #2a3045', paddingTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 1rem' }}>Compte</h2>
        <button onClick={handleLogout} className="btn-danger" style={{ width: '100%' }}>
          Se déconnecter
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#141824', border: '1px solid #2a3045', borderRadius: '0.75rem' }}>
        <p className="text-text-muted text-xs text-center" style={{ margin: 0 }}>
          Stockr v1.0.0 · Gestion de stocks & ventes
        </p>
      </div>
    </div>
  );
}
