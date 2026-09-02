import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, AuditTargetType } from './list-audit-events.dto';

export class AuditEventActorDto {
  @ApiProperty({ enum: ['USER', 'SYSTEM'] }) type!: 'USER' | 'SYSTEM';
  @ApiProperty({ format: 'uuid', nullable: true }) userId!: string | null;
  @ApiProperty({ nullable: true }) name!: string | null;
  @ApiProperty({ nullable: true }) email!: string | null;
}

export class AuditEventTargetDto {
  @ApiProperty({ enum: AuditTargetType }) type!: AuditTargetType;
  @ApiProperty({ format: 'uuid' }) id!: string;
}

export class AuditEventChangesDto {
  @ApiProperty({ type: Object, nullable: true }) before!: Record<string, unknown> | null;
  @ApiProperty({ type: Object, nullable: true }) after!: Record<string, unknown> | null;
}

export class AuditEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiProperty({ type: AuditEventActorDto }) actor!: AuditEventActorDto;
  @ApiProperty({ enum: AuditAction }) action!: AuditAction;
  @ApiProperty({ type: AuditEventTargetDto }) target!: AuditEventTargetDto;
  @ApiProperty({ format: 'uuid', nullable: true }) commercialAccountId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) organizationId!: string | null;
  @ApiProperty({ nullable: true }) reason!: string | null;
  @ApiProperty({ type: AuditEventChangesDto }) changes!: AuditEventChangesDto;
}

export class AuditEventsMetaDto {
  @ApiProperty() pageSize!: number;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
}

export class AuditEventsResponseDto {
  @ApiProperty({ type: [AuditEventDto] }) data!: AuditEventDto[];
  @ApiProperty({ type: AuditEventsMetaDto }) meta!: AuditEventsMetaDto;
}
