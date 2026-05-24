const db = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function runSchema() {
  const schemaPath = path.join(__dirname, '../../backend/db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    // Split by semicolon, but be careful with functions/triggers if any
    // For this schema, simple split should work for tables and indexes
    const commands = schema.split(';').filter(cmd => cmd.trim().length > 0);

    console.log(`Running ${commands.length} commands...`);
    for (let cmd of commands) {
      try {
        await db.query(cmd);
      } catch (err) {
        if (err.message.includes('already exists')) {
          // Skip
        } else {
          console.error('Error running command:', cmd.substring(0, 50) + '...');
          console.error(err.message);
        }
      }
    }
    console.log('Schema migration completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runSchema();
