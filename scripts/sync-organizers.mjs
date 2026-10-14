#!/usr/bin/env node
// Replaces the list of organisers (public.organizers) with ORGANIZER_EMAILS
// (comma- or space-separated). Runs in CI through the Supabase Management API, so the addresses
// live in a GitHub variable instead of the (public) repository. Addresses are never printed.
//
// Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, ORGANIZER_EMAILS
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const emails = [
  ...new Set(
    (process.env.ORGANIZER_EMAILS ?? '')
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
];

if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.');
  process.exit(1);
}
if (emails.length === 0) {
  console.log('ORGANIZER_EMAILS is empty: organiser list left unchanged.');
  process.exit(0);
}
const invalid = emails.filter((e) => !/^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/.test(e));
if (invalid.length) {
  console.error(`${invalid.length} invalid address(es) in ORGANIZER_EMAILS.`);
  process.exit(1);
}

// Addresses are validated above (no quotes or backslashes), so literal quoting is safe.
const list = emails.map((e) => `('${e}')`).join(', ');
const query = `
  begin;
  -- Organisers created with the organiser code (personal links) are kept.
  delete from public.organizers where email not like '%@guest.hohowho.app';
  insert into public.organizers (email) values ${list} on conflict do nothing;
  commit;
`;

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!response.ok) {
  console.error(`Supabase API error ${response.status}: ${await response.text()}`);
  process.exit(1);
}
console.log(`Organiser list synced (${emails.length} address${emails.length > 1 ? 'es' : ''}).`);
