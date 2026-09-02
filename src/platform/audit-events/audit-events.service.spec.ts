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
});
