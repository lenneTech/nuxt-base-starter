# Nuxt Base Template

A production-ready Nuxt 4 SSR starter with TypeScript, Tailwind CSS v4, NuxtUI v4, and Better Auth.

## Requirements

- Node.js >= 22
- npm >= 10

## Setup

Install dependencies:

```bash
npm install
# or
npm run init
```

Copy environment variables:

```bash
cp .env.example .env
```

Configure your `.env` file with the required values (see Environment Variables section below).

## Development

Start the development server on http://localhost:3001

```bash
npm run dev
```

### Docker Development

```bash
docker build -f Dockerfile.dev -t nuxt-app-dev .
docker run -p 3001:3001 -v $(pwd):/app nuxt-app-dev
```

## Production

Build the application for production:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

Build for specific environments:

```bash
npm run build:develop    # Development environment
npm run build:test       # Test environment
npm run build:prod       # Production environment
```

## Code Quality

Run linting and formatting checks before committing:

```bash
npm run check           # Run lint + format check
npm run fix             # Auto-fix lint + format issues
npm run lint            # OxLint only
npm run format          # OxFmt format only
```

## Testing

Run E2E tests with Playwright:

```bash
npm run test
```

## API Integration

Generate TypeScript types from OpenAPI schema:

```bash
npm run generate-types
```

## Tech Stack

| Technology          | Version | Description                      |
| ------------------- | ------- | -------------------------------- |
| Nuxt                | 4.4.x   | Vue 3 meta-framework with SSR    |
| TypeScript          | 6.0.x   | Strict type checking             |
| Tailwind CSS        | 4.2.x   | Utility-first CSS (Vite plugin)  |
| NuxtUI              | 4.6.x   | Component library with dark mode |
| Pinia               | 0.11.x  | State management                 |
| Better Auth         | 1.5.x   | Authentication framework         |
| @nuxtjs/seo         | 5.1.x   | SEO, sitemap, robots, OG images  |
| Playwright          | 1.59.x  | E2E testing                      |
| @hey-api/openapi-ts | 0.95.x  | API client code generation (dev) |
| Valibot             | 1.3.x   | Schema validation                |

## Key Features

### Authentication (Better Auth)

- Email/password authentication with client-side SHA256 password hashing
- Two-factor authentication (2FA/TOTP) with backup codes
- Passkey/WebAuthn support
- Password reset flow
- Pre-built pages: login, register, forgot-password, reset-password, 2fa
- Route middleware: `auth.global.ts`, `admin.global.ts`, `guest.global.ts`

### UI & Styling

- NuxtUI v4 component library
- Dark/light mode support
- Transition components (Fade, Slide, FadeScale)
- Modal components with `useOverlay` pattern

### SEO & Analytics

- Sitemap generation (`@nuxtjs/seo`)
- robots.txt configuration
- OG image generation
- Plausible Analytics integration

### File Upload

- TUS resumable uploads (`tus-js-client`)
- Pre-built `TusFileUpload.vue` component
- Progress tracking and error handling

### Developer Experience

- OxLint for fast linting
- OxFmt for code formatting
- Auto-generated API client from OpenAPI
- Bug reporting to Linear (dev only via `@lenne.tech/bug.lt`)
- VueUse composition utilities
- dayjs for date/time handling

## AI Assistant

Ready-to-use UI for the `@lenne.tech/nest-server` **AI module**, built on the
`useLtAi*` composables from `@lenne.tech/nuxt-extensions` (NuxtUI + Valibot + toasts).

| Route                        | Audience | Purpose                                                                |
| ---------------------------- | -------- | ---------------------------------------------------------------------- |
| `/app/ai`                    | any user | Streaming chat (`AiChat`) with confirmation flow + token bar + popover |
| `/app/settings/ai`           | any user | Pick the personal default connection + view token usage                |
| `/app/settings/ai-prompts`   | any user | Manage own re-usable prompts ("Vorlagen"), share with tenant           |
| `/app/admin/ai/connections`  | admin    | Connection CRUD + capability auto-detection                            |
| `/app/admin/ai/preferences`  | admin    | Tenant/user default connections (+ enforced)                           |
| `/app/admin/ai/budgets`      | admin    | Per-user/tenant token & prompt limits                                  |
| `/app/admin/ai/interactions` | admin    | Prompt audit log (requires `ai.audit`)                                 |
| `/app/admin/ai/slots`        | admin    | System-prompt slot editor: override / reset / soft-delete defaults     |
| `/app/admin/ai/prompt-hints` | admin    | Learned hint review (approve / reject / activate)                      |

Components live in `app/components/Ai/`: `AiChat`, `AiMessage`, `AiConnectionPicker`,
`AiContextWindow`, `AiPlaceholderHint`, `AiPromptPicker`, `AiTokenBar`, `AiUsageBadge`,
`ModalAiConnection`. The header navigation gains four AI entries for authenticated users
("KI-Assistent", "KI-Vorlagen", "KI-Einstellungen" + "Administration" for admins).
Admin routes are gated by `app/middleware/admin.global.ts` (which delegates the
role check to the auto-imported `isAdminUser()` helper in `app/utils/`).

**Opt-out:** set `ltExtensions.ai.enabled: false` in `nuxt.config.ts` to disable the
client-side AI surface entirely (the layout nav entries and pages will still ship
but the composables short-circuit). For a full opt-out, also delete `app/components/Ai/`,
`app/pages/app/ai/`, `app/pages/app/admin/ai/`, `app/pages/app/settings/ai*.vue`
and the corresponding header entries in `app/layouts/default.vue`.

**Requirements:** the backend must run the `@lenne.tech/nest-server` AI module
(11.26.0+) with at least one connection (admin-created or seeded via `AI_BASE_URL`).
The expected REST routes are `/ai/{prompt,stream,connections,preferences,budget-limits,
interactions,slots,prompts,prompt-hints,placeholders,usage,features}`. The streaming
endpoint (`POST /ai/stream`) flows through the existing `/api` dev proxy. Configure the
client base path in `nuxt.config.ts` (`ltExtensions.ai.basePath`, default `/ai`).

## Environment Variables

Create a `.env` file with the following variables:

```env
# Required
NUXT_PUBLIC_SITE_URL=http://localhost:3001
NUXT_API_URL=http://localhost:3000
NUXT_PUBLIC_API_URL=http://localhost:3000
NUXT_PUBLIC_APP_ENV=development
NODE_ENV=development
```

Optional variables:

```env
NUXT_PUBLIC_WEB_PUSH_KEY=                # Web push notifications
NUXT_LINEAR_API_KEY=              # Bug reporting
NUXT_LINEAR_TEAM_NAME=            # Bug reporting
NUXT_LINEAR_PROJECT_NAME=         # Bug reporting
NUXT_API_SCHEMA=../api/schema.gql # OpenAPI schema path
NUXT_PUBLIC_STORAGE_PREFIX=base-dev      # Local storage prefix
```

## Project Structure

```
app/
├── assets/css/      # Tailwind CSS styles
├── components/      # Vue components (auto-imported)
│   ├── Ai/          # AI assistant UI (Chat, TokenBar, ContextWindow, ...)
│   ├── Modal/       # Modal components
│   ├── Transition/  # Transition animations
│   └── Upload/      # File upload components
├── composables/     # Composables (auto-imported)
│   ├── use-better-auth.ts   # Auth session helpers
│   ├── use-file.ts          # File utilities
│   ├── use-share.ts         # Share API
│   └── use-tus-upload.ts    # TUS upload logic
├── interfaces/      # TypeScript interfaces
├── layouts/         # Nuxt layouts (default, slim)
├── lib/             # Auth client configuration
├── middleware/      # Route guards (auth, admin, guest)
├── pages/           # File-based routing
│   ├── auth/        # Authentication pages (login, register hardening, 2FA, ...)
│   └── app/         # Protected app pages
│       ├── admin/   # Admin dashboard + AI admin (connections, budgets, slots, ...)
│       ├── ai/      # AI chat
│       └── settings/# User settings (security, ai, ai-prompts, ...)
├── utils/           # Utility functions (auto-imported)
│   └── is-admin-user.ts  # Dual-shape admin check (role vs roles[])
└── app.config.ts    # NuxtUI configuration

docs/                # Dev-only documentation layer
tests/
├── unit/            # Vitest unit tests (utils, composables, env)
└── e2e/             # Playwright E2E tests
    └── helpers/     # Shared test helpers (safe-form-submit, ...)
```

## Documentation

- [Nuxt Documentation](https://nuxt.com/docs)
- [NuxtUI Documentation](https://ui.nuxt.com)
- [Better Auth Documentation](https://www.better-auth.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vue 3 Documentation](https://vuejs.org)