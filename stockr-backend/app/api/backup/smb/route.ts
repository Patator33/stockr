import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadBackupConfig, runBackupNow, testSmbConnection } from '@/lib/backup';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest): Promise<boolean> {
  try {
    const userId = await requireAuth(req);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user?.role === 'admin';
  } catch {
    return false;
  }
}

// POST { action: 'test' | 'run', ...override } — test accepte les valeurs du formulaire
// (mot de passe vide = celui déjà enregistré).
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.action === 'run') {
    const result = await runBackupNow();
    return NextResponse.json(result);
  }

  if (body.action === 'test') {
    const saved = await loadBackupConfig();
    const config = {
      host: String(body.host ?? saved?.config.host ?? ''),
      share: String(body.share ?? saved?.config.share ?? ''),
      folder: String(body.folder ?? saved?.config.folder ?? ''),
      username: String(body.username ?? saved?.config.username ?? ''),
      password: body.password ? String(body.password) : saved?.config.password ?? '',
      domain: String(body.domain ?? saved?.config.domain ?? ''),
    };
    if (!config.host || !config.share) return NextResponse.json({ success: false, error: 'Serveur ou partage manquant.' });
    return NextResponse.json(await testSmbConnection(config));
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}
