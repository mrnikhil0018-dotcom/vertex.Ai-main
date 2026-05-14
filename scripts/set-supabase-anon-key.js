const fs = require('fs');
const path = require('path');

const key = process.argv[2];

if (!key) {
  console.error('Usage: npm run set-supabase-anon-key -- your-anon-key');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'src', 'supabaseConfig.js');
const source = fs.readFileSync(configPath, 'utf8');
const next = source.replace(
  /export const SUPABASE_ANON_KEY =\s*(?:\n\s*)?'.*?';/s,
  `export const SUPABASE_ANON_KEY =\n  '${key.trim()}';`,
);

if (source === next) {
  console.error('Could not update SUPABASE_ANON_KEY in src/supabaseConfig.js');
  process.exit(1);
}

fs.writeFileSync(configPath, next);
console.log('Supabase anon key set.');
