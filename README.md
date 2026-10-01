# admin-frontend

The platform administration app of Cyber ICE Box: management of users, events, infrastructure, mail and analytics.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI, react-hook-form with Zod, Lexical editor, ECharts. Tests: Vitest with Testing Library. Lint: ESLint 10.

## Prerequisites

Node.js 26 or newer (see `.nvmrc`).

## Commands

```bash
npm install
npm run dev          # dev server on http://localhost:3002
npm run build        # production build (static export to out/)
npm run lint
npm run typecheck
npm test             # Vitest
```

## Static export

Production builds are a **static export** (`output: "export"`, written to `out/`) and need no Node server at runtime; `npm run dev` runs the regular Next.js dev server. `npm start` is `next start` and is only meaningful outside the static build.

## Configuration

`NEXT_PUBLIC_*` values are inlined at build time; the container image substitutes them at start-up, so one image serves any environment. A missing required value fails the build (`next.config.ts`) or the container start; there are no fallbacks.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_MAIN_HOST` | yes | Landing host (bare host, no scheme). |
| `NEXT_PUBLIC_API_HOST` | yes | API host. |
| `NEXT_PUBLIC_ID_HOST` | yes | ID app host. |
| `NEXT_PUBLIC_ADMIN_HOST` | yes | Admin app host (its first label is a reserved event tag when under the event domain). |
| `NEXT_PUBLIC_EXERCISES_HOST` | yes | Exercises app host. |
| `NEXT_PUBLIC_EVENT_DOMAIN` | yes | Event sites are `<tag>.<domain>`; also the shared cookie domain. |
| `DEV_ALLOWED_ORIGINS` | no | Dev only: comma list of hosts allowed by `next dev` (default: the hosts above). |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | no | Google Analytics 4 measurement id. Analytics is off when unset. |

## i18n

All user-facing text lives in `messages/uk.json` and `messages/en.json` and is rendered through the translate function `t("key", { vars })`. Ukrainian is the default language. Every key must exist in both files.

## Deployment

Deployment and cluster configuration: see the infrastructure repository.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Copyright 2024-2026 CyberICEBox
