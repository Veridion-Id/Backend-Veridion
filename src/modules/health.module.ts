import { Module } from '@nestjs/common'
import { HealthController } from '../interfaces/controllers/health.controller'
import { HealthService } from '../application/services/health.service'
import { PlatformModule } from './platform.module'

@Module({
  imports: [PlatformModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
