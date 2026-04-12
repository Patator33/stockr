'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../_auth';

interface UserProfile { id: string; email: string; role: string; createdAt: string; }
interface AuditLog { id: string; userId?: string | null; userEmail?: string | null; action: string; details?: string | null; createdAt: string; }

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Connexion',
  'user.create': 'Création utilisateur',
  'user.delete': 'Suppression utilisateur',
  'user.role_change': 'Changement de rôle',
  'order.shipped': 'Commande expédiée',
  'order.prepared': 'Commande préparée',
  'order.delete': 'Commande supprimée',
};

export default function SettingsPage() {
  const router = useRouter();
  const auth = useAuth();
  const isAdmin = auth?.role === 'admin';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [userError, setUserError] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/users').then(r => r.json()).then(u => setUsers(Array.isArray(u) ? u : []));
    loadLogs();
  }, [isAdmin]);

  const loadLogs = () => {
    setLogsLoading(true);
    fetch('/api/logs?limit=100').then(r => r.json()).then(d => {
      setLogs(d.logs || []);
      setLogsTotal(d.total || 0);
    }).finally(() => setLogsLoading(false));
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserLoading(true);
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }) });
    const d = await res.json();
    if (!res.ok) { setUserError(d.error || 'Erreur'); setUserLoading(false); return; }
    setUsers(prev => [...prev, d]);
    setNewEmail(''); setNewPassword(''); setNewRole('user');
    setUserLoading(false);
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Supprimer ${email} ?`)) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Erreur'); return; }
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const toggleRole = async (user: UserProfile) => {
    const newR = user.role === 'admin' ? 'user' : 'admin';
    const res = await fetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newR }) });
    const d = await res.json();
    if (res.ok) setUsers(prev => prev.map(u => u.id === user.id ? d : u));
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/web/login');
  };

  return (
    <div style={{ maxWidth: '52rem' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Réglages</h1>

      {/* Account info */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>Compte</h2>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: '#e2e8f0' }}>{auth?.email}</p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: auth?.role === 'admin' ? '#f59e0b' : '#64748b' }}>{auth?.role === 'admin' ? '★ Administrateur' : 'Utilisateur'}</p>
        <button onClick={handleLogout} className="btn-danger">Se déconnecter</button>
      </div>

      {/* User management — admin only */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>👥 Utilisateurs</h2>
          <table style={{ marginBottom: '1.5rem' }}>
            <thead>
              <tr><th>Email</th><th>Rôle</th><th>Créé le</th><th></th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <button onClick={() => toggleRole(u)}
                      style={{ background: 'none', border: '1px solid #2a3045', borderRadius: '0.375rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem', cursor: 'pointer', color: u.role === 'admin' ? '#f59e0b' : '#64748b' }}>
                      {u.role === 'admin' ? '★ admin' : 'user'}
                    </button>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td>
                    {u.id !== auth?.userId && (
                      <button onClick={() => deleteUser(u.id, u.email)} className="btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>Supprimer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700, color: '#94a3b8' }}>Nouvel utilisateur</h3>
          <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.5rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Mot de passe</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Rôle</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'user' | 'admin')} style={{ width: 'auto' }}>
                <option value="user">Utilisateur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={userLoading}>
              {userLoading ? '…' : '+ Créer'}
            </button>
            {userError && <p style={{ gridColumn: '1 / -1', margin: 0, color: '#ef4444', fontSize: '0.875rem' }}>{userError}</p>}
          </form>
        </div>
      )}

      {/* Audit logs — admin only */}
      {isAdmin && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>📋 Journal des actions</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{logsTotal} entrée{logsTotal !== 1 ? 's' : ''}</span>
              <button onClick={loadLogs} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }} disabled={logsLoading}>
                {logsLoading ? '…' : '🔄 Actualiser'}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(l.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{l.userEmail || '—'}</td>
                  <td style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{ACTION_LABELS[l.action] || l.action}</td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{l.details || '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && !logsLoading && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#475569' }}>Aucun log</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
