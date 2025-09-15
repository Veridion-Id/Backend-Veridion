import { Test, TestingModule } from '@nestjs/testing'
import { AppService } from './app.service'

describe('AppService', () => {
  let service: AppService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile()

    service = module.get<AppService>(AppService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return app info', () => {
    const result = service.getAppInfo()
    expect(result).toHaveProperty('name', 'Veridion Backend API')
    expect(result).toHaveProperty('version', '1.0.0')
    expect(result).toHaveProperty('description')
    expect(result).toHaveProperty('timestamp')
  })
})
