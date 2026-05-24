const db = require('../src/config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function setup() {
  const email = 'test@example.com';
  const password = 'password123';
  const orgName = 'Test Org';

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const slug = 'test-org-' + crypto.randomUUID().slice(0, 4);

    await db.query('BEGIN');

    // Delete existing test user if any
    await db.query('DELETE FROM users WHERE email = $1', [email]);
    await db.query('DELETE FROM organizations WHERE name = $1', [orgName]);

    await db.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
      [orgId, orgName, slug]
    );

    await db.query(
      "INSERT INTO users (id, email, password_hash, organization_id, status, email_verified_at) VALUES ($1, $2, $3, $4, 'active', NOW())",
      [userId, email, passwordHash, orgId]
    );

    await db.query('COMMIT');
    console.log(`Test user created: ${email} / ${password}`);
    process.exit(0);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Setup failed:', err);
    process.exit(1);
  }
}

setup();
