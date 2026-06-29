/**
 * Per-wallet result returned in a batch verification response.
 */
export interface WalletResult {
  /** The Stellar wallet address that was checked. */
  wallet: string;
  /** Whether the wallet is registered in the Veridion smart contract. */
  registered: boolean;
  /** The wallet's identity score (0 if not registered). */
  score: number;
  /** Whether the wallet's score meets the configured human threshold. */
  isHuman: boolean;
}

/**
 * Full response payload for a batch verification request.
 */
export interface BatchVerifyResult {
  /** Per-wallet verification results (only valid addresses are included). */
  results: WalletResult[];
  /** The score threshold used to determine isHuman. */
  threshold: number;
  /** Number of wallets that were successfully processed. */
  processed: number;
  /** Number of wallet addresses that were skipped due to invalid format. */
  invalid: number;
}
