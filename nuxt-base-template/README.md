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

| Technology | Version | Description |
|------------|---------|-------------|
| Nuxt | 4.2.x | Vue 3 meta-framework with SSR |
| TypeScript | 5.9.x | Strict type checking |
| Tailwind CSS | 4.1.x | Utility-first CSS (Vite plugin) |
| NuxtUI | 4.3.x | Component library with dark mode |
| Pinia | 0.11.x | State management |
| Better Auth | 1.4.x | Authentication framework |
| Playwright | 1.57.x | E2E testing |
| @hey-api/client-fetch | 0.13.x | Type-safe API client |
| Valibot | 1.2.x | Schema validation |

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

## Environment Variables

Create a `.env` file with the following variables:

```env
# Required
SITE_URL=http://localhost:3001
API_URL=http://localhost:3000
APP_ENV=development
NODE_ENV=development
```

Optional variables:

```env
WEB_PUSH_KEY=                # Web push notifications
LINEAR_API_KEY=              # Bug reporting
LINEAR_TEAM_NAME=            # Bug reporting
LINEAR_PROJECT_NAME=         # Bug reporting
API_SCHEMA=../api/schema.gql # OpenAPI schema path
STORAGE_PREFIX=base-dev      # Local storage prefix
```

## Project Structure

```
app/
├── assets/css/      # Tailwind CSS styles
├── components/      # Vue components (auto-imported)
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
│   ├── auth/        # Authentication pages
│   └── app/         # Protected app pages
├── utils/           # Utility functions
└── app.config.ts    # NuxtUI configuration

docs/                # Dev-only documentation layer
tests/               # Playwright E2E tests
```

## Documentation

- [Nuxt Documentation](https://nuxt.com/docs)
- [NuxtUI Documentation](https://ui.nuxt.com)
- [Better Auth Documentation](https://www.better-auth.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vue 3 Documentation](https://vuejs.org)
