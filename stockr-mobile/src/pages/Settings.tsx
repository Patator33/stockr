import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getServerUrl, setServerUrl, clearToken, api, type UserProfile, type AuditLog } from '../api';
import { getDebugLogs } from '../hooks/useNotifications';

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    'auth.login': 'Connexion',
    'user.create': 'Création utilisateur',
    'user.delete': 'Suppression utilisateur',
    'user.role_change': 'Changement de rôle',
    'order.shipped': 'Commande expédiée',
    'order.prepared': 'Commande préparée',
    'order.delete': 'Commande supprimée',
  };
  return labels[action] || action;
}

export default function Settings() {
  const navigate = useNavigate();
  const [serverUrl, setServerUrlState] = useState('');
  const [saved, setSaved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Notifications
  const [notifStatus, setNotifStatus] = useState('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [userError, setUserError] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  // Audit logs
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    getServerUrl().then(url => setServerUrlState(url));
    api.auth.me().then(me => {
      if (me.role === 'admin') {
        setIsAdmin(true);
        api.users.list().then(setUsers).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await setServerUrl(serverUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
          smallIcon: 'ic_stat_stockr',
          schedule: { at: new Date(Date.now() + 1000) },
        }],
      });
      setNotifStatus('✓ Notif envoyée — tu devrais la recevoir dans 1s');
    } catch (e) {
      setNotifStatus(`Erreur: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserLoading(true);
    try {
      const user = await api.users.create(newEmail, newPassword, newRole);
      setUsers(prev => [...prev, user]);
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Supprimer ${email} ?`)) return;
    try {
      await api.users.delete(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    const newR = user.role === 'admin' ? 'user' : 'admin';
    try {
      const updated = await api.users.setRole(user.id, newR);
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleLoadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await api.logs.list(100);
      setLogs(data.logs);
      setShowLogs(true);
    } catch { /* ignore */ } finally {
      setLogsLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="pb-nav safe-top" style={{ padding: '1rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e2e8f0', margin: '0 0 1.5rem' }}>🔧 Réglages</h1>

      {/* Server URL */}
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

      {/* Notifications */}
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
        <button
          onClick={() => { setDebugLogs(getDebugLogs()); setShowDebug(true); }}
          style={{ marginTop: '0.5rem', background: 'none', border: '1px solid #2a3045', borderRadius: '0.5rem', color: '#64748b', fontSize: '0.75rem', padding: '0.375rem 0.75rem', cursor: 'pointer', width: '100%' }}
        >
          🔍 Voir logs polling
        </button>
        {showDebug && debugLogs.length > 0 && (
          <div style={{ marginTop: '0.5rem', background: '#0a0e1a', border: '1px solid #2a3045', borderRadius: '0.5rem', padding: '0.625rem', maxHeight: '12rem', overflowY: 'auto' }}>
            {debugLogs.map((l, i) => (
              <p key={i} style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>{l}</p>
            ))}
          </div>
        )}
        {showDebug && debugLogs.length === 0 && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#475569' }}>Aucun log — le polling n'a pas encore tourné.</p>
        )}
      </div>

      {/* User management — admin only */}
      {isAdmin && (
        <div style={{ borderTop: '1px solid #2a3045', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 0.75rem' }}>👥 Utilisateurs</h2>

          {/* User list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#141824', border: '1px solid #2a3045', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: u.role === 'admin' ? '#f59e0b' : '#64748b' }}>{u.role}</p>
                </div>
                <button
                  onClick={() => handleToggleRole(u)}
                  style={{ background: 'none', border: '1px solid #2a3045', borderRadius: '0.375rem', color: '#94a3b8', fontSize: '0.7rem', padding: '0.25rem 0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {u.role === 'admin' ? '→ user' : '→ admin'}
                </button>
                <button
                  onClick={() => handleDeleteUser(u.id, u.email)}
                  style={{ background: 'none', border: '1px solid #7f1d1d', borderRadius: '0.375rem', color: '#ef4444', fontSize: '0.7rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Create user form */}
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8' }}>Nouvel utilisateur</p>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mot de passe (6 car. min)"
              required
              minLength={6}
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
              style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.5rem', color: '#e2e8f0', padding: '0.625rem', fontSize: '0.875rem' }}
            >
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
            </select>
            {userError && <p style={{ margin: 0, fontSize: '0.8125rem', color: '#ef4444' }}>{userError}</p>}
            <button type="submit" className="btn-primary" disabled={userLoading}>
              {userLoading ? 'Création…' : '+ Créer'}
            </button>
          </form>
        </div>
      )}

      {/* Audit logs — admin only */}
      {isAdmin && (
        <div style={{ borderTop: '1px solid #2a3045', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 0.75rem' }}>📋 Journal des actions</h2>
          <button onClick={handleLoadLogs} className="btn-ghost" style={{ width: '100%' }} disabled={logsLoading}>
            {logsLoading ? 'Chargement…' : '🔄 Charger les logs'}
          </button>
          {showLogs && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '20rem', overflowY: 'auto' }}>
              {logs.length === 0 && <p style={{ fontSize: '0.8125rem', color: '#475569', margin: 0 }}>Aucun log.</p>}
              {logs.map(log => (
                <div key={log.id} style={{ background: '#141824', border: '1px solid #2a3045', borderRadius: '0.375rem', padding: '0.5rem 0.625rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600 }}>{actionLabel(log.action)}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#475569', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>{log.userEmail || '—'}</p>
                  {log.details && <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>{log.details}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Account */}
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
