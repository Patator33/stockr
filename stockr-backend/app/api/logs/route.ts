import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  let userId: string;
  try { userId = await requireAuth(req); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get('limit') || '100'), 500);
  const offset = Number(searchParams.get('offset') || '0');

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({ logs, total, limit, offset });
}
