import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from '../../infrastructure/stellar/stellar.service';

export interface VerificationView {
  issuer: string;
  points: number;
  timestamp: string;
  vtype: any;
}

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(private readonly stellarService: StellarService) {}

  async getScore(wallet: string): Promise<{ score?: number; success: boolean; message: string }> {
    try {
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return { success: false, message: 'Invalid wallet address format' };
      }
      const score = await this.stellarService.getScore(wallet);
      return { success: true, score, message: 'Score retrieved successfully' };
    } catch (error) {
      this.logger.error(`Failed to get score for wallet: ${wallet}`, error);
      return { success: false, message: `Failed to get score: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async getVerifications(wallet: string): Promise<{ verifications?: VerificationView[]; success: boolean; message: string }> {
    try {
      if (!this.stellarService.validateWalletAddress(wallet)) {
        return { success: false, message: 'Invalid wallet address format' };
      }
      const verifications = await this.stellarService.getVerifications(wallet);
      const views: VerificationView[] = verifications.map(v => ({
        issuer: v.issuer,
        points: Number(v.points),
        timestamp: v.timestamp.toString(),
        vtype: v.vtype,
      }));
      return { success: true, verifications: views, message: 'Verifications retrieved successfully' };
    } catch (error) {
      this.logger.error(`Failed to get verifications for wallet: ${wallet}`, error);
      return { success: false, message: `Failed to get verifications: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async isHuman(wallet: string): Promise<{ isHuman?: boolean; score?: number; success: boolean; message: string }> {
    try {
      const scoreRes = await this.getScore(wallet);
      if (!scoreRes.success) {
        return { success: false, message: scoreRes.message };
      }
      const score = scoreRes.score || 0;
      const isHuman = score >= 50;
      return { success: true, isHuman, score, message: 'Human check completed' };
    } catch (error) {
      return { success: false, message: `Failed to check human: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async isHumanNS(wallet: string): Promise<{ isHuman?: boolean; success: boolean; message: string }> {
    try {
      const verRes = await this.getVerifications(wallet);
      if (!verRes.success) {
        return { success: false, message: verRes.message };
      }
      const isHuman = verRes.verifications?.some(v => v.vtype?.tag === 'BrightID' || v.vtype?.tag === 'WorldID') || false;
      return { success: true, isHuman, message: 'Human check (no score) completed' };
    } catch (error) {
      return { success: false, message: `Failed to check human: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
}
