import { Injectable, Logger } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseService } from './firebase.adapter';
import { VeriffWebhookEvent } from '../../domain/entities/veriff-webhook-event.entity';

@Injectable()
export class VeriffWebhookEventRepository {
  private readonly logger = new Logger(VeriffWebhookEventRepository.name);
  private readonly collectionName = 'veriff_webhook_events';

  constructor(private readonly firebaseService: FirebaseService) {}

  async findByPayloadHash(payloadHash: string): Promise<VeriffWebhookEvent | null> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .where('payloadHash', '==', payloadHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return this.mapDoc(doc.id, doc.data());
  }

  async create(record: Omit<VeriffWebhookEvent, 'id'>): Promise<VeriffWebhookEvent> {
    const docRef = this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc();

    const data: VeriffWebhookEvent = {
      ...record,
      id: docRef.id,
      attempts: record.attempts ?? 1,
    };

    await docRef.set(data);
    this.logger.log(
      `Veriff webhook event stored payloadHash=${record.payloadHash} outcome=${record.outcome} id=${data.id}`,
    );
    return data;
  }

  async updateOutcome(
    id: string,
    patch: Partial<
      Pick<
        VeriffWebhookEvent,
        'outcome' | 'wallet' | 'decision' | 'responseSnapshot' | 'transactionHash' | 'processedAt'
      >
    > & { incrementAttempts?: boolean },
  ): Promise<void> {
    const { incrementAttempts, ...fields } = patch;
    const update: Record<string, unknown> = { ...fields };
    if (incrementAttempts) {
      update.attempts = FieldValue.increment(1);
    }

    await this.firebaseService
      .getFirestore()
      .collection(this.collectionName)
      .doc(id)
      .update(update);
  }

  private mapDoc(id: string, data: FirebaseFirestore.DocumentData | undefined): VeriffWebhookEvent {
    const record = data ?? {};
    return {
      id,
      payloadHash: record.payloadHash,
      sessionToken: record.sessionToken,
      veriffEventId: record.veriffEventId,
      wallet: record.wallet,
      decision: record.decision,
      outcome: record.outcome,
      responseSnapshot: record.responseSnapshot ?? {},
      transactionHash: record.transactionHash,
      attempts: record.attempts,
      receivedAt: this.toDate(record.receivedAt),
      processedAt: record.processedAt ? this.toDate(record.processedAt) : undefined,
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
