const fs = require('fs');
const path = require('path');

const rawUrl = process.argv[2];

if (!rawUrl) {
  console.error('Usage: npm run set-backend-url -- https://your-backend-url');
  process.exit(1);
}

let url;
try {
  url = new URL(rawUrl);
} catch (error) {
  console.error(`Invalid URL: ${rawUrl}`);
  process.exit(1);
}

if (url.protocol !== 'https:' && !url.hostname.startsWith('10.')) {
  console.error('Use HTTPS for production backend URLs.');
  process.exit(1);
}

url.pathname = url.pathname.replace(/\/+$/, '');
if (url.pathname.endsWith('/api')) {
  url.pathname = url.pathname.slice(0, -4) || '/';
}

const normalized = url.toString().replace(/\/+$/, '');
const configPath = path.join(__dirname, '..', 'src', 'backendConfig.js');
const source = fs.readFileSync(configPath, 'utf8');
const next = source.replace(
  /export const PUBLIC_BACKEND_URL = '.*?';/,
  `export const PUBLIC_BACKEND_URL = '${normalized}';`,
);

if (source === next) {
  console.error('Could not update PUBLIC_BACKEND_URL in src/backendConfig.js');
  process.exit(1);
}

fs.writeFileSync(configPath, next);
console.log(`Backend URL set to ${normalized}`);
