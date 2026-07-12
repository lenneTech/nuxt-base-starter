# create-nuxt-base

A CLI tool to scaffold a production-ready **Nuxt 4** application with TypeScript, Tailwind CSS v4, NuxtUI v4, and modern tooling.

## Quick Start

```bash
npx create-nuxt-base my-awesome-project
cd my-awesome-project
pnpm run dev
```

The development server starts at **http://localhost:3001**

## What's Included

### Core Framework

| Technology   | Version | Description                           |
| ------------ | ------- | ------------------------------------- |
| Nuxt         | 4.x     | Vue 3 meta-framework with SSR support |
| TypeScript   | 5.9.x   | Strict type checking enabled          |
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

- **@nuxtjs/seo** - Sitemap, robots.txt, OG images
- **@nuxtjs/plausible** - Privacy-friendly analytics
- **@nuxt/image** - Image optimization with IPX

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
├── docs/                 # Dev-only documentation layer
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

```env
# Required
SITE_URL=http://localhost:3001
API_URL=http://localhost:3000
APP_ENV=development
NODE_ENV=development

# Optional
WEB_PUSH_KEY=                # Web push notifications
LINEAR_API_KEY=              # Bug reporting
LINEAR_TEAM_NAME=            # Bug reporting
LINEAR_PROJECT_NAME=         # Bug reporting
STORAGE_PREFIX=base-dev      # Local storage prefix
```

## Requirements

- Node.js >= 22
- pnpm >= 9

## License

MIT
