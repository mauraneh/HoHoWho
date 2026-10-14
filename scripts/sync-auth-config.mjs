#!/usr/bin/env node
// Configures Supabase Auth for the deployed site through the Management API:
//  - French, on-brand e-mail templates (supabase/templates/*.html) for magic links and sign-up
//    confirmations;
//  - the site URL and the redirect allow-list entry needed by sign-in links (existing entries
//    are kept).
//
// Env: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SITE_URL (e.g. https://me.github.io/repo/)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const site = (process.env.SITE_URL ?? '').trim().replace(/\/*$/, '/');

if (!token || !ref || !/^https:\/\/\S+\/$/.test(site)) {
  console.error('SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and an https SITE_URL are required.');
  process.exit(1);
}

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
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

const update = {
  ...(isLocalSiteUrl ? { site_url: site } : {}),
  uri_allow_list: [...allowList].join(','),
  mailer_subjects_magic_link: '✦ Votre lien magique HoHoWho',
  mailer_templates_magic_link_content: template('magic-link.html'),
  mailer_subjects_confirmation: '✦ Bienvenue sur HoHoWho : confirmez votre adresse',
  mailer_templates_confirmation_content: template('confirmation.html'),
};

const response = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(update) });
if (!response.ok) {
  console.error(`Could not update the auth config (${response.status}): ${await response.text()}`);
  process.exit(1);
}
console.log(
  `Auth config synced: e-mail templates installed, redirect allow-list has ${allowList.size} entr${allowList.size > 1 ? 'ies' : 'y'}${isLocalSiteUrl ? ', site URL set' : ''}.`,
);
