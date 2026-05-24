const request = require('supertest');
const app = require('../src/app');

// Mock Database
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  },
}));

// Mock Redis
jest.mock('../src/config/redis', () => ({
  client: {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(() => []),
  },
  connectRedis: jest.fn(),
}));

// Mock Queue
jest.mock('../src/services/queueService', () => ({
  enqueueReceipt: jest.fn(),
}));

// Mock Email
jest.mock('../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

describe('API Route Verification', () => {
  describe('Auth Routes', () => {
    it('POST /auth/register should exist', async () => {
      const { query } = require('../src/config/db');
      query.mockResolvedValueOnce({ rows: [] }); // No existing user

      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          organization_name: 'Test Org'
        });
      
      expect(res.status).not.toBe(404);
    });

    it('POST /auth/login should exist', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      expect(res.status).not.toBe(404);
    });
  });

  describe('Receipt Routes', () => {
    it('GET /receipts should require auth', async () => {
      const res = await request(app).get('/receipts');
      expect(res.status).toBe(401);
    });
  });

  describe('Dashboard Routes', () => {
    it('GET /dashboard should require auth', async () => {
      const res = await request(app).get('/dashboard');
      expect(res.status).toBe(401);
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
