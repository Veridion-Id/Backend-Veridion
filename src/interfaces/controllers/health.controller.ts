import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import {
  HealthService,
  HealthStatusResponse,
} from '../../application/services/health.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get service and Stellar network health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
  })
  async getHealth(): Promise<HealthStatusResponse> {
    return this.healthService.getHealth()
  }
}
