'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../_auth';
import { wGet, wFetch, clearWebToken, getWebToken } from '../_api';

interface UserProfile { id: string; email: string; role: string; createdAt: string; }
interface AuditLog { id: string; userEmail?: string | null; action: string; details?: string | null; createdAt: string; }

const ACTION_LABELS: Record<string, string> = {
  'auth.login':      'Connexion',
  'user.create':     'Création utilisateur',
  'user.delete':     'Suppression utilisateur',
  'user.role_change':'Changement de rôle',
  'order.shipped':   'Commande expédiée',
  'order.prepared':  'Commande préparée',
  'order.delete':    'Commande supprimée',
};

export default function SettingsPage() {
  const router = useRouter();
  const auth   = useAuth();
  const isAdmin = auth?.role === 'admin';

  const [users,       setUsers]       = useState<UserProfile[]>([]);
  const [logs,        setLogs]        = useState<AuditLog[]>([]);
  const [logsTotal,   setLogsTotal]   = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [newEmail,    setNewEmail]    = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole,     setNewRole]     = useState<'user'|'admin'>('user');
  const [userError,   setUserError]   = useState('');
  const [userLoading, setUserLoading] = useState(false);

  // App settings
  const [defaultVatRate,             setDefaultVatRate]             = useState('20');
  const [webhookUrl,                 setWebhookUrl]                 = useState('');
  const [shippingReminderWebhookUrl, setShippingReminderWebhookUrl] = useState('');
  const [settingsSaved, setSettingsSaved]   = useState(false);

  // Sauvegarde automatique SMB
  const emptySmb = { enabled: false, frequency: 'daily', retention: '30', host: '', share: '', folder: '', username: '', password: '', domain: '', passwordSet: false, lastRun: '', lastStatus: '', lastError: '' };
  const [smb, setSmb] = useState(emptySmb);
  const [smbOpen, setSmbOpen] = useState(true);
  const [smbBusy, setSmbBusy] = useState('');
  const [smbMsg, setSmbMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Backup/restore
  const [backupMsg,  setBackupMsg]  = useState('');
  const [restoring,  setRestoring]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLogs = () => {
    setLogsLoading(true);
    wGet<{ logs: AuditLog[]; total: number }>('/api/logs?limit=100')
      .then(d => { setLogs(d.logs); setLogsTotal(d.total); })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    wGet<Record<string, string>>('/api/settings').then(s => {
      if (s.defaultVatRate)             setDefaultVatRate(s.defaultVatRate);
      if (s.webhookUrl)                 setWebhookUrl(s.webhookUrl);
      if (s.shippingReminderWebhookUrl) setShippingReminderWebhookUrl(s.shippingReminderWebhookUrl);
      setSmb({
        enabled: s.backup_enabled === 'true', frequency: s.backup_frequency || 'daily', retention: s.backup_retention || '30',
        host: s.backup_smb_host || '', share: s.backup_smb_share || '', folder: s.backup_smb_folder || '',
        username: s.backup_smb_username || '', password: '', domain: s.backup_smb_domain || '',
        passwordSet: s.backup_smb_password_set === 'true',
        lastRun: s.backup_last_run || '', lastStatus: s.backup_last_status || '', lastError: s.backup_last_error || '',
      });
    }).catch(() => {});
    if (!isAdmin) return;
    wGet<UserProfile[]>('/api/users').then(setUsers).catch(() => {});
    loadLogs();
  }, [isAdmin]);

  const saveSettings = async () => {
    await wFetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ defaultVatRate, webhookUrl, shippingReminderWebhookUrl }) });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const smbPayload = () => ({
    backup_enabled: String(smb.enabled), backup_frequency: smb.frequency, backup_retention: smb.retention,
    backup_smb_host: smb.host.trim(), backup_smb_share: smb.share.trim(), backup_smb_folder: smb.folder.trim(),
    backup_smb_username: smb.username.trim(), backup_smb_password: smb.password, backup_smb_domain: smb.domain.trim(),
  });

  const refreshSmbStatus = () =>
    wGet<Record<string, string>>('/api/settings').then(s =>
      setSmb(p => ({ ...p, passwordSet: s.backup_smb_password_set === 'true', lastRun: s.backup_last_run || '', lastStatus: s.backup_last_status || '', lastError: s.backup_last_error || '' }))
    ).catch(() => {});

  const saveSmb = async (): Promise<boolean> => {
    const res = await wFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(smbPayload()) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setSmbMsg({ ok: false, text: d.error || 'Erreur' }); return false; }
    setSmb(p => ({ ...p, password: '', passwordSet: p.passwordSet || !!p.password }));
    return true;
  };

  const smbAction = async (kind: 'save' | 'test' | 'run') => {
    setSmbBusy(kind); setSmbMsg(null);
    try {
      if (kind === 'save') {
        if (await saveSmb()) setSmbMsg({ ok: true, text: 'Paramètres enregistrés.' });
      } else if (kind === 'test') {
        const res = await wFetch('/api/backup/smb', { method: 'POST', body: JSON.stringify({ action: 'test', host: smb.host.trim(), share: smb.share.trim(), folder: smb.folder.trim(), username: smb.username.trim(), password: smb.password, domain: smb.domain.trim() }) });
        const d = await res.json();
        setSmbMsg({ ok: !!d.success, text: d.success ? 'Connexion réussie.' : (d.error || 'Échec de la connexion') });
      } else {
        if (!(await saveSmb())) return;
        const res = await wFetch('/api/backup/smb', { method: 'POST', body: JSON.stringify({ action: 'run' }) });
        const d = await res.json();
        setSmbMsg({ ok: !!d.success, text: d.success ? 'Sauvegarde envoyée.' : (d.error || 'Échec de la sauvegarde') });
        await refreshSmbStatus();
      }
    } catch (err) { setSmbMsg({ ok: false, text: err instanceof Error ? err.message : 'Erreur' }); }
    finally { setSmbBusy(''); }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(''); setUserLoading(true);
    try {
      const res = await wFetch('/api/users', { method: 'POST', body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }) });
      const d = await res.json();
      if (!res.ok) { setUserError(d.error || 'Erreur'); return; }
      setUsers(prev => [...prev, d]);
      setNewEmail(''); setNewPassword(''); setNewRole('user');
    } catch (err) { setUserError(err instanceof Error ? err.message : 'Erreur'); }
    finally { setUserLoading(false); }
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Supprimer ${email} ?`)) return;
    const res = await wFetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Erreur'); return; }
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const toggleRole = async (user: UserProfile) => {
    const newR = user.role === 'admin' ? 'user' : 'admin';
    const res = await wFetch(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role: newR }) });
    const d = await res.json();
    if (res.ok) setUsers(prev => prev.map(u => u.id === user.id ? d : u));
  };

  const handleLogout = () => {
    clearWebToken();
    wFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/web/login');
  };

  const downloadBackup = () => {
    const token = getWebToken();
    fetch('/api/backup', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `stockr_backup_${new Date().toISOString().slice(0, 10)}.db`;
        a.click();
        setBackupMsg('Sauvegarde téléchargée.');
      })
      .catch(() => setBackupMsg('Erreur lors de la sauvegarde.'));
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(`Restaurer la base depuis "${file.name}" ? L'application sera rechargée après la restauration.`)) return;
    setRestoring(true);
    setBackupMsg('');
    try {
      const token = getWebToken();
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: await file.arrayBuffer(),
      });
      const d = await res.json();
      if (!res.ok) { setBackupMsg(d.error || 'Erreur'); return; }
      setBackupMsg(d.message);
    } catch (err) { setBackupMsg(err instanceof Error ? err.message : 'Erreur'); }
    finally { setRestoring(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <div style={{ maxWidth: '52rem' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800 }}>Réglages</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>Compte</h2>
        <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem' }}>{auth?.email}</p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: auth?.role === 'admin' ? '#f59e0b' : '#64748b' }}>
          {auth?.role === 'admin' ? '★ Administrateur' : 'Utilisateur'}
        </p>
        <button onClick={handleLogout} className="btn-danger">Se déconnecter</button>
      </div>

      {/* App settings */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>⚙️ Paramètres de l'application</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>TVA par défaut (%)</label>
              <input type="number" step="0.1" min="0" max="100" value={defaultVatRate} onChange={e => setDefaultVatRate(e.target.value)} style={{ width: '8rem' }} />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569' }}>
            Note: ce taux s'applique aux nouvelles variantes. Chaque variante peut avoir son propre taux.
          </p>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>URL du webhook (nouvelle commande)</label>
            <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://…" style={{ width: '100%', maxWidth: '32rem' }} />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#475569' }}>
              Si renseignée, un POST JSON avec les détails de la commande sera envoyé à cette URL à chaque nouvelle commande.
            </p>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>URL du webhook (relance expédition)</label>
            <input type="url" value={shippingReminderWebhookUrl} onChange={e => setShippingReminderWebhookUrl(e.target.value)} placeholder="https://…" style={{ width: '100%', maxWidth: '32rem' }} />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#475569' }}>
              Si renseignée, un POST JSON sera envoyé à 16h pour chaque commande non expédiée dont la date limite d'expédition est aujourd'hui.
            </p>
          </div>
          <div>
            <button onClick={saveSettings} className="btn-primary" style={{ fontSize: '0.8125rem' }}>
              {settingsSaved ? '✓ Sauvegardé' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>💾 Sauvegarde &amp; Restauration</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={downloadBackup} className="btn-primary" style={{ fontSize: '0.8125rem' }}>
            ⬇ Télécharger la sauvegarde
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-ghost" style={{ fontSize: '0.8125rem' }} disabled={restoring}>
            {restoring ? '…' : '⬆ Restaurer depuis un fichier'}
          </button>
          <input ref={fileInputRef} type="file" accept=".db" style={{ display: 'none' }} onChange={handleRestoreFile} />
        </div>
        {backupMsg && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: backupMsg.startsWith('Err') ? '#ef4444' : '#22c55e' }}>
            {backupMsg}
          </p>
        )}
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#475569' }}>
          Sauvegarde = fichier SQLite complet. Restaurer remplace toute la base — opération irréversible.
        </p>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div onClick={() => setSmbOpen(o => !o)} style={{ cursor: 'pointer', flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{smbOpen ? '▾' : '▸'} 💾 Sauvegarde automatique</h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>Copie périodique de la base vers un partage réseau (SMB/Samba)</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={smb.enabled} onChange={e => setSmb(p => ({ ...p, enabled: e.target.checked }))} style={{ width: 'auto' }} />
              {smb.enabled ? 'Activée' : 'Désactivée'}
            </label>
          </div>
          {smbOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569' }}>Seul le protocole SMB/Samba est pris en charge. Un snapshot cohérent de la base est envoyé ; les plus anciens sont purgés.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Fréquence</label>
                  <select value={smb.frequency} onChange={e => setSmb(p => ({ ...p, frequency: e.target.value }))}>
                    <option value="daily">Quotidienne</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuelle</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Sauvegardes conservées avant purge</label>
                  <input type="number" min={1} value={smb.retention} onChange={e => setSmb(p => ({ ...p, retention: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Serveur (IP ou nom d'hôte)</label>
                  <input value={smb.host} onChange={e => setSmb(p => ({ ...p, host: e.target.value }))} placeholder="192.168.1.10" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Partage</label>
                  <input value={smb.share} onChange={e => setSmb(p => ({ ...p, share: e.target.value }))} placeholder="sauvegardes" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Sous-dossier (facultatif)</label>
                  <input value={smb.folder} onChange={e => setSmb(p => ({ ...p, folder: e.target.value }))} placeholder="stockr" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Utilisateur</label>
                  <input value={smb.username} onChange={e => setSmb(p => ({ ...p, username: e.target.value }))} autoComplete="off" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Mot de passe</label>
                  <input type="password" value={smb.password} onChange={e => setSmb(p => ({ ...p, password: e.target.value }))} placeholder={smb.passwordSet ? '•••••• (enregistré)' : ''} autoComplete="new-password" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Domaine (facultatif)</label>
                  <input value={smb.domain} onChange={e => setSmb(p => ({ ...p, domain: e.target.value }))} placeholder="WORKGROUP" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => smbAction('save')} className="btn-primary" disabled={!!smbBusy} style={{ fontSize: '0.8125rem' }}>{smbBusy === 'save' ? '…' : '💾 Enregistrer'}</button>
                <button onClick={() => smbAction('test')} className="btn-ghost" disabled={!!smbBusy} style={{ fontSize: '0.8125rem' }}>{smbBusy === 'test' ? '…' : '📍 Tester la connexion'}</button>
                <button onClick={() => smbAction('run')} className="btn-ghost" disabled={!!smbBusy} style={{ fontSize: '0.8125rem' }}>{smbBusy === 'run' ? '…' : '⬆ Sauvegarder maintenant'}</button>
              </div>
              {smbMsg && <p style={{ margin: 0, fontSize: '0.8125rem', color: smbMsg.ok ? '#22c55e' : '#ef4444' }}>{smbMsg.text}</p>}
              {smb.lastRun && (
                <p style={{ margin: 0, fontSize: '0.75rem', color: smb.lastStatus === 'error' ? '#ef4444' : '#64748b' }}>
                  Dernière sauvegarde : {new Date(smb.lastRun).toLocaleString('fr-FR')} — {smb.lastStatus === 'ok' ? 'réussie' : `échec${smb.lastError ? ` (${smb.lastError})` : ''}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>👥 Utilisateurs</h2>
          <table style={{ marginBottom: '1.5rem' }}>
            <thead><tr><th>Email</th><th>Rôle</th><th>Créé le</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <button onClick={() => toggleRole(u)} style={{ background: 'none', border: '1px solid #2a3045', borderRadius: '0.375rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem', cursor: 'pointer', color: u.role === 'admin' ? '#f59e0b' : '#64748b' }}>
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
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'user'|'admin')} style={{ width: 'auto' }}>
                <option value="user">Utilisateur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={userLoading}>{userLoading ? '…' : '+ Créer'}</button>
            {userError && <p style={{ gridColumn: '1 / -1', margin: 0, color: '#ef4444', fontSize: '0.875rem' }}>{userError}</p>}
          </form>
        </div>
      )}

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
            <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
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
