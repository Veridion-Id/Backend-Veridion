import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePassDto {
  @ApiProperty({
    description: 'The wallet to register on-chain',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'wallet must be a valid Stellar public key (G...)',
  })
  wallet: string;

  @ApiProperty({
    description: 'The admin-sponsoring source account',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'sourceAccount must be a valid Stellar public key (G...)',
  })
  sourceAccount: string;

  @ApiProperty({ description: 'Given name of the identity holder', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;

  @ApiProperty({ description: 'Surnames of the identity holder', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  surnames: string;
}

export interface CreatePassResponse {
  success: boolean;
  message: string;
  transactionHash?: string;
  sourceAccount?: string;
  alreadyRegistered?: boolean;
  skipped?: boolean;
  error?: string;
}

export interface CreatePassOptions {
  idempotencyKey?: string;
}
