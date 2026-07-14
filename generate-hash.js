const crypto = require('crypto');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node generate-hash.js <password>');
  process.exit(1);
}

// Generate a random 16-byte salt
const salt = crypto.randomBytes(16).toString('hex');

// Hash the password using scrypt
// Recommended parameters: cost=16384, blockSize=8, parallelization=1
const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });

const hash = `${salt}:${derivedKey.toString('hex')}`;

const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('\n--- Add these to your .env.local ---\n');
console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
console.log(`SESSION_SECRET="${sessionSecret}"`);
console.log('\n------------------------------------\n');
