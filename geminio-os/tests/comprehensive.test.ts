import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PasswordSecurity, RateLimiter } from '@/lib/security-features';
import { ResponseBuilder, RequestLogger } from '@/server/openapi';
import { RevenueCatClient, StripeClient } from '@/lib/payment-integration';
import { GoogleSheetsClient, GitHubClient, SlackClient, NotionClient, MapboxClient } from '@/lib/third-party-integrations';
import { Logger, MonitoringService, DisasterRecoveryManager } from '@/lib/deployment-infrastructure';

describe('Comprehensive Test Suite', () => {
  describe('Security Features', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });
    });

    it('should allow requests within rate limit', () => {
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.isAllowed('user-1')).toBe(true);
      }
    });

    it('should block requests exceeding rate limit', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed('user-1');
      }
      expect(rateLimiter.isAllowed('user-1')).toBe(false);
    });

    it('should hash passwords with a salt and reject incorrect passwords', async () => {
      const firstHash = await PasswordSecurity.hashPassword('correct horse battery staple');
      const secondHash = await PasswordSecurity.hashPassword('correct horse battery staple');
      expect(firstHash).toMatch(/^\$scrypt\$/);
      expect(secondHash).not.toBe(firstHash);
      await expect(PasswordSecurity.verifyPassword('correct horse battery staple', firstHash)).resolves.toBe(true);
      await expect(PasswordSecurity.verifyPassword('incorrect password', firstHash)).resolves.toBe(false);
    });

    it('should track remaining requests', () => {
      rateLimiter.isAllowed('user-1');
      rateLimiter.isAllowed('user-1');
      expect(rateLimiter.getRemainingRequests('user-1')).toBe(8);
    });

    it('should reset rate limit for specific key', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.isAllowed('user-1');
      }
      rateLimiter.reset('user-1');
      expect(rateLimiter.isAllowed('user-1')).toBe(true);
    });
  });

  describe('API Response Building', () => {
    it('should build success response', () => {
      const response = ResponseBuilder.success({ id: 1, name: 'Test' }, 'Success');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1, name: 'Test' });
      expect(response.message).toBe('Success');
    });

    it('should build paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = ResponseBuilder.paginated(data, 1, 20, 100);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.pagination.hasMore).toBe(true);
    });

    it('should build error response', () => {
      const response = ResponseBuilder.error('INVALID_INPUT', 'Invalid input provided');
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('INVALID_INPUT');
    });

    it('should build not found error', () => {
      const response = ResponseBuilder.notFound('User');
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Request Logging', () => {
    let logger: RequestLogger;

    beforeEach(() => {
      logger = new RequestLogger();
    });

    it('should log requests', () => {
      logger.log({
        method: 'GET',
        path: '/api/users',
        statusCode: 200,
        duration: 50,
      });

      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].method).toBe('GET');
    });

    it('should filter logs by user', () => {
      logger.log({ method: 'GET', path: '/api/users', statusCode: 200, duration: 50, userId: 'user-1' });
      logger.log({ method: 'GET', path: '/api/posts', statusCode: 200, duration: 30, userId: 'user-2' });

      const userLogs = logger.getLogsByUser('user-1');
      expect(userLogs.length).toBe(1);
      expect(userLogs[0].userId).toBe('user-1');
    });

    it('should filter error logs', () => {
      logger.log({ method: 'GET', path: '/api/users', statusCode: 200, duration: 50 });
      logger.log({ method: 'GET', path: '/api/posts', statusCode: 500, duration: 30, error: 'Internal error' });

      const errorLogs = logger.getErrorLogs();
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].error).toBe('Internal error');
    });
  });

  describe('Payment Integration', () => {
    it('should validate RevenueCat client initialization', () => {
      expect(() => new RevenueCatClient()).toThrow();
    });

    it('should validate Stripe client initialization', () => {
      expect(() => new StripeClient()).toThrow();
    });
  });

  describe('Third-Party Integrations', () => {
    it('should validate Google Sheets client initialization', () => {
      expect(() => new GoogleSheetsClient()).toThrow();
    });

    it('should validate GitHub client initialization', () => {
      expect(() => new GitHubClient()).toThrow();
    });

    it('should validate Slack client initialization', () => {
      expect(() => new SlackClient()).toThrow();
    });

    it('should validate Notion client initialization', () => {
      expect(() => new NotionClient()).toThrow();
    });

    it('should validate Mapbox client initialization', () => {
      expect(() => new MapboxClient()).toThrow();
    });
  });

  describe('Logging Service', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger();
    });

    afterEach(() => {
      logger.clear();
    });

    it('should log debug messages', () => {
      logger.debug('Debug message', { context: 'test' });
      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('debug');
    });

    it('should log info messages', () => {
      logger.info('Info message');
      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('info');
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('warn');
    });

    it('should log error messages', () => {
      logger.error('Error message', { error: 'test' }, 'stack trace');
      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].stackTrace).toBe('stack trace');
    });

    it('should filter error logs', () => {
      logger.info('Info');
      logger.error('Error 1');
      logger.error('Error 2');

      const errorLogs = logger.getErrorLogs();
      expect(errorLogs.length).toBe(2);
    });
  });

  describe('Monitoring Service', () => {
    let monitoring: MonitoringService;

    beforeEach(() => {
      monitoring = new MonitoringService();
    });

    it('should record metrics', () => {
      monitoring.recordMetric({
        name: 'response_time',
        value: 100,
        unit: 'ms',
      });

      const metrics = monitoring.getMetrics('response_time');
      expect(metrics.length).toBe(1);
      expect(metrics[0].value).toBe(100);
    });

    it('should create alerts', () => {
      monitoring.createAlert({
        id: 'alert-1',
        name: 'High Response Time',
        metric: 'response_time',
        threshold: 1000,
        condition: 'greater_than',
        enabled: true,
        notificationChannels: ['email'],
      });

      const alerts = monitoring.getAlerts();
      expect(alerts.length).toBe(1);
    });
  });

  describe('Disaster Recovery', () => {
    let dr: DisasterRecoveryManager;

    beforeEach(() => {
      dr = new DisasterRecoveryManager();
    });

    it('should create backup', async () => {
      const backup = await dr.createBackup({
        enabled: true,
        frequency: 'daily',
        retention: 30,
        destination: 's3://backups',
      });

      expect(backup.id).toBeDefined();
      expect(backup.createdAt).toBeDefined();
    });

    it('should verify backup', async () => {
      const backup = await dr.createBackup({
        enabled: true,
        frequency: 'daily',
        retention: 30,
        destination: 's3://backups',
      });

      const verified = await dr.verifyBackup(backup.id);
      expect(verified).toBe(true);
    });

    it('should retrieve backups', async () => {
      await dr.createBackup({
        enabled: true,
        frequency: 'daily',
        retention: 30,
        destination: 's3://backups',
      });

      const backups = dr.getBackups();
      expect(backups.length).toBe(1);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete request flow', () => {
      const logger = new RequestLogger();
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 100,
      });

      // Simulate request
      const allowed = rateLimiter.isAllowed('user-1');
      expect(allowed).toBe(true);

      // Log request
      logger.log({
        method: 'POST',
        path: '/api/users',
        statusCode: 201,
        duration: 100,
        userId: 'user-1',
      });

      // Build response
      const response = ResponseBuilder.success({ id: 1, name: 'New User' });
      expect(response.success).toBe(true);

      // Verify logs
      const logs = logger.getLogs();
      expect(logs.length).toBe(1);
    });

    it('should handle error flow', () => {
      const logger = new RequestLogger();

      logger.log({
        method: 'GET',
        path: '/api/users/999',
        statusCode: 404,
        duration: 50,
        error: 'User not found',
      });

      const response = ResponseBuilder.notFound('User');
      expect(response.success).toBe(false);

      const errorLogs = logger.getLogs();
      expect(errorLogs[0].error).toBe('User not found');
    });
  });
});
