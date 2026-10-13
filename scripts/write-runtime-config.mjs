#!/usr/bin/env node
// Writes the runtime configuration (config.json) read by the app at startup.
//
//   node scripts/write-runtime-config.mjs [output-file]
//
// Values come from environment variables SUPABASE_URL and SUPABASE_ANON_KEY
// (load a local .env with `node --env-file-if-exists=.env …`, see package.json scripts).
// Default output: public/config.json (served by `ng serve`, git-ignored).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const output = resolve(process.argv[2] ?? 'public/config.json');
const supabaseUrl = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY ?? '').trim();

const problems = [];
if (!/^https?:\/\/\S+$/.test(supabaseUrl)) problems.push('SUPABASE_URL must be an http(s) URL');
if (!supabaseAnonKey) problems.push('SUPABASE_ANON_KEY is required');
if (
  supabaseAnonKey.startsWith('sb_secret_') ||
  /service_role/.test(decodeJwtRole(supabaseAnonKey))
) {
  problems.push(
    'SUPABASE_ANON_KEY looks like a service_role/secret key: never ship it to browsers',
  );
}
if (problems.length) {
  console.error(`Cannot write ${output}:\n - ${problems.join('\n - ')}`);
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ supabaseUrl, supabaseAnonKey }, null, 2) + '\n');
console.log(`Wrote ${output}`);

function decodeJwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    return String(payload.role ?? '');
  } catch {
    return '';
  }
}
