# AMOC Watch

A map-first North Atlantic observatory for explaining AMOC, presenting multiple
physical indicators, and publishing versioned regime-model assessments.

The deployed product is a research alpha. Model v0.2 withholds transition
probabilities until observational and CMIP hindcasts pass the calibration gate;
published snapshots may contain illustrative model-development inputs and are
labelled accordingly in the interface.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

The default scripts run standard Next.js for Vercel. The original Sites/vinext
path remains available as `npm run dev:sites` and `npm run build:sites`.

## Supabase snapshot store

The public API reads the ordered history of published rows from
`public.amoc_assessment_snapshots`. The interface only exposes months and model
versions that exist in that history. When Supabase is unconfigured, unreachable,
or empty, it deliberately falls back to one versioned local research fixture and
labels that state in the interface.

1. Apply `supabase/migrations/202607220001_initial.sql` to the AMOC Watch project.
2. Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the server environment.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` pipeline-only and run
   `npm run supabase:publish` to insert an immutable assessment snapshot.

Publishing is deliberately separate from `npm run build`: deploying interface
code must not create a scientific record as a side effect. Run the publisher
from an operator-controlled or scheduled data workflow after its inputs pass
the validation gate.

Apply the migrations in filename order. The lineage migrations add pipeline
runs, source revisions, normalized observations, raw monthly features, and
feature-to-assessment provenance. `npm run ingest:monthly` executes the bounded
Argo/OISST workflow for the previous complete month, or for `AMOC_TARGET_MONTH`
when supplied by the scheduler.

The anonymous key is only granted `select` access to published rows. Browser
code never receives either key; the Next.js API route is the public boundary.

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
