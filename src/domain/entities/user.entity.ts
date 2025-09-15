export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly kycStatus: KycStatus,
    public readonly createdAt: Date,
  ) {}

  isKycVerified(): boolean {
    return this.kycStatus === KycStatus.VERIFIED
  }
}

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}
