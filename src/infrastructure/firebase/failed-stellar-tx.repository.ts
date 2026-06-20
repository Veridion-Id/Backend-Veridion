import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from './firebase.adapter';
import { FailedStellarTx } from '../../domain/entities/failed-stellar-tx.entity';

@Injectable()
export class FailedStellarTxRepository {
  private readonly logger = new Logger(FailedStellarTxRepository.name);
  private readonly collectionName = 'stellar_failed_txs';

  constructor(private readonly firebaseService: FirebaseService) {}

  async create(record: Omit<FailedStellarTx, 'id'>): Promise<FailedStellarTx> {
    const docRef = this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc();

    const data: FailedStellarTx = {
      id: docRef.id,
      resolved: false,
      ...record,
    };

    await docRef.set(data);
    this.logger.warn(
      `Dead-letter stored for wallet=${record.wallet} operation=${record.operation} id=${data.id}`,
    );
    return data;
  }

  async findById(id: string): Promise<FailedStellarTx | null> {
    const doc = await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc(id)
      .get();

    if (!doc.exists) {
      return null;
    }

    return this.mapDoc(doc.id, doc.data());
  }

  async findUnresolvedByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<FailedStellarTx | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .where('idempotencyKey', '==', idempotencyKey)
      .where('resolved', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.mapDoc(doc.id, doc.data());
  }

  async markRetried(id: string): Promise<void> {
    await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc(id)
      .update({ retriedAt: new Date() });
  }

  async markResolved(id: string, transactionHash?: string): Promise<void> {
    const update: Record<string, unknown> = {
      resolved: true,
      resolvedAt: new Date(),
    };
    if (transactionHash) {
      update['payload.transactionHash'] = transactionHash;
    }

    await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc(id)
      .update(update);
  }

  private mapDoc(id: string, data: FirebaseFirestore.DocumentData | undefined): FailedStellarTx {
    const record = data ?? {};
    return {
      id,
      wallet: record.wallet,
      operation: record.operation,
      payload: record.payload ?? {},
      idempotencyKey: record.idempotencyKey,
      attempts: record.attempts,
      lastError: record.lastError,
      resolved: record.resolved ?? false,
      createdAt: this.toDate(record.createdAt),
      retriedAt: record.retriedAt ? this.toDate(record.retriedAt) : undefined,
      resolvedAt: record.resolvedAt ? this.toDate(record.resolvedAt) : undefined,
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
