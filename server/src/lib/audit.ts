import { prisma } from './prisma';

export interface AuditLogParams {
  adminId?: string | null;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: any;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId || null,
        adminUsername: params.adminUsername,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId || null,
        details: params.details || null,
      },
    });
  } catch (err) {
    console.error('Failed to create audit log entry:', err);
  }
}
