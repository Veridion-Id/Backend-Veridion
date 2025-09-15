import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ApiKeyRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(56, 56, { message: 'Wallet address must be exactly 56 characters' })
  wallet: string;
}

export interface ApiKeyResponse {
  success: boolean;
  message?: string;
  apiKey?: string;
  isHuman?: boolean;
  score?: number;
  error?: string;
}
