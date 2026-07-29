import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from './firebase.adapter';
import { StatusType } from '../../domain/entities/admin.entity';
import { WalletStatusCache } from '../../domain/entities/wallet-status-cache.entity';

@Injectable()
export class WalletStatusCacheRepository {
  private readonly logger = new Logger(WalletStatusCacheRepository.name);
  private readonly collectionName = 'wallet_status_cache';

  constructor(private readonly firebaseService: FirebaseService) {}

  async get(wallet: string): Promise<WalletStatusCache | null> {
    const doc = await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc(wallet)
      .get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDoc(doc.id, doc.data());
  }

  async upsert(
    wallet: string,
    patch: { status: StatusType; source: WalletStatusCache['source']; transactionHash?: string },
  ): Promise<void> {
    await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc(wallet)
      .set(
        {
          wallet,
          ...patch,
          updatedAt: new Date(),
        },
        { merge: true },
      );
  }

  private mapDoc(id: string, data: FirebaseFirestore.DocumentData | undefined): WalletStatusCache {
    const record = data ?? {};
    return {
      wallet: id,
      status: record.status,
      source: record.source,
      transactionHash: record.transactionHash,
      updatedAt: this.toDate(record.updatedAt),
    };
  }

  private toDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    return new Date(value as string | number);
  }
}
