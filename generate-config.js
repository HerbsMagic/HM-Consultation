const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env file not found. Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && key.trim() && !key.startsWith('#')) {
    env[key.trim()] = rest.join('=').trim();
  }
});

const required = ['CONSULTATION_API_BASE', 'RAZORPAY_KEY_ID'];
const missing = required.filter(k => !env[k]);
if (missing.length) {
  console.error(`ERROR: Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const config = `window.CONSULTATION_API_BASE = '${env.CONSULTATION_API_BASE}';
window.RAZORPAY_KEY_ID = '${env.RAZORPAY_KEY_ID}';
`;

fs.writeFileSync(path.join(__dirname, 'config.js'), config);
console.log('config.js generated successfully.');
