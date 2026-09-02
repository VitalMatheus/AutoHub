import { AuditActorType } from '@prisma/client';
import { AuditAction, AuditTargetType } from './dto/list-audit-events.dto';
import { AuditEventsService } from './audit-events.service';

describe('AuditEventsService', () => {
  it('persists only allowlisted change fields and snapshots the human actor', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'event-1' });
    const service = new AuditEventsService({} as never);
    await service.record({ auditEvent: { create } } as never, {
      id: 'user-1', name: 'Operator', email: 'operator@example.com', role: 'SUPER_ADMIN', organizationId: null,
    }, {
      action: AuditAction.ORGANIZATION_UPDATED, targetType: AuditTargetType.ORGANIZATION, targetId: 'org-1',
      before: { name: 'Old', passwordHash: 'secret' }, after: { name: 'New', activationToken: 'token' },
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorType: AuditActorType.USER, actorUserId: 'user-1', actorName: 'Operator', actorEmail: 'operator@example.com',
      before: { name: 'Old' }, after: { name: 'New' },
    }) }));
  });

  it('records SYSTEM events without a user snapshot', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'event-2' });
    const service = new AuditEventsService({} as never);

    await service.record({ auditEvent: { create } } as never, null, {
      action: AuditAction.ORGANIZATION_CREATED,
      targetType: AuditTargetType.ORGANIZATION,
      targetId: 'org-1',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorType: AuditActorType.SYSTEM,
      actorName: null,
      actorEmail: null,
    }) }));
  });

  it('uses occurredAt and id together to continue cursor pagination', async () => {
    const first = new Date('2026-09-01T12:00:00.000Z');
    const second = first;
    const findMany = jest.fn().mockResolvedValue([
      { id: '00000000-0000-4000-8000-000000000002', occurredAt: first, actorType: AuditActorType.SYSTEM, actorUserId: null, actorName: null, actorEmail: null, action: AuditAction.ORGANIZATION_CREATED, targetType: AuditTargetType.ORGANIZATION, targetId: 'org-2', commercialAccountId: null, organizationId: 'org-2', reason: null, before: null, after: null },
      { id: '00000000-0000-4000-8000-000000000001', occurredAt: second, actorType: AuditActorType.SYSTEM, actorUserId: null, actorName: null, actorEmail: null, action: AuditAction.ORGANIZATION_CREATED, targetType: AuditTargetType.ORGANIZATION, targetId: 'org-1', commercialAccountId: null, organizationId: 'org-1', reason: null, before: null, after: null },
    ]);
    const service = new AuditEventsService({ auditEvent: { findMany } } as never);

    const result = await service.list({ pageSize: 1 } as any);
    await service.list({ pageSize: 1, cursor: result.meta.nextCursor } as any);

    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ OR: [{ occurredAt: { lt: first } }, { occurredAt: first, id: { lt: '00000000-0000-4000-8000-000000000002' } }] }),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 2,
    }));
  });

  it('rejects cursors whose tie-breaker is not a UUID', async () => {
    const service = new AuditEventsService({ auditEvent: { findMany: jest.fn() } } as never);
    const cursor = Buffer.from(JSON.stringify({ occurredAt: '2026-09-01T12:00:00.000Z', id: 'event-1' })).toString('base64url');

    await expect(service.list({ pageSize: 1, cursor } as any)).rejects.toMatchObject({ status: 400 });
  });
});
