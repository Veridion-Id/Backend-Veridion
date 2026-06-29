import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard that validates the shared integrator API key supplied via the
 * `Authorization: Bearer <INTEGRATOR_API_KEY>` header.
 *
 * Configuration:
 *   INTEGRATOR_API_KEY — the expected token (env var, required)
 *
 * Returns 401 when:
 *  - The Authorization header is absent or malformed
 *  - The provided token does not match INTEGRATOR_API_KEY
 *  - INTEGRATOR_API_KEY is not configured
 */
@Injectable()
export class IntegratorApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.configService.get<string>('INTEGRATOR_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException(
        'INTEGRATOR_API_KEY is not configured on the server.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or malformed Authorization header. Expected: Bearer <token>',
      );
    }

    const providedKey = authHeader.slice('Bearer '.length).trim();

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key.');
    }

    return true;
  }
}
