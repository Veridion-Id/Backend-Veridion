export type VeriffWebhookOutcome =
  | 'PROCESSED'
  | 'REJECTED_NO_WALLET'
  | 'REJECTED_STALE'
  | 'FAILED_UPDATE';

export interface VeriffWebhookEvent {
  id: string;
  payloadHash: string; // sha256 hex of the exact JSON string that was HMAC-signed
  sessionToken: string;
  veriffEventId: string; // webhookData.id from Veriff
  wallet?: string;
  decision?: string; // mapped StatusType once known (APPROVED/PENDING/REJECTED)
  outcome: VeriffWebhookOutcome;
  responseSnapshot: Record<string, unknown>; // the VeriffWebhookResponse body returned to Veriff, cached for replay/duplicate responses
  transactionHash?: string;
  attempts: number; // increments each time a FAILED_UPDATE event is reprocessed
  receivedAt: Date;
  processedAt?: Date;
}
