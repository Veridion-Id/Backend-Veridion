import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Veriff webhook decision types
export enum VeriffDecision {
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  RESUBMISSION_REQUESTED = 'RESUBMISSION_REQUESTED'
}

// Veriff webhook payload structure
export class VeriffWebhookDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  reasonCode: string;

  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @IsString()
  @IsNotEmpty()
  verification: {
    id: string;
    url: string;
    vendorData: string;
    status: string;
    code: string;
    reason: string;
    reasonCode: string;
    person: {
      firstName: string;
      lastName: string;
    };
    document: {
      type: string;
      number: string;
      validFrom: string;
      validUntil: string;
    };
    additionalVerification: {
      status: string;
      reason: string;
    };
  };

  @IsString()
  @IsNotEmpty()
  vendorData: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}

// Response for webhook processing
export interface VeriffWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
  status?: string;
  wallet?: string;
}

// Veriff configuration
export interface VeriffConfig {
  webhookSecret: string;
  baseUrl: string;
  apiKey: string;
}
