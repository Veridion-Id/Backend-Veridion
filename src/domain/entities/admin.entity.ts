import { IsString, IsNotEmpty, Length, IsNumber, Min } from 'class-validator';

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
  authEntries?: any[]; // Authorization entries that need to be signed
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
  rebuiltXdr?: string; // New XDR with updated sequence number
}

// Create verification DTOs
export class BuildCreateVerificationTransactionDto {
  @IsString()
  @IsNotEmpty()
  @Length(56, 56, { message: 'Wallet address must be exactly 56 characters' })
  wallet: string;

  @IsString()
  @IsNotEmpty()
  verificationType: string;

  @IsNumber()
  @Min(0, { message: 'Points must be a non-negative number' })
  points: number;

  @IsString()
  @IsNotEmpty()
  @Length(56, 56, { message: 'Source account must be exactly 56 characters' })
  sourceAccount: string;
}

export interface BuildCreateVerificationTransactionResponse {
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

// API Key DTOs
export interface ApiKeyResponse {
  success: boolean;
  message?: string;
  apiKey?: string;
  error?: string;
}

// Status DTOs
export type StatusType = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface GetStatusResponse {
  success: boolean;
  message?: string;
  status?: StatusType;
  error?: string;
}

export class UpdateStatusDto {
  @IsString()
  @IsNotEmpty()
  status: StatusType;

  @IsString()
  @IsNotEmpty()
  @Length(56, 56, { message: 'Source account must be exactly 56 characters' })
  sourceAccount: string;
}

export interface UpdateStatusResponse {
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