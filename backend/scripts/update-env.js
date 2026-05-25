const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const newKey = 'AIzaSyAmRmtJwy7ryrEDgldv9Gf7DfKmLm_lPsQ';

if (!fs.existsSync(envPath)) {
  console.log('Creating new .env file');
  fs.writeFileSync(envPath, `GEMINI_API_KEY=${newKey}\n`);
  process.exit(0);
}

let content = fs.readFileSync(envPath, 'utf8');
let lines = content.split('\n');
let found = false;

lines = lines.map(line => {
  if (line.trim().startsWith('GEMINI_API_KEY=')) {
    found = true;
    return `GEMINI_API_KEY=${newKey}`;
  }
  return line;
});

if (!found) {
  lines.push(`GEMINI_API_KEY=${newKey}`);
}

fs.writeFileSync(envPath, lines.join('\n'));
console.log('Successfully updated GEMINI_API_KEY in .env');
