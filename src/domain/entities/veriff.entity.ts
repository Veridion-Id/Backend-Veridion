import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum VeriffDecision {
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  RESUBMISSION_REQUESTED = 'RESUBMISSION_REQUESTED',
}

export class VeriffPersonDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;
}

export class VeriffDocumentDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  validFrom: string;

  @IsString()
  @IsNotEmpty()
  validUntil: string;
}

export class VeriffAdditionalVerificationDto {
  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class VeriffVerificationDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  vendorData: string;

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

  @ValidateNested()
  @Type(() => VeriffPersonDto)
  person: VeriffPersonDto;

  @ValidateNested()
  @Type(() => VeriffDocumentDto)
  document: VeriffDocumentDto;

  @ValidateNested()
  @Type(() => VeriffAdditionalVerificationDto)
  additionalVerification: VeriffAdditionalVerificationDto;
}

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

  @ValidateNested()
  @Type(() => VeriffVerificationDto)
  verification: VeriffVerificationDto;

  @IsString()
  @IsNotEmpty()
  vendorData: string;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}

export interface VeriffWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
  status?: string;
  wallet?: string;
}

export interface VeriffConfig {
  webhookSecret: string;
  baseUrl: string;
  apiKey: string;
}
