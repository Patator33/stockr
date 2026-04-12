'use client';

const TOKEN_KEY = 'stockr_web_token';

export function getWebToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setWebToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearWebToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function wFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getWebToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { ...options, headers });
}

export async function wGet<T>(path: string): Promise<T> {
  const res = await wFetch(path);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function wPost<T>(path: string, body: unknown): Promise<T> {
  const res = await wFetch(path, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

export async function wPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await wFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

export async function wDel(path: string): Promise<void> {
  const res = await wFetch(path, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${res.status}`);
  }
}
