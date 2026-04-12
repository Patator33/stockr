import { prisma } from './prisma';

export async function logAction(
  userId: string | null,
  userEmail: string | null,
  action: string,
  details?: string,
) {
  try {
    await prisma.auditLog.create({
      data: { userId, userEmail, action, details: details ?? null },
    });
  } catch { /* non-blocking — never fail the main operation */ }
}
