import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { prisma } from '@/lib/prisma';

const execFileAsync = promisify(execFile);

export interface SmbConfig {
  host: string;
  share: string;
  /** Sous-dossier dans le partage, vide = racine. */
  folder: string;
  username: string;
  password: string;
  domain: string;
}

export type BackupFrequency = 'daily' | 'weekly' | 'monthly';

const FREQUENCY_DAYS: Record<BackupFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

/** Nettoie le sous-dossier : séparateurs '/', liste blanche stricte (la valeur finit dans la mini-syntaxe de smbclient). */
function normalizeFolder(folder: string): string {
  const cleaned = folder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return cleaned.replace(/[^A-Za-z0-9 _./-]/g, '');
}

function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `stockr_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.db`;
}

const NT_STATUS_HINTS: Record<string, string> = {
  NT_STATUS_LOGON_FAILURE: 'Identifiants refusés (utilisateur ou mot de passe incorrect)',
  NT_STATUS_ACCESS_DENIED: "Accès refusé — l'utilisateur n'a pas les droits sur ce dossier",
  NT_STATUS_BAD_NETWORK_NAME: 'Partage introuvable sur le serveur (nom de partage incorrect ?)',
  NT_STATUS_OBJECT_PATH_NOT_FOUND: 'Sous-dossier introuvable',
  NT_STATUS_CONNECTION_REFUSED: 'Connexion refusée par le serveur',
  NT_STATUS_HOST_UNREACHABLE: 'Serveur injoignable',
  NT_STATUS_IO_TIMEOUT: 'Délai réseau dépassé',
};

/** Cherche une erreur dans la sortie de smbclient, même quand il rend un code 0. */
function checkSmbOutput(output: string): string | null {
  const match = output.match(/NT_STATUS_[A-Z_]+/);
  if (match) {
    const code = match[0];
    return NT_STATUS_HINTS[code] ? `${NT_STATUS_HINTS[code]} (${code})` : code;
  }
  if (/session setup failed/i.test(output)) return 'Authentification refusée.';
  if (/Connection to .* failed/i.test(output)) return 'Connexion au serveur impossible.';
  return null;
}

const SMB_TIMEOUT_MS = 20000;

/**
 * smbclient en non-interactif. Mot de passe via PASSWD (pas dans la liste des
 * processus), execFile avec tableau d'arguments (pas de shell), sous-dossier
 * via -D (jamais interprété par la syntaxe de commandes de smbclient).
 */
async function runSmbClient(config: SmbConfig, commands: string, folder?: string): Promise<{ stdout: string; stderr: string }> {
  const args = ['-U', config.username, `//${config.host}/${config.share}`];
  if (folder) args.push('-D', folder);
  if (config.domain) args.push('-W', config.domain);
  args.push('-c', commands);

  try {
    const { stdout, stderr } = await execFileAsync('smbclient', args, {
      timeout: SMB_TIMEOUT_MS,
      env: { ...process.env, PASSWD: config.password },
    });
    return { stdout, stderr };
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean; signal?: string | null };
    if (e.code === 'ENOENT') throw new Error("smbclient n'est pas installé sur le serveur.");
    if (e.killed || e.signal) throw new Error(`Délai dépassé (${SMB_TIMEOUT_MS / 1000}s) — serveur injoignable ou pare-feu.`);
    const output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    throw new Error(checkSmbOutput(output) || e.message || 'Erreur smbclient inconnue');
  }
}

/** Vérifie que le partage est joignable avec ces identifiants, sans rien écrire. */
export async function testSmbConnection(config: SmbConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const folder = normalizeFolder(config.folder);
    const { stdout, stderr } = await runSmbClient(config, 'ls', folder || undefined);
    const err = checkSmbOutput(stdout + stderr);
    if (err) return { success: false, error: err };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erreur de connexion' };
  }
}

/** Copie cohérente de la base (VACUUM INTO) : sûr même si l'app écrit pendant la copie. */
async function snapshotDb(): Promise<string> {
  const target = join(tmpdir(), `stockr_snapshot_${Date.now()}.db`);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return target;
}

/** Envoie un snapshot de la base sur le partage et purge au-delà de `retention`. */
async function uploadBackup(config: SmbConfig, retention: number): Promise<{ success: boolean; error?: string; fileName?: string }> {
  let snapshot: string | null = null;
  try {
    const folder = normalizeFolder(config.folder);
    const dir = folder || undefined;

    // Le dossier existe peut-être déjà : échec ignoré.
    if (folder) await runSmbClient(config, `mkdir "${folder}"`).catch(() => {});

    snapshot = await snapshotDb();
    const fileName = backupFileName();
    const { stdout, stderr } = await runSmbClient(config, `put "${snapshot}" "${fileName}"`, dir);
    const err = checkSmbOutput(stdout + stderr);
    if (err) return { success: false, error: err };

    if (retention > 0) {
      const listing = await runSmbClient(config, 'ls stockr_*.db', dir).catch(() => ({ stdout: '', stderr: '' }));
      const names = Array.from(
        listing.stdout.matchAll(/\s(stockr_\d{4}-\d{2}-\d{2}_\d{4}\.db)\s/g),
        m => m[1],
      );
      // Nom triable lexicographiquement = triable chronologiquement.
      const uniqueSorted = Array.from(new Set(names)).sort().reverse();
      const toDelete = uniqueSorted.slice(retention);
      if (toDelete.length > 0) {
        const delCmd = toDelete.map(n => `del "${n}"`).join('; ');
        await runSmbClient(config, delCmd, dir).catch(() => {});
      }
    }

    return { success: true, fileName };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  } finally {
    if (snapshot) await unlink(snapshot).catch(() => {});
  }
}

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

interface LoadedBackupConfig {
  config: SmbConfig;
  retention: number;
  enabled: boolean;
  frequency: BackupFrequency;
}

export async function loadBackupConfig(): Promise<LoadedBackupConfig | null> {
  const [enabled, host, share, folder, username, password, domain, frequencyRaw, retentionRaw] = await Promise.all([
    getSetting('backup_enabled'),
    getSetting('backup_smb_host'),
    getSetting('backup_smb_share'),
    getSetting('backup_smb_folder'),
    getSetting('backup_smb_username'),
    getSetting('backup_smb_password'),
    getSetting('backup_smb_domain'),
    getSetting('backup_frequency'),
    getSetting('backup_retention'),
  ]);
  if (!host || !share) return null;

  const retention = retentionRaw ? parseInt(retentionRaw, 10) : 30;
  return {
    config: { host, share, folder: folder ?? '', username: username ?? '', password: password ?? '', domain: domain ?? '' },
    retention: isNaN(retention) ? 30 : retention,
    enabled: enabled === 'true',
    frequency: (frequencyRaw as BackupFrequency) || 'daily',
  };
}

async function performBackup(config: SmbConfig, retention: number): Promise<{ success: boolean; error?: string }> {
  const result = await uploadBackup(config, retention);

  if (result.success) {
    await setSetting('backup_last_run', new Date().toISOString());
    await setSetting('backup_last_status', 'ok');
    await prisma.setting.deleteMany({ where: { key: 'backup_last_error' } });
  } else {
    await setSetting('backup_last_status', 'error');
    await setSetting('backup_last_error', result.error ?? 'Erreur inconnue');
    // Notifie via le webhook existant si configuré
    const hook = await getSetting('webhookUrl');
    if (hook) {
      fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'backup_failed', error: result.error ?? 'Erreur inconnue', host: config.host, share: config.share }),
      }).catch(() => {});
    }
  }

  return { success: result.success, error: result.error };
}

/** N'agit que si la sauvegarde auto est activée et que la fréquence est échue. */
export async function runScheduledBackupIfDue(): Promise<{ ran: boolean; success?: boolean; error?: string }> {
  const loaded = await loadBackupConfig();
  if (!loaded || !loaded.enabled) return { ran: false };

  const lastRunRaw = await getSetting('backup_last_run');
  const lastRun = lastRunRaw ? new Date(lastRunRaw) : null;
  const thresholdDays = FREQUENCY_DAYS[loaded.frequency] ?? 1;
  const dueSince = lastRun ? (Date.now() - lastRun.getTime()) / (24 * 3600 * 1000) : Infinity;
  // Marge d'une heure : le tick horaire ne doit pas décaler la sauvegarde d'un jour entier.
  if (dueSince < thresholdDays - 1 / 24) return { ran: false };

  const result = await performBackup(loaded.config, loaded.retention);
  return { ran: true, ...result };
}

/** Déclenchement manuel, hors planification. */
export async function runBackupNow(): Promise<{ success: boolean; error?: string }> {
  const loaded = await loadBackupConfig();
  if (!loaded) return { success: false, error: 'Serveur ou partage manquant.' };
  return performBackup(loaded.config, loaded.retention);
}
