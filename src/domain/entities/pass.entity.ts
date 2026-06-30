import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePassDto {
  @ApiProperty({ description: 'Wallet address', example: 'GABC...' })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'wallet must be a valid Stellar G address' })
  wallet: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name: string;

  @ApiProperty({ description: 'Surnames', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  surnames: string;

  @ApiProperty({ description: 'Source account (Stellar G address)', example: 'GABC...' })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'sourceAccount must be a valid Stellar G address' })
  sourceAccount: string;
}

export class UpdateProfileDto {
  @ApiProperty({ description: 'Wallet address', example: 'GABC...' })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'wallet must be a valid Stellar G address' })
  wallet: string; // <-- Added this to fix the TS errors

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  name: string;

  @ApiProperty({ description: 'Surnames', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  surnames: string;

  @ApiProperty({ description: 'Source account (Stellar G address)', example: 'GABC...' })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'sourceAccount must be a valid Stellar G address' })
  sourceAccount: string;
}

export interface CreatePassResponse {
  success: boolean;
  alreadyRegistered?: boolean;
  skipped?: boolean;
  message: string;
  transactionHash?: string;
  sourceAccount?: string;
  error?: string;
}

export interface CreatePassOptions {
  idempotencyKey?: string;
  sessionToken?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  skipped?: boolean;
  message: string;
  transactionHash?: string;
  sourceAccount?: string;
  error?: string;
}

export interface UpdateProfileOptions {
  idempotencyKey?: string;
  sessionToken?: string;
}

export interface GetPassResponse {
  registered: boolean;
  wallet?: string;
  name?: string;
  surnames?: string;
  score?: number;
  verifications?: any[];
  status?: string;
}
