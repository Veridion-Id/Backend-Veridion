import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IntegratorApiKeyGuard } from './integrator-api-key.guard';

// ── Helper ────────────────────────────────────────────────────────────────────

function buildContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IntegratorApiKeyGuard', () => {
  let guard: IntegratorApiKeyGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegratorApiKeyGuard,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<IntegratorApiKeyGuard>(IntegratorApiKeyGuard);
    configService = module.get(ConfigService);
  });

  it('allows the request when the correct Bearer token is provided', () => {
    configService.get.mockReturnValue('secret-key');

    const result = guard.canActivate(buildContext('Bearer secret-key'));

    expect(result).toBe(true);
  });

  it('throws 401 when the Authorization header is absent', () => {
    configService.get.mockReturnValue('secret-key');

    expect(() => guard.canActivate(buildContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when the Authorization header does not start with Bearer', () => {
    configService.get.mockReturnValue('secret-key');

    expect(() =>
      guard.canActivate(buildContext('Basic secret-key')),
    ).toThrow(UnauthorizedException);
  });

  it('throws 401 when the provided token is wrong', () => {
    configService.get.mockReturnValue('secret-key');

    expect(() =>
      guard.canActivate(buildContext('Bearer wrong-token')),
    ).toThrow(UnauthorizedException);
  });

  it('trims whitespace around the token after stripping the Bearer prefix', () => {
    configService.get.mockReturnValue('secret-key');

    // "Bearer  secret-key" — .trim() strips the leading space, so it matches
    const result = guard.canActivate(buildContext('Bearer  secret-key'));
    expect(result).toBe(true);
  });

  it('throws 401 when INTEGRATOR_API_KEY is not configured on the server', () => {
    configService.get.mockReturnValue(undefined);

    expect(() =>
      guard.canActivate(buildContext('Bearer anything')),
    ).toThrow(UnauthorizedException);
  });

  it('strips "Bearer " prefix correctly and accepts exact match', () => {
    const key = 'my-integrator-key-abc123';
    configService.get.mockReturnValue(key);

    const result = guard.canActivate(buildContext(`Bearer ${key}`));

    expect(result).toBe(true);
  });
});
