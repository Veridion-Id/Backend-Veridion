import { Injectable } from '@nestjs/common'
import { StellarService } from '../../infrastructure/stellar/stellar.service'

export interface HealthStatusResponse {
  status: 'ok' | 'degraded'
  service: string
  timestamp: string
  stellar: {
    network: string
    reachable: boolean
    error?: string
  }
}

@Injectable()
export class HealthService {
  constructor(private readonly stellarService: StellarService) {}

  async getHealth(): Promise<HealthStatusResponse> {
    const stellar = await this.stellarService.checkNetworkReachability()

    return {
      status: stellar.reachable ? 'ok' : 'degraded',
      service: 'backend-veridion',
      timestamp: new Date().toISOString(),
      stellar,
    }
  }
}
