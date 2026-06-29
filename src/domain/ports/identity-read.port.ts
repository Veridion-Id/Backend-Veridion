/**
 * Read-only port for identity data access.
 *
 * Intentionally narrower than PassportPort — exposes only the two
 * operations needed by the batch verification feature and excludes
 * all write/transaction-building methods.
 */
export const IDENTITY_READ_PORT = Symbol('IDENTITY_READ_PORT');

export interface IdentityReadPort {
  /**
   * Retrieve the identity score for a registered wallet.
   * Throws an error containing "User is not registered" when the wallet
   * has no on-chain record.
   */
  getScore(wallet: string): Promise<number>;

  /**
   * Returns true when the address is a valid Stellar public key.
   */
  validateWalletAddress(wallet: string): boolean;
}
