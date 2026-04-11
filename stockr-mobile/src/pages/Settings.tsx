import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
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

  const [notifStatus, setNotifStatus] = useState('');

  const handleTestNotif = async () => {
    setNotifStatus('…');
    try {
      const perm = await LocalNotifications.checkPermissions();
      setNotifStatus(`Permission: ${perm.display}`);
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        setNotifStatus(`Après demande: ${req.display}`);
        if (req.display !== 'granted') return;
      }
      await LocalNotifications.createChannel({
        id: 'stockr_orders',
        name: 'Commandes',
        importance: 5,
        vibration: true,
      });
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 100000),
          title: '🧪 Test Stockr',
          body: 'Notifications fonctionnelles !',
          channelId: 'stockr_orders',
          schedule: { at: new Date(Date.now() + 1000) },
        }],
      });
      setNotifStatus('✓ Notif envoyée — tu devrais la recevoir dans 1s');
    } catch (e) {
      setNotifStatus(`Erreur: ${e instanceof Error ? e.message : String(e)}`);
    }
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

      <div style={{ borderTop: '1px solid #2a3045', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 0.75rem' }}>Notifications</h2>
        <button onClick={handleTestNotif} className="btn-ghost" style={{ width: '100%' }}>
          🔔 Envoyer une notification test
        </button>
        {notifStatus && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: notifStatus.startsWith('✓') ? '#22c55e' : notifStatus.startsWith('Erreur') ? '#ef4444' : '#94a3b8' }}>
            {notifStatus}
          </p>
        )}
      </div>

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
