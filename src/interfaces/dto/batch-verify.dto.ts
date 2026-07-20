import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  IsString,
  ArrayMaxSize,
} from 'class-validator';

export class BatchVerifyRequestDto {
  @ApiProperty({
    description: 'List of Stellar wallet addresses to verify.',
    example: [
      'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB',
      'GDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890DE',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'wallets must not be empty' })
  @ArrayMaxSize(100, {
    message: 'wallets must not exceed the configured maximum (default 25)',
  })
  @IsString({ each: true })
  wallets: string[];
}

// ── Response shapes ──────────────────────────────────────────────────────────

export class WalletResultDto {
  @ApiProperty({ example: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB' })
  wallet: string;

  @ApiProperty({ example: true })
  registered: boolean;

  @ApiProperty({ example: 42 })
  score: number;

  @ApiProperty({ example: true })
  isHuman: boolean;
}

export class BatchVerifyResponseDto {
  @ApiProperty({ type: [WalletResultDto] })
  results: WalletResultDto[];

  @ApiProperty({ example: 35, description: 'Score threshold used to determine isHuman.' })
  threshold: number;

  @ApiProperty({ example: 2, description: 'Number of wallets successfully processed.' })
  processed: number;

  @ApiProperty({ example: 0, description: 'Number of invalid wallet addresses skipped.' })
  invalid: number;
}
