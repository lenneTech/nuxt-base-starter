# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Nuxt Base Template**, a starter template for building Nuxt 4 SSR applications. It provides a solid
foundation with essential configuration, basic UI components, and development tools. The template supports both GraphQL
and REST API integration via @lenne.tech/nuxt-base and uses modern Vue 3 composition API patterns.

## Tech Stack

- **Nuxt 4.1.3** with SSR enabled
- **Vue 3** with TypeScript
- **@lenne.tech/nuxt-base** for base functionality and API integration
- **Tailwind CSS** (v4) for styling
- **VeeValidate + Yup** for form validation
- **Pinia** for state management (auto-imported)
- **Playwright** for E2E testing
- **@lenne.tech/bug.lt** for Linear bug reporting integration
- **@nuxtjs/seo** for SEO optimization
- **@nuxtjs/color-mode** for dark/light mode support
- **@nuxtjs/google-fonts** for font management
- **dayjs-nuxt** for date/time handling
- **@vueuse/nuxt** for Vue composition utilities
- **GraphQL + REST API** support via @lenne.tech/nuxt-base

## Key Commands

### Development

```bash
npm run dev              # Start dev server on port 3001
npm run start            # Alias for dev
npm start:extern         # Start dev server accessible externally (0.0.0.0)
npm run start:tunnel     # Start with Cloudflare tunnel
```

### Building

```bash
npm run build            # Production build
npm run build:develop    # Development build
npm run build:test       # Test environment build
```

### Running Production

```bash
npm run start:develop    # Run built app for develop env
npm run start:test       # Run built app for test env
npm run start:prod       # Run built app for production env
```

### Testing

```bash
npm run app:e2e          # Run Playwright E2E tests
npm test                 # No-op (exits 0)
```

### Linting

```bash
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors automatically
```

### Type Generation

```bash
npm run generate-types   # Generate types from REST API schema (clears app/base first)
```

### Maintenance

```bash
npm run reinit           # Nuclear reinstall: removes node_modules, lock file, cache
```

## Architecture

### Directory Structure

```
app/
├── assets/css/          # Global styles (Tailwind CSS)
├── components/          # Vue components
│   └── Transition/      # Reusable transition components (Fade, FadeScale, Slide, etc.)
├── composables/         # Auto-imported composables
│   ├── use-tw.ts        # Tailwind merge utility
│   ├── use-file.ts      # File handling utilities
│   └── use-share.ts     # Share functionality
├── layouts/             # Layout components
│   └── default.vue      # Main application layout
├── pages/               # File-based routing
│   └── index.vue        # Home/landing page
├── base/                # Auto-generated API types (from generate-types)
├── forms/               # Form definitions (auto-imported)
├── interfaces/          # TypeScript interfaces (auto-imported)
├── plugins/             # Nuxt plugins (auto-imported)
├── states/              # Global state definitions (auto-imported)
├── stores/              # Pinia stores (auto-imported)
├── public/              # Static assets
├── app.vue              # Root component
└── error.vue            # Error page

Root:
├── nuxt.config.ts       # Nuxt configuration
├── eslint.config.mjs    # ESLint configuration
├── playwright.config.ts # Playwright E2E test config
├── tsconfig.json        # TypeScript config
└── .env                 # Environment variables
```

### Key Configuration

#### Nuxt Config (`nuxt.config.ts`)

- **app.head**: Title set to "Nuxt Base Starter"
- **devServer.port**: 3001
- **imports.dirs**: Auto-imports from `./states`, `./stores`, `./forms`, `./interfaces`, `./base`, `./plugins`
- **runtimeConfig.public**: API host (gqlHost, host), web push key
- **modules**: `@nuxt/test-utils`, `@lenne.tech/nuxt-base`, `@lenne.tech/bug.lt`, `@vueuse/nuxt`,
  `@nuxtjs/google-fonts`, `@nuxtjs/color-mode`, `dayjs-nuxt`, `@nuxt/image`, `@nuxtjs/plausible`, `@nuxtjs/seo`
- **nuxtBase**: Configure API integration (host, gqlHost, schema, generateTypes, storagePrefix, disableGraphql)
- **bug.lt**: Linear integration enabled for non-production (requires LINEAR_API_KEY, LINEAR_TEAM_NAME,
  LINEAR_PROJECT_NAME)
- **colorMode**: Class suffix disabled for Tailwind v4 compatibility
- **experimental**: asyncContext, typedPages enabled, renderJsonPayloads disabled

#### Environment Variables (`.env.example`)

```
SITE_URL=http://localhost:3001
NODE_ENV=development
APP_ENV=development
API_URL=http://localhost:3000
WEB_PUSH_KEY=
API_SCHEMA=../api/schema.gql
STORAGE_PREFIX=base-dev
GENERATE_TYPES=0
LINEAR_API_KEY=
LINEAR_TEAM_NAME=
LINEAR_PROJECT_NAME=
```

#### ESLint Rules

- Uses `@lenne.tech/eslint-config-vue`
- Unused vars with `_` prefix are ignored
- `vue/object-property-newline`: enforced (no properties on same line)

### Routing & Navigation

The template uses Nuxt's file-based routing system. By default, it includes:

- Home page (`/` - index.vue)

Additional pages can be added in the `app/pages/` directory following Nuxt's routing conventions.

### Included Components

The template provides reusable transition components in `app/components/Transition/`:

- **TransitionFade**: Simple fade transition
- **TransitionFadeScale**: Fade with scale effect
- **TransitionSlide**: Horizontal slide transition
- **TransitionSlideBottom**: Vertical slide from bottom
- **TransitionSlideRevert**: Reverse slide transition

### Composables

The template includes several utility composables:

- **use-tw.ts**: Tailwind CSS class merging utility (tailwind-merge)
- **use-file.ts**: File handling and download utilities
- **use-share.ts**: Web Share API integration

### Layouts

- **default.vue**: Basic application layout (customize based on your needs)

### Important Notes

1. **Template Purpose**: This is a starter template - customize and extend it for your specific project needs
2. **Auto-imports**: Composables, stores, forms, interfaces, base, and plugins are auto-imported - no need for explicit
   imports
3. **SSR**: Server-side rendering is enabled by default
4. **Type Generation**: When connecting to an API backend, run `npm run generate-types` to generate TypeScript types (
   clears `app/base` first)
5. **Port**: Development server runs on port 3001 (not 3000)
6. **API Integration**: Configure via environment variables - supports both GraphQL and REST via @lenne.tech/nuxt-base
7. **Linear Integration**: Bug reporting to Linear is available in non-production environments when configured
8. **Git Workflow**: Main branch is `main`
9. **Linting**: ESLint must report zero warnings before committing (npm run lint)
10. **@lenne.tech/nuxt-base**: Provides authentication, API client, type generation, and utility functions

## Coding Guidelines

### Comments

**Only english comments allowed.** Use comments to explain "why" something is done, not "what" is being done.

### TypeScript Standards

**ALL code must be fully typed** - no implicit `any` types allowed:

1. **Explicit Type Annotations**
   - All variables must have explicit types: `const name: string = 'value'`
   - All function parameters must be typed: `function foo(param: Type): ReturnType`
   - All function return types must be declared: `function bar(): void { }`
   - Computed properties must have type annotations: `const value = computed<Type>(() => ...)`

2. **Interface Location**
   - **ALL interfaces must be extracted to separate files** in `app/interfaces/`
   - File naming convention: `{name}.interface.ts` (e.g., `season-stat.interface.ts`)
   - Interfaces are auto-imported via Nuxt configuration
   - No inline interfaces in Vue components (except local helper types)

### Vue Component Structure

**Script section must follow this exact order:**

```vue
<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type {

...
}
from
'...'  // Type imports first
import {

...
}
from
'...'       // Regular imports second
import Component from '...'     // Component imports last

// ============================================================================
// Composables
// ============================================================================
const route = useRoute()
const router = useRouter()
const {method1, method2} = useComposable()

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({...})

// ============================================================================
// Variables
// ============================================================================
const schema = z.object({...})
type Schema = z.infer<typeof schema>
const state: StateType = reactive({...})
const formRef = ref<Type>(null)

// ============================================================================
// Computed Properties
// ============================================================================
const computed1 = computed<Type>(() =>
...)
const computed2 = computed<Type>(() =>
...)

// ============================================================================
// Lifecycle Hooks
// ============================================================================
watchEffect(() => { ...
})
onMounted(() => { ...
})

// ============================================================================
// Functions
// ============================================================================
function handleAction(): void { ...
}

async function handleAsync(): Promise<void> { ...
}
</script>
```

### File Naming Conventions

- **Interfaces**: `{name}.interface.ts` (e.g., `user.interface.ts`, `user-data.interface.ts`)
- **Composables**: `use-{name}.ts` (e.g., `use-auth.ts`, `use-api.ts`)
- **Components**: PascalCase (e.g., `UserProfile.vue`, `ModalConfirm.vue`)
- **Pages**: kebab-case (e.g., `[id].vue`, `index.vue`)

### ESLint Compliance

**Before committing, always run:**

```bash
npm run lint
```

Common ESLint rules to follow:

- `perfectionist/sort-modules`: Interfaces/types must be alphabetically sorted
- `perfectionist/sort-union-types`: Union types sorted alphabetically (e.g., `'archived' | 'deactivated'`)
- `perfectionist/sort-objects`: Object properties must be sorted
- `curly`: Always use curly braces for if/else blocks
- `max-statements-per-line`: One statement per line

### Code Examples

**❌ Bad - No types:**

```typescript
const state = reactive({
  title: '',
  email: '',
});

function handleSubmit(event) {
  const result = updateData(id, event.data);
}
```

**✅ Good - Fully typed:**

```typescript
const state: FormState = reactive({
  title: '',
  email: '',
});

function handleSubmit(event: FormSubmitEvent<Schema>): void {
  const result: boolean = updateData(id, event.data);
}
```

**❌ Bad - Inline interface:**

```typescript
interface UserData {
    name: string;
    email: string;
}

const users = computed<UserData[]>(() => [...])
```

**✅ Good - Extracted interface:**

```typescript
// In app/interfaces/user-data.interface.ts
export interface UserData {
    name: string;
    email: string;
}

// In component (auto-imported)
const users = computed<UserData[]>(() => [...])
```

### When Creating New Features

1. **Plan with Todo List**: Use structured approach for multi-step tasks
2. **Extract Interfaces**: Move all interfaces to `app/interfaces/`
3. **Full Typing**: Add explicit types to ALL variables and functions
4. **Structure Script**: Follow the section order outlined above
5. **Format changed files with prettier**
6. **Run ESLint**: Ensure zero errors/warnings before completion
7. **Test Locally**: Verify functionality works as expected
