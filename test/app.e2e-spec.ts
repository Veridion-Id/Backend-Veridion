import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Keypair } from '@stellar/stellar-sdk';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { StellarService } from '../src/infrastructure/stellar/stellar.service'
import { FailedStellarTxRepository } from '../src/infrastructure/firebase/failed-stellar-tx.repository';
import { FirebaseService } from '../src/infrastructure/firebase/firebase.adapter';

const WALLET = Keypair.random().publicKey();
const SOURCE = Keypair.random().publicKey();

describe('Stellar transaction queue (e2e)', () => {
  let app: INestApplication;
  let submitSpy: jest.Mock;
  let failedTxStore: Map<string, any>;

  const buildWebhookPayload = (sessionToken: string) => ({
    id: 'test-id',
    status: 'APPROVED',
    code: 'APPROVED',
    reason: 'Document verified',
    reasonCode: 'DOCUMENT_VERIFIED',
    sessionToken,
    verification: {
      id: 'verification-id',
      url: 'https://veriff.com/verification/123',
      vendorData: WALLET,
      status: 'APPROVED',
      code: 'APPROVED',
      reason: 'Document verified',
      reasonCode: 'DOCUMENT_VERIFIED',
      person: {
        firstName: 'John',
        lastName: 'Doe',
      },
      document: {
        type: 'PASSPORT',
        number: 'AB123456',
        validFrom: '2020-01-01',
        validUntil: '2030-01-01',
      },
      additionalVerification: {
        status: 'APPROVED',
        reason: 'OK',
      },
    },
    vendorData: WALLET,
    timestamp: new Date().toISOString(),
  });

  beforeEach(async () => {
    failedTxStore = new Map();
    let submitAttempts = 0;

    submitSpy = jest.fn().mockImplementation(async () => {
      submitAttempts += 1;
      if (submitAttempts === 1) {
        return { success: false, attempts: 1, lastError: 'tx_bad_seq' };
      }
      return {
        success: true,
        transactionHash: `hash-${submitAttempts}`,
        attempts: submitAttempts,
      };
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirebaseService)
      .useValue({
        getAuth: jest.fn(),
        getFirestore: jest.fn(),
      })
      .overrideProvider(StellarService)
      .useValue({
        validateWalletAddress: jest.fn().mockReturnValue(true),
        submitVerificationWithRetry: submitSpy,
        buildRegisterTransaction: jest.fn(),
        submitSignedTransaction: jest.fn(),
        buildCreateVerificationTransaction: jest.fn(),
        getAccountSequence: jest.fn(),
        getVerifications: jest.fn(),
        getScore: jest.fn(),
      })
      .overrideProvider(FailedStellarTxRepository)
      .useValue({
        create: jest.fn(async (record: any) => {
          const id = `dl-${failedTxStore.size + 1}`;
          const entry = { id, resolved: false, ...record };
          failedTxStore.set(id, entry);
          return entry;
        }),
        findById: jest.fn(async (id: string) => failedTxStore.get(id) ?? null),
        findUnresolvedByIdempotencyKey: jest.fn(async (key: string) => {
          for (const record of failedTxStore.values()) {
            if (record.idempotencyKey === key && !record.resolved) {
              return record;
            }
          }
          return null;
        }),
        markRetried: jest.fn(async (id: string) => {
          const record = failedTxStore.get(id);
          if (record) record.retriedAt = new Date();
        }),
        markResolved: jest.fn(async (id: string, hash?: string) => {
          const record = failedTxStore.get(id);
          if (record) {
            record.resolved = true;
            record.resolvedAt = new Date();
            if (hash) record.payload.transactionHash = hash;
          }
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Veridion Backend API')
      .setDescription('The Veridion Backend API documentation')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);

    process.env.ADMIN_SOURCE_ACCOUNT = SOURCE;
    process.env.VERIFF_WEBHOOK_SECRET = '';

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('processes two concurrent webhooks for the same wallet without sequence collision', async () => {
    submitSpy.mockReset();
    submitSpy
      .mockResolvedValueOnce({
        success: true,
        transactionHash: 'hash-1',
        attempts: 1,
      })
      .mockResolvedValueOnce({
        success: true,
        transactionHash: 'hash-2',
        attempts: 1,
      });

    const payload1 = buildWebhookPayload('session-a');
    const payload2 = buildWebhookPayload('session-b');

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/kyc/veriff/webhook')
        .set('x-veriff-signature', 'sha256=test')
        .send(payload1),
      request(app.getHttpServer())
        .post('/kyc/veriff/webhook')
        .set('x-veriff-signature', 'sha256=test')
        .send(payload2),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res2.body.success).toBe(true);
    expect(submitSpy).toHaveBeenCalledTimes(2);
  });

  it('succeeds when tx_bad_seq is recovered on internal retry', async () => {
    submitSpy.mockReset();
    submitSpy.mockResolvedValue({
      success: true,
      transactionHash: 'hash-after-retry',
      attempts: 2,
    });

    const payload = buildWebhookPayload('session-retry');

    const response = await request(app.getHttpServer())
      .post('/kyc/veriff/webhook')
      .set('x-veriff-signature', 'sha256=test')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('POST /admin/stellar/retry/:id returns transaction hash on success', async () => {
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${WALLET}:upsert_verification:session-retry-admin`)
      .digest('hex');

    failedTxStore.set('dl-1', {
      id: 'dl-1',
      wallet: WALLET,
      operation: 'upsert_verification',
      payload: { status: 'APPROVED', sourceAccount: SOURCE },
      idempotencyKey,
      attempts: 5,
      lastError: 'tx_bad_seq',
      resolved: false,
      createdAt: new Date(),
    });

    submitSpy.mockReset();
    submitSpy.mockResolvedValue({
      success: true,
      transactionHash: 'hash-admin-retry',
      attempts: 1,
    });

    const response = await request(app.getHttpServer())
      .post('/admin/stellar/retry/dl-1')
      .send();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.transactionHash).toBe('hash-admin-retry');
  });

  it('POST /admin/stellar/retry/:id returns 404 for unknown id', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/stellar/retry/unknown-id')
      .send();

    expect(response.status).toBe(404);
  });

  it('POST /admin/stellar/retry/:id returns 409 when already resolved', async () => {
    failedTxStore.set('dl-resolved', {
      id: 'dl-resolved',
      wallet: WALLET,
      operation: 'upsert_verification',
      payload: { status: 'APPROVED', sourceAccount: SOURCE },
      idempotencyKey: 'resolved-key',
      attempts: 1,
      lastError: '',
      resolved: true,
      resolvedAt: new Date(),
      createdAt: new Date(),
    });

    const response = await request(app.getHttpServer())
      .post('/admin/stellar/retry/dl-resolved')
      .send();

    expect(response.status).toBe(409);
  });

  it('exposes retry endpoint in swagger docs', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');

    expect(response.status).toBe(200);
    expect(response.body.paths).toHaveProperty('/admin/stellar/retry/{id}');
  });
});
