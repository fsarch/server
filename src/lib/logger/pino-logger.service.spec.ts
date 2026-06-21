import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from './pino-logger.service';
import { vi } from 'vitest';

// Mock pino
vi.mock('pino', () => ({
  default: {
    pino: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    })),
  },
}));

describe('PinoLogger', () => {
  let service: PinoLogger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PinoLogger],
    }).compile();

    // Use resolve for transient-scoped providers
    service = module.resolve<PinoLogger>(PinoLogger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create instance with section', () => {
    const logger = new PinoLogger('test-section');
    expect(logger).toBeDefined();
  });

  it('should have static Instance', () => {
    expect(PinoLogger.Instance).toBeDefined();
  });
});
