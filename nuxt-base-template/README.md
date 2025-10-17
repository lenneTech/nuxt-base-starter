# Nuxt Base Template

A modern Nuxt 4 SSR starter template with TypeScript, Tailwind CSS v4, and NuxtUI.

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
npm run lint            # ESLint only
npm run format          # Prettier format only
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

- **Framework:** Nuxt 4.1.3 (Vue 3 Composition API)
- **Language:** TypeScript 5.9.3
- **Styling:** Tailwind CSS 4.1.14
- **UI Library:** NuxtUI 4.0.1
- **State Management:** Pinia
- **Testing:** Playwright
- **API Client:** @hey-api/client-fetch
- **Form Validation:** Valibot

## Key Features

- ✅ Full TypeScript support with strict typing
- ✅ NuxtUI component library with semantic colors
- ✅ Dark/light mode support
- ✅ SEO optimization (sitemap, robots.txt, OG images)
- ✅ Auto-generated API client from OpenAPI schema
- ✅ E2E testing with Playwright
- ✅ ESLint + Prettier configuration
- ✅ Plausible Analytics integration
- ✅ Image optimization with NuxtImage
- ✅ Bug reporting to Linear (dev only)

## Environment Variables

Create a `.env` file with the following variables:

```env
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
API_SCHEMA=../api/schema.gql # API schema path
STORAGE_PREFIX=base-dev      # Local storage prefix
```

## Project Structure

```
app/
├── assets/          # Tailwind CSS configuration
├── components/      # Vue components (auto-imported)
├── composables/     # Composables (auto-imported)
├── interfaces/      # TypeScript interfaces (auto-imported)
├── layouts/         # Nuxt layouts
├── pages/           # File-based routing
└── app.config.ts    # NuxtUI configuration

docs/                # Dev-only documentation layer
tests/               # Playwright E2E tests
```

## Development Guidelines

For detailed coding standards and architecture information, see [CLAUDE.md](./CLAUDE.md).

## Documentation

- [Nuxt Documentation](https://nuxt.com/docs)
- [NuxtUI Documentation](https://ui.nuxt.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vue 3 Documentation](https://vuejs.org)
