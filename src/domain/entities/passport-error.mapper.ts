import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * Maps PassportError contract messages to appropriate NestJS HTTP exceptions.
 */
export function mapPassportError(error: any): HttpException {
  const message = error?.message || String(error);
  
  if (message.includes('AlreadyRegistered')) {
    return new ConflictException('Wallet already registered');
  }
  if (message.includes('NotRegistered')) {
    return new NotFoundException('Wallet not registered');
  }
  if (message.includes('Unauthorized')) {
    return new UnauthorizedException('Unauthorized');
  }
  if (message.includes('InvalidPoints')) {
    return new BadRequestException('Invalid points');
  }
  if (message.includes('Overflow')) {
    return new InternalServerErrorException('Overflow error');
  }
  if (message.includes('TooManyVerifications')) {
    return new HttpException('Too many verifications', HttpStatus.TOO_MANY_REQUESTS);
  }
  
  return new InternalServerErrorException(message);
}
