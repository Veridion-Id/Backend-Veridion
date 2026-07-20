import type { Verification } from '../../../packages/stellar-passport/src'

export interface PassportRegisterParams {
  wallet: string
  name: string
  surnames: string
  sourceAccount: string
}

export interface PassportUpsertVerificationParams {
  wallet: string
  verification: Verification
  sourceAccount: string
}

export interface PassportUpdateProfileParams {
  wallet: string
  name: string
  surnames: string
  sourceAccount: string
}

export interface PassportTransactionResult {
  success: boolean
  xdr?: string
  sourceAccount?: string
  sequence?: string
  fee?: string
  timebounds?: {
    minTime: string
    maxTime: string
  }
  footprint?: string
  error?: string
}

export interface PassportPort {
  register(params: PassportRegisterParams): Promise<PassportTransactionResult>
  getScore(wallet: string): Promise<number>
  getVerifications(wallet: string): Promise<Verification[]>
  upsertVerification(
    params: PassportUpsertVerificationParams,
  ): Promise<PassportTransactionResult>
  updateProfile(
    params: PassportUpdateProfileParams,
  ): Promise<PassportTransactionResult>
}
