import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum UserStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export interface User {
  walletAddress: string; // acts like an id
  name: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
