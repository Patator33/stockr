import { NextRequest } from 'next/server';

export function requireApiKey(req: NextRequest): boolean {
  const key = process.env.N8N_API_KEY;
  if (!key) return false;
  const auth = req.headers.get('Authorization');
  const header = req.headers.get('X-API-Key');
  return auth === `Bearer ${key}` || header === key;
}
