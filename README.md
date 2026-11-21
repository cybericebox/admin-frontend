# admin-frontend

The platform panel of Cyber&nbsp;ICE&nbsp;Box. Platform administrators use it to manage users, events, labs, agents,
notifications and platform settings, and to read analytics and the audit log.

## Where it sits

| Question | Answer |
|---|---|
| Who uses it | Platform administrators and read-only administrators |
| Backend | The platform API at `api.<DOMAIN>`. Sign-in goes through the ID site (`id.<DOMAIN>`) |
| Build output | Static export in `out/`, served by nginx. No Node server at runtime |
| Dev port | 3002 |

## What it does

| Section | What you do there |
|---|---|
| Home (`/dashboard`) | See the current platform status |
| Users (`/users`) | Find users and open a user |
| Events (`/events`) | List events, create an event, open an event |
| Labs (`/labs`) | See agent status, team stands, exercise test labs and the state of the laboratories |
| Agents (`/agents`) | Clusters where the platform runs laboratories: connection, priority, capacity, certificates |
| Resource schedule (`/resources`) | Reservations of events and test bookings, capacity, change requests |
| Resource requests (`/elevations`) | Tasks that need more resources than the platform frame allows |
| Analytics (`/analytics`) | Users, events, tasks, infrastructure and notifications |
| Notifications (`/notifications`) | Banners, broadcasts, email and in-app templates, delivery logs, settings |
| Audit log (`/audit`) | Who did what |
| System errors (`/errors`) | Errors reported by the platform |
| Settings (`/settings`) | Mail, tasks and data retention |

Text is Ukrainian by default, with English available.

## Run it locally

Tools are pinned in `mise.toml`: `mise install` puts Node.js in place, `mise tasks` lists the commands. You need a running platform backend; the site derives its API host from the base
domain.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3002
```

## Configure

`NEXT_PUBLIC_*` values are inlined at build time. The container image substitutes them at start, so one image serves
any environment. A missing required value fails the build or the container start; there are no fallbacks.

- `.env.example` is the template. Required: the base domain and the support mailbox.
- `NEXT_PUBLIC_DOMAIN` is the only host input. The API, the other sites and the shared cookies derive from it.
- `npm run check:cfg` builds the way the Dockerfile does and checks that every placeholder survives in the bundle.
- Optional installation values mean "no value, not shown". An installation that sets none of them says nothing in our
  name.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_MAIN_SITE_URL` | no | `https://` URL of the main site. Set: the logo and the «home» button lead there. Empty: the logo leads to `/` of this site. |
| `NEXT_PUBLIC_COOKIES_URL` | no | `https://` URL of the Cookie Policy. Empty: no link in the cookie banner. |
| `NEXT_PUBLIC_RETENTION_URL` | no | `https://` URL of the retention file (see below). Its origin is the only extra `connect-src` source. |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | no | Google Analytics 4 id. Analytics is off when unset. |

### Retention file

An installation with a Privacy Policy can publish the retention periods it states as one JSON file and set
`NEXT_PUBLIC_RETENTION_URL`. The retention settings are then compared with it and a mismatch gets a note under the
field; saving is never blocked. The format is in `retention.schema.json`, with an example in
`retention.example.json`.

## Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build, static export to `out/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest with Testing Library) |
| `npm run check:cfg` | Checks that config placeholders survive the build |
| `npm run check:ds` | Fails if a copied design-system file was edited by hand |
| `npm run sync:errors` | Adds new backend error codes to `messages/errors.*.json` (needs a `daemon` checkout at `../daemon`) |

`scripts/test-nginx-tls.sh` checks the container's TLS and client-certificate modes (needs Docker).

## Rules for changes

- Every user-visible string goes through `messages/uk.json` and `messages/en.json` and `t("key", { vars })`. Add each
  key to both files.
- Loading, empty and error states are centered in their block, with the crest loader, the shared empty-state icon and
  the shared error component.

## Container

The image serves the export with nginx: plain HTTP on 8080, a health listener on 8081 (`/healthz` only), and TLS on
8443 when `/tls/tls.crt` and `/tls/tls.key` are mounted. Client certificates are required when `/aop/ca.crt` is
mounted. The config is in `deploy/nginx/`; `deploy/nginx-entrypoint.sh` validates the environment and fails the start
on a bad combination. At start, `deploy/csp.sh` hashes the inline scripts and writes the Content Security Policy
header; the origin of the retention file is the only extra `connect-src` source.

## Releases and contributing

Branches, pull requests and releases: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
