import { StatusType } from './admin.entity';

export interface WalletStatusCache {
  wallet: string; // also the Firestore doc id
  status: StatusType;
  source: 'webhook' | 'admin-update' | 'backfill';
  transactionHash?: string;
  updatedAt: Date;
}
