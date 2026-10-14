import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey } from '@/lib/apiKey';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Ordre des étapes : un mail en retard (ex. "en transit" reçu après "livré") ne fait pas reculer le statut.
const RANK: Record<string, number> = { deposited: 1, in_transit: 2, delivered: 3 };

const normalize = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

// POST /api/orders/tracking-update  { trackingRef, status, detail? }  — appelé par n8n (clé API)
export async function POST(req: NextRequest) {
  if (!requireApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { trackingRef?: string; status?: string; detail?: string } | null;
  const ref = body?.trackingRef ? normalize(String(body.trackingRef)) : '';
  const status = body?.status ? String(body.status) : '';
  if (ref.length < 6 || !RANK[status]) {
    return NextResponse.json({ error: 'trackingRef et status (deposited | in_transit | delivered) requis' }, { status: 400 });
  }

  // Égalité exacte sur la valeur normalisée (espaces, casse, ponctuation ignorés).
  // Repli : le code-barre scanné peut porter des caractères en plus (le numéro Colissimo
  // est alors contenu dedans) — accepté seulement s'il est long (>= 10) et sans ambiguïté.
  const candidates = await prisma.order.findMany({ where: { trackingRef: { not: null } }, select: { id: true, trackingRef: true, deliveryStatus: true } });
  const exact = candidates.filter(o => normalize(o.trackingRef!) === ref);
  const matches = exact.length > 0
    ? exact
    : ref.length >= 10
      ? candidates.filter(o => { const t = normalize(o.trackingRef!); return t.length >= 10 && (t.includes(ref) || ref.includes(t)); })
      : [];
  if (matches.length === 0) return NextResponse.json({ updated: 0, reason: 'Aucune commande avec ce numéro de suivi' });
  if (matches.length > 1) {
    return NextResponse.json({ updated: 0, reason: 'Plusieurs commandes correspondent : mise à jour refusée' }, { status: 409 });
  }

  let updated = 0;
  for (const o of matches) {
    if (o.deliveryStatus && (RANK[o.deliveryStatus] ?? 0) > RANK[status]) continue;
    await prisma.order.update({
      where: { id: o.id },
      data: { deliveryStatus: status, deliveryDetail: body?.detail ? String(body.detail).slice(0, 120) : null, deliveryUpdatedAt: new Date() },
    });
    updated++;
  }
  return NextResponse.json({ updated, matched: matches.length });
}
