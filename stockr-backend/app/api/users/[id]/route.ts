import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';

async function requireAdmin(req: NextRequest) {
  const userId = await requireAuth(req);
  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me || me.role !== 'admin') throw new Error('Forbidden');
  return me;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let me: { id: string; email: string; role: string };
  try {
    me = await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
  }

  const { id } = await params;
  const { role } = await req.json() as { role: string };
  if (role !== 'admin' && role !== 'user') {
    return NextResponse.json({ error: 'Rôle invalide (admin ou user)' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  await logAction(me.id, me.email, 'user.role_change', `${target.email}: ${target.role} → ${role}`);
  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let me: { id: string; email: string; role: string };
  try {
    me = await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 });
  }

  const { id } = await params;
  if (id === me.id) {
    return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  await logAction(me.id, me.email, 'user.delete', `Supprimé: ${target.email}`);
  return NextResponse.json({ ok: true });
}
