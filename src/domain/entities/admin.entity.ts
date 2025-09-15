import { IsString, IsNotEmpty, Length } from 'class-validator';

// Build phase DTOs
export class BuildRegisterTransactionDto {
  @IsString()
  @IsNotEmpty()
  @Length(56, 56, { message: 'Wallet address must be exactly 56 characters' })
  wallet: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  surnames: string;

  @IsString()
  @IsNotEmpty()
  @Length(56, 56, { message: 'Source account must be exactly 56 characters' })
  sourceAccount: string;
}

export interface BuildRegisterTransactionResponse {
  success: boolean;
  message?: string;
  xdr?: string;
  sourceAccount?: string;
  sequence?: string;
  fee?: string;
  timebounds?: {
    minTime: string;
    maxTime: string;
  };
  footprint?: string;
  error?: string;
}

// Submit phase DTOs
export class SubmitSignedTransactionDto {
  @IsString()
  @IsNotEmpty()
  signedXdr: string;
}

export interface SubmitSignedTransactionResponse {
  success: boolean;
  message?: string;
  transactionHash?: string;
  resultMeta?: string;
  error?: string;
}