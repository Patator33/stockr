import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  // Le mot de passe SMB ne doit jamais quitter le serveur.
  map.backup_smb_password_set = map.backup_smb_password ? 'true' : 'false';
  delete map.backup_smb_password;
  return NextResponse.json(map);
}

export async function PATCH(req: NextRequest) {
  let userId: string;
  try { userId = await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const body = await req.json();
  const touchesBackup = Object.keys(body).some(k => k.startsWith('backup_'));
  if (touchesBackup) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'admin') return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
  }
  const results: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    // Champs d'état en lecture seule ; mot de passe vide = conserver l'existant.
    if (['backup_last_run', 'backup_last_status', 'backup_last_error', 'backup_smb_password_set'].includes(key)) continue;
    if (key === 'backup_smb_password' && value === '') continue;
    if (key === 'backup_smb_password') {
      await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
      continue;
    }
    const s = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
    results[s.key] = s.value;
  }
  return NextResponse.json(results);
}
