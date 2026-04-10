import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { NextRequest } from 'next/server';

const SESSION_COOKIE = 'stockr_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'changez_moi_par_une_cle_de_64_caracteres_aleatoires_xxxxxxxxxxx';

function signToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');
  return `${payload}`;
}

function verifyToken(token: string): { userId: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (!parsed.userId) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = signToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(req?: NextRequest): Promise<string> {
  // Mobile: Bearer token in Authorization header
  if (req) {
    const auth = req.headers.get('Authorization');
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const parsed = verifyToken(token);
      if (!parsed) throw new Error('Unauthorized');
      const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
      if (!user) throw new Error('Unauthorized');
      return parsed.userId;
    }
  }
  // Cookie session
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Error('Unauthorized');
  return session.userId;
}
