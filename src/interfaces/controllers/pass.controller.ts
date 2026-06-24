import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

@ApiTags('pass')
@Controller('pass')
export class PassController {
  @Get()
  @ApiOperation({ summary: 'Passport route group status' })
  @ApiResponse({
    status: 200,
    description: 'Pass route group is available',
  })
  getPassInfo() {
    return {
      group: 'pass',
      status: 'available',
      message: 'Identity endpoints will be available in upcoming releases',
      timestamp: new Date().toISOString(),
    }
  }
}
