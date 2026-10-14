#!/usr/bin/env node
// Configures Supabase Auth for the deployed site through the Management API:
//  - the site URL and the redirect allow-list entry needed by sign-in links (existing entries
//    are kept);
//  - optionally a custom SMTP server (e.g. Brevo's free plan) when SMTP_* secrets are provided;
//  - French, on-brand e-mail templates (supabase/templates/*.html) for magic links and sign-up
//    confirmations. Supabase only accepts custom templates once a custom SMTP server is set, so
//    until then this step only warns.
//
// Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SITE_URL (e.g. https://me.github.io/repo/)
// Optional: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_SENDER_EMAIL,
//           SMTP_SENDER_NAME (default HoHoWho)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const site = (process.env.SITE_URL ?? '').trim().replace(/\/*$/, '/');

if (!token || !ref || !/^https:\/\/\S+\/$/.test(site)) {
  console.error('SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and an https SITE_URL are required.');
  process.exit(1);
}

const api = `${process.env.SUPABASE_API_URL ?? 'https://api.supabase.com'}/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const template = (name) =>
  readFileSync(resolve('supabase/templates', name), 'utf8').replaceAll('%%SITE%%', site);

const current = await fetch(api, { headers });
if (!current.ok) {
  console.error(`Could not read the auth config (${current.status}): ${await current.text()}`);
  process.exit(1);
}
const config = await current.json();

const allowList = new Set(
  String(config.uri_allow_list ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean),
);
allowList.add(`${site}**`);

const isLocalSiteUrl = !config.site_url || /localhost|127\.0\.0\.1/.test(config.site_url);

const patch = async (body) => {
  const response = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(body) });
  return {
    ok: response.ok,
    status: response.status,
    text: response.ok ? '' : await response.text(),
  };
};
const fail = (what, result) => {
  console.error(`Could not update ${what} (${result.status}): ${result.text}`);
  process.exit(1);
};

// 1. Redirects (always).
const redirects = await patch({
  ...(isLocalSiteUrl ? { site_url: site } : {}),
  uri_allow_list: [...allowList].join(','),
});
if (!redirects.ok) fail('the redirect settings', redirects);
console.log(
  `Redirect allow-list has ${allowList.size} entr${allowList.size > 1 ? 'ies' : 'y'}${isLocalSiteUrl ? '; site URL set' : ''}.`,
);

// 2. Custom SMTP (optional).
const smtp = process.env;
if (smtp.SMTP_HOST && smtp.SMTP_USER && smtp.SMTP_PASS && smtp.SMTP_SENDER_EMAIL) {
  const result = await patch({
    smtp_host: smtp.SMTP_HOST.trim(),
    smtp_port: String(smtp.SMTP_PORT || 587),
    smtp_user: smtp.SMTP_USER.trim(),
    smtp_pass: smtp.SMTP_PASS,
    smtp_admin_email: smtp.SMTP_SENDER_EMAIL.trim(),
    smtp_sender_name: smtp.SMTP_SENDER_NAME || 'HoHoWho',
  });
  if (!result.ok) fail('the SMTP settings', result);
  console.log('Custom SMTP configured.');
}

// 3. E-mail templates (need a custom SMTP server on the free plan).
const templates = await patch({
  mailer_subjects_magic_link: '✦ Votre lien magique HoHoWho',
  mailer_templates_magic_link_content: template('magic-link.html'),
  mailer_subjects_confirmation: '✦ Bienvenue sur HoHoWho : confirmez votre adresse',
  mailer_templates_confirmation_content: template('confirmation.html'),
});
if (templates.ok) {
  console.log('E-mail templates installed.');
} else if (templates.status === 400 && /smtp/i.test(templates.text)) {
  console.log(
    '::warning::E-mail templates not installed yet: Supabase requires a custom SMTP server on the free plan. Add the SMTP_* secrets (see README) and redeploy.',
  );
} else {
  fail('the e-mail templates', templates);
}
