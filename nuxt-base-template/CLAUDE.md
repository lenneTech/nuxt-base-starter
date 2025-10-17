# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Nuxt 4** (v4.1.3) SSR starter template built with Vue 3 Composition API, TypeScript, and Tailwind CSS v4. The project uses NuxtUI for components and follows strict TypeScript typing conventions.

**Requirements:**
- Node.js >= 22
- npm >= 10

## Essential Commands

### Development
```bash
npm run dev          # Start dev server on http://localhost:3001
npm run start:extern # Dev server on 0.0.0.0 (external access)
```

### Code Quality (Run Before Commits)
```bash
npm run check        # Run lint + format check
npm run fix          # Auto-fix lint + format issues
npm run lint         # ESLint only
npm run format       # Prettier format
```

### Build & Preview
```bash
npm run build               # Production build
npm run build:develop       # Development environment build
npm run build:test          # Test environment build
npm run build:prod          # Production environment build
npm run preview             # Preview production build
```

### Testing
```bash
npm run test         # Run Playwright E2E tests
```

### API Types
```bash
npm run generate-types  # Generate API client from OpenAPI schema
```

### Maintenance
```bash
npm run clean        # Remove .nuxt, .output, node_modules/.vite
npm run reinit       # Complete reset and reinstall
```

## Architecture Overview

### Directory Structure

```
app/
├── assets/css/          # Tailwind v4 configuration
├── components/          # Vue components (auto-imported)
│   ├── Modal/           # Reusable modal component
│   └── Transition/      # Vue transition wrappers
├── composables/         # Vue composables (auto-imported)
├── interfaces/          # TypeScript interfaces (auto-imported)
├── layouts/             # Nuxt layouts (default, slim)
├── pages/               # File-based routing
├── public/              # Static assets
├── app.vue              # Root component
└── app.config.ts        # NuxtUI configuration

docs/                    # Dev-only documentation layer
tests/                   # Playwright E2E tests
```

### Auto-Import Configuration

The following directories are auto-imported by Nuxt:
- `components/` - Vue components
- `composables/` - Composables (use-*.ts)
- `interfaces/` - TypeScript interfaces
- `states/` - State management
- `stores/` - Pinia stores
- `forms/` - Form definitions
- `plugins/` - Vue plugins

### Key Configuration Files

- **nuxt.config.ts** - Main Nuxt configuration
  - Dev server: Port 3001
  - SSR: Enabled
  - Experimental: asyncContext, typedPages
  - Modules: NuxtUI, Pinia, VueUse, Dayjs, NuxtImage, SEO, Plausible
  - Docs layer enabled in development only

- **app.config.ts** - NuxtUI configuration
  - Color palette: Primary (green), Secondary (indigo), Success (emerald), Info (blue), Warning (amber), Error (red), Neutral (slate)
  - Dark/light mode with Lucide icons
  - Toast: 5s duration, bottom-right position

- **eslint.config.mjs** - Uses `@lenne.tech/eslint-config-vue` with perfectionist sorting rules

- **openapi-ts.config.ts** - API client generation
  - Client: @hey-api/client-fetch
  - Output: ./app/api-client

### API Integration

API client is auto-generated from OpenAPI schema:

```bash
npm run generate-types  # Generate types from API schema
```

Generated client location: `./app/api-client`

Use environment variable `API_URL` to configure the API endpoint.

### TypeScript & Interface Management

**ALL interfaces must be extracted to separate files:**
- Location: `app/interfaces/`
- Naming: `{name}.interface.ts` (e.g., `season.interface.ts`)
- Auto-imported via Nuxt configuration
- No inline interfaces in components (except local helper types)

**Full typing is mandatory:**
- All variables have explicit types
- All function parameters are typed
- All function return types declared
- Computed properties: `computed<Type>(() => ...)`

### Component Structure

Vue components follow strict section ordering:

```vue
<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
// 1. Vue & Nuxt core
// 2. Third-party libraries
// 3. Type imports (grouped)
// 4. Composables
// 5. Components

// ============================================================================
// Composables
// ============================================================================

// ============================================================================
// Page Meta
// ============================================================================

// ============================================================================
// Variables
// ============================================================================

// ============================================================================
// Computed Properties
// ============================================================================

// ============================================================================
// Lifecycle Hooks
// ============================================================================

// ============================================================================
// Functions
// ============================================================================
</script>

<template>
  <!-- Template content -->
</template>
```

### Composables Pattern

```typescript
// app/composables/use-example.ts
export function useExample() {
  // State
  const loading = ref<boolean>(false);
  const data = ref<DataType[]>([]);

  // Methods
  async function fetchData(): Promise<void> {
    // Implementation
  }

  // Return public API
  return {
    loading,
    data,
    fetchData
  };
}
```

### ESLint Rules

Key rules enforced:
- `perfectionist/sort-modules` - Alphabetically sort interfaces/types
- `perfectionist/sort-union-types` - Sort union types alphabetically
- `perfectionist/sort-objects` - Sort object properties
- `curly` - Always use curly braces for if/else
- `max-statements-per-line` - One statement per line

**Always run `npm run check` before committing.**

### Testing with Playwright

Configuration:
- Base URL: http://localhost:3001
- Test directory: `./tests`
- Browser: Desktop Chrome
- Locale: German (de)
- Retries: 2 on CI, 0 locally

Example test:
```typescript
import { test } from '@nuxt/test-utils/playwright';

test('example test', async ({ goto, page }) => {
  await goto('.', { waitUntil: 'domcontentloaded' });
  // Test logic
});
```

### Environment Variables

Required variables (see `.env.example`):
```
SITE_URL=http://localhost:3001
API_URL=http://localhost:3000
APP_ENV=development
NODE_ENV=development
```

Optional:
- `WEB_PUSH_KEY` - Web push notifications
- `LINEAR_API_KEY`, `LINEAR_TEAM_NAME`, `LINEAR_PROJECT_NAME` - Bug reporting
- `API_SCHEMA` - Path to API schema for type generation
- `STORAGE_PREFIX` - Local storage prefix

### Special Features

**NuxtUI (v4.0.1):**
- Component library with semantic color system
- Dark/light mode support
- Pre-configured toast notifications
- Form validation utilities

**SEO (@nuxtjs/seo):**
- Sitemap generation (excludes /app/**, /auth/**)
- Robots.txt (disallows /app, /auth, /admin)
- OG image generation

**Analytics:**
- Plausible Analytics (disabled on localhost)

**Bug Reporting:**
- Linear integration via @lenne.tech/bug.lt
- Disabled in production
- Requires LINEAR_* environment variables

**State Management:**
- Pinia stores with auto-imports

**Image Optimization:**
- NuxtImage with IPX provider
- 30-day cache

### Naming Conventions

- **Files:**
  - Interfaces: `{name}.interface.ts`
  - Composables: `use-{name}.ts`
  - Components: PascalCase (e.g., `ModalBase.vue`)
  - Pages: kebab-case (e.g., `login.vue`, `[id].vue`)

- **Code:**
  - Variables: camelCase
  - Booleans: `isLoading`, `hasError`, `canSubmit`
  - Functions: Verb-based (`handleSubmit`, `fetchData`)
  - Event handlers: `handle{Action}` or `on{Action}`

### Development Workflow

1. **Starting a feature:**
   - Plan structure with interfaces in `app/interfaces/`
   - Create composables in `app/composables/` if needed
   - Build components following the strict section ordering

2. **Before committing:**
   ```bash
   npm run check    # Lint + format check
   npm run test     # E2E tests
   npm run build    # Verify production build
   ```

3. **API changes:**
   ```bash
   npm run generate-types  # Regenerate API client
   ```

4. **Type safety:**
   - Extract all interfaces to separate files
   - Add explicit types to all variables and functions
   - Never use implicit `any`

### Common Patterns

**Reactive state:**
```typescript
// Single values
const loading = ref<boolean>(false);

// Objects
const state: FormState = reactive({
  title: '',
  date: null
});

// Derived data
const filtered = computed<Type[]>(() => ...);
```

**Modal usage:**
```vue
<ModalBase :model-value="isOpen" @close="handleClose">
  <template #header>Title</template>
  <template #default>Content</template>
  <template #footer>
    <UButton @click="handleClose">Close</UButton>
  </template>
</ModalBase>
```

**Transitions:**
```vue
<TransitionFade>
  <div v-if="show">Content</div>
</TransitionFade>
```

### Project Status

**Current Branch:** DEV-609 (development branch)
**Main Branch:** main (use for PRs)

Recent focus: Package dependency updates and ESLint configuration improvements.

### Important Notes

- **Port:** Dev server runs on **3001** (not 3000)
- **Docs layer:** Enabled only in development (extends config)
- **TypeScript target:** ES2022
- **SSR:** Enabled by default
- **npm configuration:** shamefully-hoist=true, strict-peer-dependencies=false
