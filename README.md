# nuxt-base-starter

A production-ready **Nuxt 4** starter template with TypeScript, Tailwind CSS v4, NuxtUI v4, Better Auth and modern tooling. The app lives in [`nuxt-base-template/`](./nuxt-base-template); this repository root only carries the release tooling.

## Quick Start

New projects are scaffolded by the [lenne.Tech CLI](https://github.com/lenneTech/cli), which clones the current template from this repository:

```bash
npm install -g @lenne.tech/cli

# Frontend only
lt frontend nuxt --name my-awesome-project

# Or a fullstack monorepo (API + this app)
lt fullstack init
```

Then `cd` into the project and run `pnpm run dev`. The development server starts at **http://localhost:3001**.

> `npx create-nuxt-base` is retired. The npm package stopped receiving releases at 2.7.0 and still
> ships that old template; use the lt CLI instead.

## What's Included

### Core Framework

| Technology   | Version | Description                           |
| ------------ | ------- | ------------------------------------- |
| Nuxt         | 4.x     | Vue 3 meta-framework with SSR support |
| TypeScript   | 6.0.x   | Strict type checking enabled          |
| Tailwind CSS | 4.x     | Utility-first CSS with Vite plugin    |
| NuxtUI       | 4.x     | Component library with dark mode      |

### Authentication (Better Auth)

Complete authentication system using [Better Auth](https://www.better-auth.com/):

| Feature            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| Email/Password     | Standard auth with client-side SHA256 hashing         |
| Two-Factor (2FA)   | TOTP-based 2FA with backup codes                      |
| Passkey/WebAuthn   | Passwordless authentication (Touch ID, Face ID, etc.) |
| Password Reset     | Email-based password reset flow                       |
| Session Management | SSR-compatible cookie-based sessions                  |

Pre-built auth pages: login, register, forgot-password, reset-password, 2fa

📖 **See [AUTH.md](./AUTH.md) for detailed documentation**

### State & Data

| Package               | Purpose                     |
| --------------------- | --------------------------- |
| Pinia                 | State management            |
| VueUse                | Vue composition utilities   |
| @hey-api/client-fetch | Type-safe API client        |
| Valibot               | Schema validation for forms |

### SEO & Analytics

- **@nuxtjs/seo** - Sitemap, robots.txt, Schema.org (OG images, AI Ready and Skew Protection are off by default)
- **@nuxtjs/plausible** - Privacy-friendly analytics

### Developer Experience

| Tool               | Purpose                            |
| ------------------ | ---------------------------------- |
| OxLint             | Fast linting                       |
| OxFmt              | Code formatting                    |
| Playwright         | E2E testing                        |
| @lenne.tech/bug.lt | Bug reporting to Linear (dev only) |
| dayjs-nuxt         | Date/time handling                 |

### File Upload

- TUS resumable upload support (`tus-js-client`)
- Pre-built `TusFileUpload.vue` component

### Docker Support

- Multi-stage production `Dockerfile` (non-root runner, self-contained Nitro output)
- Built from the **monorepo root** as build context: `docker build -f projects/app/Dockerfile .`
- Build identity injected at runtime via `NUXT_PUBLIC_APP_COMMIT`
- `HEALTHCHECK` on `GET /`; container listens on port 3000 (compose maps host 3001 → 3000)
- Local development runs via `lt dev up`, not in a container
- Migrating an existing fork? See [`migration-guides/2.11.0-docker-workflow.md`](migration-guides/2.11.0-docker-workflow.md)

## Project Structure

```
my-project/
├── app/
│   ├── assets/css/       # Tailwind CSS
│   ├── components/       # Vue components (auto-imported)
│   │   ├── Modal/        # Modal components
│   │   ├── Transition/   # Transition components
│   │   └── Upload/       # File upload components
│   ├── composables/      # Composables (auto-imported)
│   ├── interfaces/       # TypeScript interfaces
│   ├── layouts/          # Nuxt layouts
│   ├── lib/              # Auth client configuration
│   ├── middleware/       # Route middleware (auth, admin, guest)
│   ├── pages/            # File-based routing
│   │   ├── auth/         # Authentication pages
│   │   └── app/          # Protected app pages
│   ├── utils/            # Utility functions
│   └── app.config.ts     # NuxtUI configuration
├── docs/                 # Developer docs (Markdown, not served)
├── tests/                # Playwright E2E tests
├── nuxt.config.ts        # Nuxt configuration
├── openapi-ts.config.ts  # API type generation config
└── playwright.config.ts  # E2E test configuration
```

## Available Scripts

| Script                    | Description                            |
| ------------------------- | -------------------------------------- |
| `pnpm run dev`            | Start development server               |
| `pnpm run build`          | Build for production                   |
| `pnpm run preview`        | Preview production build               |
| `pnpm run generate-types` | Generate TypeScript types from OpenAPI |
| `pnpm run test`           | Run Playwright E2E tests               |
| `pnpm run lint`           | Run OxLint                             |
| `pnpm run format`         | Run OxFmt                              |
| `pnpm run check`          | Run lint + format check                |
| `pnpm run fix`            | Auto-fix lint + format issues          |

## Environment Variables

Create a `.env` file based on `.env.example`:

Note the `NUXT_` / `NUXT_PUBLIC_` prefixes — Nitro maps only prefixed variables onto
`runtimeConfig`, so an unprefixed `SITE_URL` reaches nothing.

```env
# Required
NUXT_PUBLIC_SITE_URL=http://localhost:3001
NUXT_API_URL=http://localhost:3000
NUXT_PUBLIC_API_URL=http://localhost:3000
NUXT_PUBLIC_APP_ENV=local
NODE_ENV=development

# Optional
NUXT_PUBLIC_WEB_PUSH_KEY=          # Web push notifications
NUXT_PUBLIC_STORAGE_PREFIX=base-dev # Local storage prefix
LINEAR_API_KEY=                    # Bug reporting
LINEAR_TEAM_NAME=                  # Bug reporting
LINEAR_PROJECT_NAME=               # Bug reporting
```

**`NUXT_PUBLIC_SITE_URL` must be set on every non-local stage.** It is the public
origin of the app itself, and it feeds two things: the SEO site config (canonical
URLs, OG tags, sitemap) and the absolute redirect URLs that go into password-reset
and e-mail-verification mails. Left unset in production, the SEO half falls back to
the request's `X-Forwarded-Host` and the auth half falls back to whichever origin the
browser happens to be on — correct for a single-origin deployment, wrong behind a
proxy or vanity domain, where users receive links pointing at the internal host.

Use the `NUXT_PUBLIC_` form, not `NUXT_SITE_URL`: both reach the SEO config, but only
the public form also populates `runtimeConfig.public.siteUrl` for the auth redirects.

## Requirements

- Node.js ^22.22.3 or ^24.15.0 (the floor of Nuxt 4.6 and @nuxtjs/seo 6)
- pnpm 11 (pinned through `packageManager`)

## License

MIT
