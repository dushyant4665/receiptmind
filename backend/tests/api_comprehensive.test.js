const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const db = require('../src/config/db');
const emailService = require('../src/services/emailService');
const storageService = require('../src/services/storageService');
const receiptProcessingService = require('../src/services/receiptProcessingService');
const exceptionService = require('../src/services/exceptionService');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('../src/services/storageService', () => ({
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getSignedURL: jest.fn(),
}));

jest.mock('../src/services/receiptProcessingService', () => ({
  processReceipt: jest.fn(),
}));

jest.mock('../src/services/exceptionService', () => ({
  getByOrganization: jest.fn(),
  resolve: jest.fn(),
}));

const jwtService = require('../src/services/jwtService');
const ruleService = require('../src/services/ruleService');

const authHeader = 'Bearer valid-token';
const mockDecodedUser = { user_id: 'user-id', organization_id: 'org-id' };

const setAuth = () => {
  jest.spyOn(jwtService, 'verifyToken').mockImplementation((token, isRefresh = false) => {
    if (isRefresh) {
      return { user_id: 'user-id' };
    }
    return token === 'valid-token' ? mockDecodedUser : null;
  });
};

describe('Comprehensive API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    setAuth();
    storageService.uploadFile.mockResolvedValue('org-id/receipt.jpg');
    storageService.getSignedURL.mockResolvedValue('https://signed.example/file.jpg');
    storageService.deleteFile.mockResolvedValue();
    receiptProcessingService.processReceipt.mockResolvedValue({ success: true, status: 'processed' });
    exceptionService.getByOrganization.mockResolvedValue([]);
    exceptionService.resolve.mockResolvedValue();
    jest.spyOn(ruleService, 'autoLearnFromEdit').mockResolvedValue();
  });

  describe('Authentication APIs', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'password123',
      organization_name: 'Test Org',
    };

    it('POST /auth/register - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/auth/register').send(testUser);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('POST /auth/register - Duplicate Email', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const res = await request(app).post('/auth/register').send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('POST /auth/login - Success', async () => {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(testUser.password, 10);

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user-id',
          email: testUser.email,
          password_hash: passwordHash,
          organization_id: 'org-id',
          status: 'active',
        }],
      });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('access_token');
    });

    it('POST /auth/verify-email - Success', async () => {
      const token = 'verify-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      void tokenHash;

      db.query.mockResolvedValueOnce({
        rows: [{
          email: testUser.email,
          password_hash: 'hash',
          organization_name: 'Test Org',
        }],
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      db.pool.connect.mockResolvedValue(mockClient);

      const res = await request(app).post('/auth/verify-email').send({ token });

      expect(res.status).toBe(200);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('POST /auth/resend-verification - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ email: testUser.email }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/auth/resend-verification').send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('POST /auth/refresh - Success', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'session-id',
            user_id: 'user-id',
            email: 'test@example.com',
            organization_id: 'org-id',
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/auth/refresh').send({ refresh_token: 'refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('refresh_token');
    });

    it('POST /auth/forgot-password - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-id' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/auth/forgot-password').send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('POST /auth/reset-password - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ user_id: 'user-id' }] });

      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      db.pool.connect.mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'reset-token', new_password: 'password123' });

      expect(res.status).toBe(200);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('POST /auth/logout - Success', async () => {
      const res = await request(app).post('/auth/logout').send({});

      expect(res.status).toBe(200);
      expect(res.body.data.logged_out).toBe(true);
    });

    it('POST /auth/logout-all - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/logout-all')
        .set('Authorization', authHeader)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.logged_out_all).toBe(true);
    });
  });

  describe('Receipt APIs', () => {
    it('POST /receipts/upload - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/receipts/upload')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from('fake-image-data'), 'receipt.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(receiptProcessingService.processReceipt).toHaveBeenCalled();
    });

    it('POST /receipts/upload - Missing File', async () => {
      const res = await request(app)
        .post('/receipts/upload')
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
    });

    it('GET /receipts - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'receipt-id',
            vendor_name: 'Test Vendor',
            amount: 100,
            status: 'processed',
          }],
        });

      const res = await request(app).get('/receipts').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.receipts).toHaveLength(1);
    });

    it('GET /receipts/:id - Success', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'receipt-id',
            file_path: 'file.jpg',
            vendor_name: 'Test Vendor',
            amount: 100,
            status: 'processed',
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/receipts/receipt-id').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('receipt-id');
    });

    it('PATCH /receipts/:id - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'receipt-id', vendor_name: 'Old', category: 'Travel' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch('/receipts/receipt-id')
        .set('Authorization', authHeader)
        .send({ vendor_name: 'New Vendor', category: 'Meals' });

      expect(res.status).toBe(200);
      expect(ruleService.autoLearnFromEdit).toHaveBeenCalledWith('org-id', 'New Vendor', 'Meals');
    });

    it('DELETE /receipts/:id - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ file_path: 'org-id/receipt.jpg' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/receipts/receipt-id').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(storageService.deleteFile).toHaveBeenCalledWith('org-id/receipt.jpg');
    });

    it('DELETE /receipts/bulk - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ file_path: 'a.jpg' }, { file_path: 'b.jpg' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete('/receipts/bulk')
        .set('Authorization', authHeader)
        .send({ receipt_ids: ['r1', 'r2'] });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });

    it('POST /receipts/bulk/export - Success', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'r1',
          export_vendor: 'Vendor 1',
          export_amount: 99,
          export_category: 'Travel',
          export_date: '2026-05-27',
          export_confidence: 0.91,
          status: 'processed',
          export_currency: 'USD',
          export_source: 'upload',
          export_file_name: 'receipt.jpg',
          created_at: new Date('2026-05-27T00:00:00.000Z'),
        }],
      });

      const res = await request(app)
        .post('/receipts/bulk/export')
        .set('Authorization', authHeader)
        .send({ receipt_ids: ['r1'] });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
    });
  });

  describe('Expenses, Exceptions, Metrics, Dashboard', () => {
    it('GET /expenses - Success', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'receipt-id',
          vendor_name: 'Expense Vendor',
          amount: '55.20',
          receipt_date: '2026-05-27',
          category: 'Office',
          status: 'processed',
        }],
      });

      const res = await request(app).get('/expenses').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /exceptions - Success', async () => {
      exceptionService.getByOrganization.mockResolvedValueOnce([{ id: 'ex-1', status: 'open' }]);

      const res = await request(app).get('/exceptions').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('POST /exceptions/:id/resolve - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'ex-1', receipt_id: 'r1', status: 'open' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/exceptions/ex-1/resolve')
        .set('Authorization', authHeader)
        .send({ vendor_name: 'Vendor', category: 'Meals' });

      expect(res.status).toBe(200);
      expect(exceptionService.resolve).toHaveBeenCalledWith('ex-1', 'org-id');
    });

    it('GET /metrics/processing-times - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ duration: '12' }, { duration: '18' }] });

      const res = await request(app).get('/metrics/processing-times').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.average_seconds).toBe(15);
    });

    it('GET /metrics/summary - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ status: 'processed', count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ status: 'open', count: '1' }] });

      const res = await request(app).get('/metrics/summary').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.receipts.processed).toBe(3);
    });

    it('GET /dashboard - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ sum: '500' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const res = await request(app).get('/dashboard').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.total_receipts).toBe(5);
    });
  });

  describe('Rules, Exports, Users, Files', () => {
    it('POST /rules - Success', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'rule-id',
          condition_type: 'vendor',
          condition_value: 'Uber',
          action_type: 'set_category',
          action_value: 'Travel',
        }],
      });

      const res = await request(app)
        .post('/rules')
        .set('Authorization', authHeader)
        .send({
          condition_type: 'vendor',
          condition_value: 'Uber',
          action_type: 'set_category',
          action_value: 'Travel',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('rule-id');
    });

    it('GET /rules - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'rule-id', name: 'Test Rule' }] });

      const res = await request(app).get('/rules').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /exports/csv - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'r1',
            export_vendor: 'Vendor',
            export_amount: 12.5,
            export_category: 'Office',
            export_date: '2026-05-27',
            export_confidence: 0.95,
            status: 'processed',
            export_currency: 'USD',
            export_source: 'upload',
            export_file_name: 'receipt.jpg',
            needs_review: false,
            created_at: new Date('2026-05-27T00:00:00.000Z'),
            export_updated_at: new Date('2026-05-27T01:00:00.000Z'),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/exports/csv').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
    });

    it('GET /exports/history - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'export-id', file_name: 'receipts.csv' }] });

      const res = await request(app).get('/exports/history').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET /users/me - Success', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'user-id', email: 'test@example.com', name: 'Tester' }],
      });

      const res = await request(app).get('/users/me').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('PUT /users/me - Success', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 'user-id', email: 'test@example.com', name: 'Updated Name' }],
        });

      const res = await request(app)
        .put('/users/me')
        .set('Authorization', authHeader)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });

    it('GET /api/files/:id - Not Found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/files/receipt-id').set('Authorization', authHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Health and Auth Guards', () => {
    it('GET /health should return 200', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /receipts without auth should return 401', async () => {
      const res = await request(app).get('/receipts');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
