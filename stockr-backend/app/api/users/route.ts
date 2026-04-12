import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAction } from '@/lib/audit';

async function requireAdmin(req: NextRequest) {
  const userId = await requireAuth(req);
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me || me.role !== 'admin') throw new Error('Forbidden');
  return me;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  let me: { id: string; email: string; role: string };
  try {
    me = await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
  }

  const { email, password, role } = await req.json() as { email: string; password: string; role?: string };
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Email et mot de passe requis (6 caractères min)' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: role === 'admin' ? 'admin' : 'user' },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  await logAction(me.id, me.email, 'user.create', `Créé: ${email} (${user.role})`);
  return NextResponse.json(user, { status: 201 });
}
