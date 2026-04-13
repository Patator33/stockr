import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

function getDbPath(): string {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  const filePath = url.replace(/^file:/, '');
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

// GET /api/backup — download the SQLite database file
export async function GET(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: 'Base de données introuvable' }, { status: 404 });
  }
  const buffer = fs.readFileSync(dbPath);
  const date   = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="stockr_backup_${date}.db"`,
    },
  });
}

// POST /api/backup — restore from an uploaded SQLite file
export async function POST(req: NextRequest) {
  try { await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const dbPath = getDbPath();
  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // Validate SQLite magic bytes
  if (buffer.length < 16 || buffer.slice(0, 6).toString('utf8') !== 'SQLite') {
    return NextResponse.json({ error: 'Fichier invalide (non SQLite)' }, { status: 400 });
  }
  // Write backup of current DB first
  const backupPath = dbPath + '.bak';
  if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, backupPath);
  fs.writeFileSync(dbPath, buffer);
  return NextResponse.json({ ok: true, message: 'Base restaurée. Redémarrez le serveur pour appliquer.' });
}
