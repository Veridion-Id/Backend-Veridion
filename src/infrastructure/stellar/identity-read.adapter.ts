import { Injectable } from '@nestjs/common';
import { IdentityReadPort } from '../../domain/ports/identity-read.port';
import { StellarService } from './stellar.service';

/**
 * Thin adapter that satisfies IdentityReadPort by delegating to the
 * existing StellarService.  
 */
@Injectable()
export class IdentityReadAdapter implements IdentityReadPort {
  constructor(private readonly stellarService: StellarService) { }

  getScore(wallet: string): Promise<number> {
    return this.stellarService.getScore(wallet);
  }

  validateWalletAddress(wallet: string): boolean {
    return this.stellarService.validateWalletAddress(wallet);
  }
}
