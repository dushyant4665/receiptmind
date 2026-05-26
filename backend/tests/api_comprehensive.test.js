const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const emailService = require('../src/services/emailService');

// Mock Database
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

// Mock Services
jest.mock('../src/services/emailService');
jest.mock('../src/services/storageService');

describe('Comprehensive API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication APIs', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'password123',
      organization_name: 'Test Org'
    };

    it('POST /api/auth/register - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      db.query.mockResolvedValueOnce({ rows: [] }); // Insert pending

      const res = await request(app)
        .post('/auth/register')
        .send(testUser);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('POST /auth/register - Duplicate Email', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      const res = await request(app)
        .post('/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('exists');
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
          status: 'active'
        }] 
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // Insert session

      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('access_token');
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it('POST /auth/login - Invalid Credentials', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /auth/verify-email - Success', async () => {
      const token = 'test-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      db.query.mockResolvedValueOnce({ 
        rows: [{ 
          email: testUser.email, 
          password_hash: 'hash', 
          organization_name: 'Test Org' 
        }] 
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      db.pool.connect.mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/auth/verify-email')
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('Receipt APIs', () => {
    const mockUser = { user_id: 'user-id', organization_id: 'org-id' };
    let token;

    beforeEach(() => {
      const jwtService = require('../src/services/jwtService');
      jest.spyOn(jwtService, 'verifyToken').mockReturnValue(mockUser);
      token = 'Bearer valid-token';
    });

    it('POST /receipts/upload - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No duplicate
      db.query.mockResolvedValue({ rows: [] }); // Other queries

      const res = await request(app)
        .post('/receipts/upload')
        .set('Authorization', token)
        .attach('file', Buffer.from('fake-image-data'), 'receipt.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('processing');
    });

    it('GET /receipts - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count
      db.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'receipt-id', 
          vendor_name: 'Test Vendor', 
          amount: 100.00,
          status: 'completed'
        }] 
      }); // List

      const res = await request(app)
        .get('/receipts')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receipts).toHaveLength(1);
    });

    it('GET /receipts/:id - Success', async () => {
      db.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'receipt-id', 
          vendor_name: 'Test Vendor', 
          amount: 100.00,
          status: 'completed'
        }] 
      });
      db.query.mockResolvedValueOnce({ rows: [] }); // Exceptions

      const res = await request(app)
        .get('/receipts/receipt-id')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('receipt-id');
    });
  });

  describe('Dashboard APIs', () => {
    const mockUser = { user_id: 'user-id', organization_id: 'org-id' };
    let token;

    beforeEach(() => {
      const jwtService = require('../src/services/jwtService');
      jest.spyOn(jwtService, 'verifyToken').mockReturnValue(mockUser);
      token = 'Bearer valid-token';
    });

    it('GET /dashboard - Success', async () => {
      // Mocking multiple queries for dashboard stats
      db.query.mockResolvedValue({ rows: [{ count: '5', sum: '500' }] });

      const res = await request(app)
        .get('/dashboard')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Rule APIs', () => {
    const mockUser = { user_id: 'user-id', organization_id: 'org-id' };
    let token;

    beforeEach(() => {
      const jwtService = require('../src/services/jwtService');
      jest.spyOn(jwtService, 'verifyToken').mockReturnValue(mockUser);
      token = 'Bearer valid-token';
    });

    it('GET /rules - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'rule-id', name: 'Test Rule' }] });

      const res = await request(app)
        .get('/rules')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('Export APIs', () => {
    const mockUser = { user_id: 'user-id', organization_id: 'org-id' };
    let token;

    beforeEach(() => {
      const jwtService = require('../src/services/jwtService');
      jest.spyOn(jwtService, 'verifyToken').mockReturnValue(mockUser);
      token = 'Bearer valid-token';
    });

    it('GET /exports/csv - Success', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'export-id' }] });
      db.query.mockResolvedValueOnce({ rows: [{ id: 'receipt-id' }] });

      const res = await request(app)
        .get('/exports/csv')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
    });
  });

  describe('User APIs', () => {
    const mockUser = { user_id: 'user-id', organization_id: 'org-id' };
    let token;

    beforeEach(() => {
      const jwtService = require('../src/services/jwtService');
      jest.spyOn(jwtService, 'verifyToken').mockReturnValue(mockUser);
      token = 'Bearer valid-token';
    });

    it('GET /users/me - Success', async () => {
      db.query.mockResolvedValueOnce({ 
        rows: [{ id: 'user-id', email: 'test@example.com' }] 
      });

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
    });
  });

  describe('CSV Export Service', () => {
    it('should correctly format and append receipt data to receipts_peak.csv', async () => {
      const csvExportService = require('../src/services/csvExportService');
      const fs = require('fs').promises;
      
      const record = {
        id: 'test-uuid-1234',
        vendor_name: 'Supermarket, Inc.',
        amount: 84.50,
        currency: 'USD',
        category: 'Meals & Entertainment',
        receipt_date: '2026-05-25',
        confidence: 0.95,
        status: 'processed'
      };

      await csvExportService.appendReceipt(record);
      
      const content = await fs.readFile(csvExportService.csvPath, 'utf8');
      expect(content).toContain('Receipt ID');
      expect(content).toContain('Supermarket, Inc.');
      expect(content).toContain('84.5');
      expect(content).toContain('95%');
    });
  });

  describe('Health Check', () => {
    it('GET /health should return 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
