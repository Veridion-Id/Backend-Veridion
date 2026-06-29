export interface FailedStellarTx {
  id: string;
  wallet: string;
  operation: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  attempts: number;
  lastError: string;
  resolved: boolean;
  createdAt: Date;
  retriedAt?: Date;
  resolvedAt?: Date;
}

export interface RetryStellarTxResponse {
  success: boolean;
  message?: string;
  transactionHash?: string;
  error?: string;
}

export interface SubmitVerificationResult {
  success: boolean;
  transactionHash?: string;
  attempts: number;
  lastError?: string;
  skipped?: boolean;
  message?: string;
  alreadyRegistered?: boolean;
}
