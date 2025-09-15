import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getAppInfo() {
    return {
      name: 'Veridion Backend API',
      version: '1.0.0',
      description: 'The Veridion Backend API',
      timestamp: new Date().toISOString(),
    }
  }
}
