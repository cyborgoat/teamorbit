import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CleanupSettingsDto {
  @ApiProperty() enabled: boolean;
  @ApiProperty() intervalHours: number;
  @ApiProperty() graceHours: number;
}

export class CleanupAssetDto {
  @ApiProperty() path: string;
  @ApiProperty() size: number;
  @ApiProperty({ enum: ['ACTIVE', 'DELETING'] }) state: string;
  @ApiProperty() unreferencedAt: Date;
  @ApiProperty() eligibleAt: Date;
  @ApiProperty() eligible: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) error: string | null;
}

export class CleanupRunDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['manual', 'scheduled'] }) trigger: string;
  @ApiPropertyOptional({ type: String, nullable: true }) actorId: string | null;
  @ApiProperty({ enum: ['RUNNING', 'COMPLETED', 'FAILED'] }) status: string;
  @ApiProperty() startedAt: Date;
  @ApiPropertyOptional({ type: Date, nullable: true }) finishedAt: Date | null;
  @ApiProperty() deletedCount: number;
  @ApiProperty() deletedBytes: number;
  @ApiProperty() failedCount: number;
  @ApiPropertyOptional({ type: String, nullable: true }) error: string | null;
}

export class CleanupPreviewDto {
  @ApiProperty({ type: [CleanupAssetDto] }) items: CleanupAssetDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() orphanBytes: number;
  @ApiProperty() eligibleCount: number;
  @ApiProperty() reclaimableBytes: number;
  @ApiProperty({ type: CleanupSettingsDto }) settings: CleanupSettingsDto;
  @ApiProperty({ type: CleanupRunDto, nullable: true })
  lastRun: CleanupRunDto | null;
}

export class CleanupStartedDto {
  @ApiProperty() id: string;
}
