# create-nuxt-base

> **Branch: `next`** — Adapted for the new [`lenneTech/nest-base`](https://github.com/lenneTech/nest-base) server. Clone this branch when scaffolding via `lt fullstack init --next`. The `main` branch remains for `lenneTech/nest-server-starter` consumers.
>
> The next branch swaps the auth mount path from `/iam` to `/api/auth` (Better-Auth on nest-base) and points the SDK generator at `/api/openapi.json` (the canonical, non-deprecated path).

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

- `Dockerfile.dev` for containerized development
- Hot reload enabled

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
