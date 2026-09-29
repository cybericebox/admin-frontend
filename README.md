# admin-frontend

The administration app of Cyber ICE Box, served on `admin.<domain>`. Platform administrators manage users, events, labs and notifications here. Sign-in goes through the ID app.

## What you can do

- See the platform dashboard and user and notification analytics.
- Find users, open a user and change their access.
- Create events and manage their settings; open an event's site.
- Watch and manage lab infrastructure.
- Edit email and in-app notification templates, check delivery logs and stats, and set notification and mail settings.
- Open the exercise catalog in the exercises app.

## Environment variables

Static builds (`npm run build`, GitHub Pages) read these at build time. The Docker image reads them at container start.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_DOMAIN` | yes | — | Platform apex domain, e.g. `cybericebox.com`. |
| `NEXT_PUBLIC_API_DOMAIN` | no | `api.<domain>` | API host (bare host, no scheme). |
| `NEXT_PUBLIC_ID_DOMAIN` | no | `id.<domain>` | ID app host. |
| `NEXT_PUBLIC_EXERCISES_DOMAIN` | no | `exercises.<domain>` | Exercises app host. |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | no | analytics off | Google Analytics 4 measurement id (`G-…`). |

## Commands

```bash
npm install
npm run dev          # http://localhost:3002
npm run build        # static export → out/
npm run lint
npm run typecheck
npm test             # Vitest

docker build -f deploy/Dockerfile -t cybericebox/admin-frontend .
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_DOMAIN=cybericebox.local cybericebox/admin-frontend
```

## Deployment

- **GitHub Pages** — publishing a release runs `.github/workflows/pages.yml`, which builds the static export and deploys it. Set the variables above (and secrets) on the `github-pages` environment (Settings → Environments); the custom domain is set in Settings → Pages.
- **Docker images** — a push to `develop` builds `cybericebox/admin-frontend:<commit sha>` (`develop-image.yml`); a published release builds `cybericebox/admin-frontend:latest` and `:<release tag>` (`publish-image.yml`).
- **Kubernetes** — manifests are in `deploy/manifests`. Put the values in `config.yaml`; an empty key uses the default.
