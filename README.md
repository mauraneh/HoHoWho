# 🎁 HoHoWho

HoHoWho is a Secret Santa organiser. You create an event, invite your group with a secure link, draw names fairly, and each person fills in a questionnaire and a wishlist. Everyone gets gift ideas for their giftee and can chat anonymously with them.

It costs **€0 per month** to run: a static Angular app on **GitHub Pages**, with **Supabase Free** for Postgres, Auth, Row Level Security and Edge Functions. No paid API, no credit card and no custom domain are needed.

---

## Features

| Feature                  | How it works                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language                 | The interface is in French (dates, prices and messages included).                                                                                                                                                                                                                                                                                   |
| Personal links           | No e-mail, no password. Joining only asks for a first name; the person gets a private personal link (`#/k/<key>`) that signs them in on any device. They keep it (WhatsApp, notes…), can regenerate it from « Mon lien », and the organiser can issue a new one for a participant who lost theirs.                                                  |
| Events                   | Name, description, date, budget range and currency. The organiser can delete the event.                                                                                                                                                                                                                                                             |
| Secure invitations       | Each link carries a random 256-bit token. Only its SHA-256 hash is stored. Links expire after 14 days, can be revoked, and stop working once the list is closed. Anyone with the link can see the event name before entering their first name.                                                                                                      |
| Three-step flow          | **1. Join & wishes:** people open the link and fill in the questionnaire. **2. Exclusions:** the organiser closes the list; each person privately picks who they'd rather not give a gift to (nobody else can see it), then validates. **3. Draw:** names are drawn automatically when the last person validates (the organiser can also force it). |
| Draw                     | The `draw-assignments` Edge Function draws names with a CSPRNG and backtracking, so it respects every personal exclusion. It saves the result atomically, and the database checks it again.                                                                                                                                                         |
| Privacy of assignments   | Row Level Security lets each person read only the assignment where they are the giver. Nobody, not even the organiser, can see the full list.                                                                                                                                                                                                       |
| Questionnaire & wishlist | Interests, preferred kinds of gifts, things to avoid, sizes and notes, plus wishlist items. Only the author and their Secret Santa can read them.                                                                                                                                                                                                   |
| Gift ideas               | A deterministic, rule-based recommender. It scores a curated catalogue against the questionnaire, keywords found in the notes and wishlist, the things to avoid and the budget, and explains each suggestion. It is pluggable, so an AI provider can be added later.                                                                                |
| Anonymous messages       | Each giftee has one thread with their Santa. Messages store no sender, only a "from Santa" flag.                                                                                                                                                                                                                                                    |
| Demo mode                | In development everything runs in the browser with seeded demo data. No account or network is needed.                                                                                                                                                                                                                                               |

## Architecture

```
┌──────────────────────────┐   HTTPS (anon key + user JWT)   ┌──────────────────────────────┐
│ Angular SPA (static)     │ ──────────────────────────────▶ │ Supabase Free                │
│ GitHub Pages / any CDN   │   PostgREST · Auth · Functions  │  Postgres + RLS + RPCs       │
│                          │                                 │  Auth (personal links)       │
│ HohowhoBackend contract  │                                 │  Edge Functions: draw, links │
│  ├─ SupabaseBackend      │                                 └──────────────────────────────┘
│  └─ MockBackend (dev)    │
│ Recommendation providers │
│  └─ RuleBasedRecommender │
└──────────────────────────┘
```

- **One data-access contract** (`src/app/core/backend/hohowho-backend.ts`). Feature code never talks to Supabase directly. `createBackend()` picks the implementation at startup from the environment. Each implementation is a lazy chunk, so production never downloads the mock data and development never loads `supabase-js`.
- **Hosting is kept out of the application.** The app uses hash URLs (`#/events/…`), so it needs no server rewrites on any static host. The base path is passed at build time (`--base-href`). Supabase credentials are read at runtime from `config.json` next to `index.html`. The same build can be dropped on GitHub Pages, Netlify, Cloudflare Pages, S3 and so on.
- **The draw algorithm is shared** (`supabase/functions/_shared/draw.ts`). It is plain TypeScript used by both the Edge Function (Deno) and the mock backend. Angular imports it as `@shared/draw`.

### Security model

- RLS is enabled on every table, and the default Supabase grants are revoked. `authenticated` gets explicit per-column privileges. `anon` gets nothing.
- Writes that must be atomic or need elevated rights go through `SECURITY DEFINER` functions that check `auth.uid()`: `create_event`, `create_invitation`, `preview_invitation` and `accept_invitation`.
- `apply_draw` can only be executed by `service_role`, which means only by the Edge Function. It locks the event and checks again that the draw is complete, that nobody draws themselves and that no exclusion is broken.
- Exclusions are personal and private: `submit_exclusions` writes them, and RLS lets each person read only their own. The organiser only sees who has validated, never what they chose. `close_registrations` and `reopen_registrations` move the event between phases and are organiser-only.
- **Personal links.** The `personal-access` Edge Function creates the accounts. Each one is a regular Supabase Auth user with a synthetic address (`g<16 hex>@guest.hohowho.app`, never e-mailed) and a random 192-bit secret as its password. The personal key is `<account>.<secret>`, so signing in is a plain `signInWithPassword` call. An account can only be created with a valid invitation to an open event (participant) or with the `ORGANIZER_CODE` secret (organiser). Regenerating a link changes the password, which invalidates the old link.
- The browser only ever holds the public **anon/publishable key**. The `service_role` key exists only inside Supabase Edge Functions. `scripts/write-runtime-config.mjs` refuses to write a service-role key into `config.json`.
- `supabase/tests/rls_test.sql` checks these rules: outsiders, non-owners, a fake Santa, a fake receiver, direct inserts, a draw replayed twice and so on. CI runs it against a real PostgreSQL server.

## Project structure

```
.github/workflows/deploy.yml   CI (lint, tests, build, DB tests, Deno check) + Pages/Supabase deploy
scripts/
  write-runtime-config.mjs     Generates config.json from SUPABASE_URL / SUPABASE_ANON_KEY
  test-db.sh                   Applies migrations to a throwaway Postgres DB and runs RLS tests
supabase/
  config.toml                  Supabase CLI config (local stack)
  migrations/                  Schema, constraints, RPCs, grants and RLS policies
  functions/_shared/draw.ts    Draw algorithm (shared with the frontend)
  functions/draw-assignments/  Edge Function that performs the draw
  tests/                       Supabase stub + RLS test suite (plain SQL)
src/
  environments/                production (supabase) · development (mock) · development-supabase
  app/core/                    models, backend contract + implementations, guards, helpers
  app/recommendations/         questionnaire options, gift catalogue, rule-based engine, providers
  app/features/                pages (sign-in, events, event tabs, join)
```

---

## Prerequisites

- **Node.js 24** (or 22.22.3+), as required by Angular 22.
- **pnpm 10**: run `corepack enable` and the pinned version is used automatically. The lockfile `pnpm-lock.yaml` is committed, so always install with `--frozen-lockfile` in CI.
- Optional: the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and Docker for a local Supabase stack.
- Optional: PostgreSQL (`psql`) to run the database tests locally.

## Local development (mock data, zero setup)

```bash
pnpm install
pnpm start            # http://localhost:4200
```

The app runs entirely in your browser with demo data stored in `localStorage`. Open a demo personal link from the home page: `#/k/demo-alice` (organiser), `#/k/demo-bob`, `#/k/demo-carol` or `#/k/demo-dave`. The demo organiser code is `noel`.

- **Family Christmas** is open and organised by Alice. Use it to try the invitation link, closing the list, exclusions and the automatic draw. Sign out and open the invitation link to join as someone new with just a first name.
- **Office Party** has already been drawn. Use it to try the giftee page, gift ideas and messages. Alice is Carol's Santa.
- **Reset demo data** in the footer restores the seed.

## Local development against Supabase

```bash
cp .env.example .env          # fill in SUPABASE_URL and SUPABASE_ANON_KEY
pnpm start:supabase           # writes public/config.json, then serves with real data
```

To run the whole stack locally with the Supabase CLI and Docker:

```bash
supabase start                # prints the local API URL and anon key → put them in .env
supabase db reset             # applies supabase/migrations
supabase functions serve      # serves draw-assignments and personal-access locally
pnpm start:supabase
```

To create an organiser account locally, put `ORGANIZER_CODE=<phrase>` in `supabase/functions/.env` before `supabase functions serve`.

## Commands

| Command                                                                                     | Description                                                                   |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm start`                                                                                | Dev server with mock data                                                     |
| `pnpm start:supabase`                                                                       | Dev server against Supabase (reads `.env`)                                    |
| `pnpm build`                                                                                | Production build into `dist/hohowho/browser` (base href `/`)                  |
| `pnpm build --base-href /HoHoWho/`                                                          | Production build for a sub-path such as GitHub Pages                          |
| `pnpm build:dev`                                                                            | Unoptimised development build (mock data)                                     |
| `pnpm config:write [file]`                                                                  | Writes runtime `config.json` (default `public/config.json`) from env / `.env` |
| `pnpm test`                                                                                 | Unit tests (Vitest): draw, recommender, mock backend, config…                 |
| `pnpm lint`                                                                                 | ESLint (angular-eslint, template accessibility rules)                         |
| `pnpm format` / `pnpm format:check`                                                         | Prettier                                                                      |
| `DATABASE_URL=postgres://… pnpm test:db`                                                    | Applies migrations to a throwaway database and runs the RLS tests             |
| `deno check --node-modules-dir=none --no-lock supabase/functions/draw-assignments/index.ts` | Type-checks the Edge Function                                                 |

To preview a production build locally:

```bash
pnpm build && pnpm config:write dist/hohowho/browser/config.json
npx serve dist/hohowho/browser    # any static file server works
```

### Configuration

| Where                             | What                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/environments/*.ts`           | Build-time switch: `dataSource: 'mock' \| 'supabase'`. No secrets.                                                                                                                                            |
| `config.json` (runtime)           | `{ "supabaseUrl", "supabaseAnonKey" }`. Generated, git-ignored, never committed.                                                                                                                              |
| `.env` (local only)               | Source for `config.json` locally. Template: `.env.example`.                                                                                                                                                   |
| GitHub repository **variables**   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `BASE_HREF`.                                                                                                                                                    |
| GitHub environment `SUPABASE_URL` | Same variables and secrets can live in this environment (Settings → Environments); the CI jobs read it.                                                                                                       |
| GitHub repository **secrets**     | Optional, for automatic Supabase deploys: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.                                                                                            |
| `ORGANIZER_CODE` secret           | Phrase that unlocks « Espace organisatrice » on the home page and creates an organiser personal link. Set as a Supabase function secret by CI; never committed. Without it, organiser sign-up is disabled.    |
| `ORGANIZER_EMAILS` (optional)     | Comma-separated e-mails of existing e-mail accounts allowed to organise. Synced to `public.organizers` on each deploy; organisers created with the code are kept. If the table is empty, anyone can organise. |
| Edge Function secret (optional)   | `ALLOWED_ORIGINS`: comma-separated CORS origins. Defaults to `*`, which is safe because auth uses bearer tokens, not cookies.                                                                                 |

---

## Deployment

### 1. Create the Supabase project (free, no credit card)

1. Create a project at [supabase.com](https://supabase.com) on the Free plan.
2. Apply the database schema in **one** of these ways:
   - **CLI:** `supabase link --project-ref <ref>`, then `supabase db push`.
   - **Dashboard:** open the SQL editor, paste `supabase/migrations/20261013000000_initial_schema.sql` and run it.
   - **CI:** add the three Supabase secrets (see step 3) and push to `main`.
3. Deploy the Edge Functions with `supabase functions deploy draw-assignments --no-verify-jwt --project-ref <ref>` (same for `personal-access`) and set the organiser code with `supabase secrets set ORGANIZER_CODE=<phrase>`, or let CI do both. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.
4. Under **Authentication → URL Configuration**:
   - Set **Site URL** to `https://<owner>.github.io/<repo>/`.
   - Add `https://<owner>.github.io/<repo>/**` to **Redirect URLs**, plus `http://localhost:4200/**` for local development (CI does this for you).
5. Copy the **Project URL** and the **anon/publishable key** from **Project Settings → API**.

No e-mail provider is needed: people sign in with their personal link.

### 2. Enable GitHub Pages

Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

### 3. Configure the repository

Under **Settings → Secrets and variables → Actions**:

- **Variables:**
  - `SUPABASE_URL` and `SUPABASE_ANON_KEY` (public values).
  - Optional: `BASE_HREF`. Use `/` with a custom domain. The default is `/<repo>/`.
- **Secrets (optional, for automatic database and function deploys):**
  - `SUPABASE_ACCESS_TOKEN`, a personal access token from your Supabase account.
  - `SUPABASE_PROJECT_REF`.
  - `SUPABASE_DB_PASSWORD`.
  - `ORGANIZER_CODE`, the phrase you will type in « Espace organisatrice » to get your organiser link.

### 4. Push to `main`

`.github/workflows/deploy.yml` runs these steps:

1. **frontend:** `pnpm install --frozen-lockfile`, then format check, lint, unit tests, a production build with the right `--base-href`, `config.json` generation and the Pages artifact upload.
2. **database:** spins up PostgreSQL, applies the migrations and runs the RLS test suite.
3. **edge-functions:** `deno check` on both Edge Functions.
4. **deploy-pages:** publishes to `https://<owner>.github.io/<repo>/`.
5. **deploy-supabase:** `supabase db push`, `functions deploy` and the `ORGANIZER_CODE` function secret, only when the Supabase secrets are set.

The Supabase job also runs `scripts/sync-auth-config.mjs`, which adds `<site>/**` to the auth redirect allow-list and sets the site URL if it is still the default. Set the `SITE_URL` variable when the site is not served from `https://<owner>.github.io/<repo>/`. Sign-in uses personal links, so no SMTP server is required. If you also set the optional `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `SMTP_SENDER_EMAIL` secrets, the script configures them and installs the French auth e-mail templates from `supabase/templates/`.

When `ORGANIZER_EMAILS` is set, the Supabase job also syncs those addresses into the organiser list. Organisers created with `ORGANIZER_CODE` are always kept.

Pull requests run steps 1–3 without deploying.

### Moving to another static host

Build with `pnpm build --base-href /` (or the sub-path), put a `config.json` next to `index.html`, and upload `dist/hohowho/browser`. No rewrites, no server and no SSR are needed. Only the workflow's Pages jobs are specific to GitHub.

---

## Gift recommendations

`RecommendationService` merges the suggestions of every provider registered under `GIFT_RECOMMENDATION_PROVIDERS`. If one provider fails, the others still return results.

The built-in `RuleBasedRecommender` is deterministic: the same input always gives the same output.

- **Hard rules:** it drops ideas that conflict with the things to avoid (alcohol, fragrance, nuts…) and ideas whose minimum price is above the event's maximum budget.
- **Scoring:** a declared interest is worth ×3, an interest inferred from keywords in the notes or wishlist ×2, a preferred gift style ×2 and a budget fit +1. Ties are broken by id.
- **Fallback:** when there are no answers, it suggests versatile ideas within the budget.
- **Explanations:** each suggestion carries readable reasons, for example "Interested in coffee" or "Fits the event budget".

**Adding an AI provider later** doesn't require rewriting anything. Implement `GiftRecommendationProvider`. Call your model from a new Supabase Edge Function so its API key stays on the server. Then register the provider in `app.config.ts`:

```ts
{ provide: GIFT_RECOMMENDATION_PROVIDERS, useClass: AiRecommender, multi: true }
```

To extend the catalogue, edit `src/app/recommendations/gift-catalog.ts`. A unit test checks that every tag refers to a known questionnaire option.

## Troubleshooting

| Symptom                                               | Fix                                                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "HoHoWho could not start: Could not load config.json" | Production builds need `config.json` next to `index.html`. Locally, run `pnpm config:write`. In CI, set the `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables.           |
| Blank page or 404 for JS files on GitHub Pages        | Wrong base href. It must match the repository path (`/<repo>/`, case-sensitive) or be `/` with a custom domain. Set `BASE_HREF` if needed.                              |
| Pages job fails with "Get Pages site failed"          | Enable Pages with **Source: GitHub Actions** (step 2).                                                                                                                  |
| "GitHub Pages deployment skipped" warning in CI       | Add the repository **variables** `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then re-run the workflow. Until then CI still checks everything but does not publish the site. |
| « Mauvais code ! » / organiser disabled               | Set the `ORGANIZER_CODE` secret in GitHub and re-run the deploy, or run `supabase secrets set ORGANIZER_CODE=<phrase>`.                                                 |
| A personal link no longer works                       | It was regenerated (from « Mon lien » or by the organiser). Use the newest link, or ask the organiser for a new one (🔗 next to your name).                             |
| "Could not reach the draw service"                    | Deploy the function (`supabase functions deploy draw-assignments`). Check its logs in the dashboard. If you set `ALLOWED_ORIGINS`, it must include your site's origin.  |
| "No valid draw exists with the current exclusions"    | The exclusions leave no possible assignment. Remove some of them.                                                                                                       |
| "You are not allowed to do this."                     | An RLS or privilege check refused the action. For example, only the organiser can invite or draw, and nothing can be changed after the draw.                            |
| Requests fail after a few quiet days                  | Supabase Free pauses inactive projects. Restore the project from the dashboard.                                                                                         |
| `pnpm install` fails in CI with a lockfile error      | Run `pnpm install` locally and commit the updated `pnpm-lock.yaml`.                                                                                                     |
| Angular CLI says the Node.js version is unsupported   | Use Node 24 (or ≥ 22.22.3).                                                                                                                                             |
| Demo data looks odd in development                    | Click **Reset demo data** in the footer, or clear the site's `localStorage`.                                                                                            |
