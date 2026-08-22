// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

import pkg from './package.json';

// Build identity surfaced under /app/admin/system so we can always tell which
// build is running and compare App vs. API. These are the build-time defaults;
// the production image overrides appCommit at runtime via NUXT_PUBLIC_APP_COMMIT
// (see Dockerfile), which keeps the commit out of the `nuxt build` cache key.
// APP_VERSION_COMMIT stays as the escape hatch for local / manual builds.
const appVersion = (pkg as { version?: string }).version || '0.0.0';
const appCommit = process.env.APP_VERSION_COMMIT || 'unknown';

// Deployment environment. NUXT_PUBLIC_APP_ENV wins when set; otherwise fall back
// to NODE_ENV so `nuxt dev` (NODE_ENV=development) gets dev features on a fresh
// clone WITHOUT a copied .env. Every other NODE_ENV resolves to "production" —
// including an unset one, which nuxi defaults to "production" at build time — so
// a Docker image with .env stripped and no build-arg stays production-safe. Note
// `build:test` (NODE_ENV=test) therefore also ships as production unless it sets
// NUXT_PUBLIC_APP_ENV explicitly.
const appEnv = process.env.NUXT_PUBLIC_APP_ENV || (process.env.NODE_ENV === 'development' ? 'local' : 'production');

// Dev-only surfaces — the ./docs layer and the landing-page dev card — are BAKED
// at build time. The runtime NUXT_PUBLIC_APP_ENV can relabel a running container
// but cannot add a route that was never built, so anything linking into ./docs
// must gate on this build-time flag, not on the runtime public.appEnv.
const devBuild = ['development', 'local'].includes(appEnv);

export default defineNuxtConfig({
  // ============================================================================
  // App Configuration
  // ============================================================================
  app: {
    head: {
      // The UI is German throughout. Without this, screen readers pronounce every
      // label with English phonetics (WCAG 3.1.1). Set once here for the whole app.
      htmlAttrs: {
        lang: 'de',
      },
      title: 'Nuxt Base Starter',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    },
  },

  // ============================================================================
  // App Config (build-frozen, reaches the client via useAppConfig())
  // ============================================================================
  appConfig: {
    // Were dev-only surfaces (./docs layer + landing-page dev card) built into
    // THIS bundle? Kept in app config, NOT runtimeConfig.public, precisely so a
    // NUXT_PUBLIC_* env var cannot flip it at runtime — the client gates the dev
    // card on it so the card never links to a /docs route the build omitted.
    devBuild,
  },

  // ============================================================================
  // Bug Reporting (Linear Integration via @lenne.tech/bug.lt)
  // ============================================================================
  // @ts-ignore bug.lt module has no type declarations
  bug: {
    // Module options are frozen at build time, so the reporter widget is a BUILD
    // choice: the image built without NUXT_PUBLIC_APP_ENV stays production and
    // ships no widget, while a staging image built with NUXT_PUBLIC_APP_ENV set
    // (see Dockerfile builder ARG) enables it. A running container cannot toggle
    // this — bug.lt returns early on `enabled: false` and never registers the
    // runtimeConfig it would need to re-enable at runtime.
    enabled: appEnv !== 'production',
    linearApiKey: process.env.NUXT_LINEAR_API_KEY,
    linearProjectName: process.env.NUXT_LINEAR_PROJECT_NAME,
    linearTeamName: process.env.NUXT_LINEAR_TEAM_NAME,
  },

  // ============================================================================
  // Build Directory
  // ============================================================================
  // `nuxt dev`, `nuxt prepare` and `nuxt build` all write their generated types
  // — including `tsconfig.json` — into this directory. With one shared `.nuxt/`
  // a parked dev server rewrites that file in place while the `check` chain's
  // type-check is reading it, and the run fails with a flood of TS2307 on every
  // `~`/`#` alias plus TS1378 — on code that is perfectly fine. It looks exactly
  // like a real type error, so it costs a debugging round every time.
  //
  // Making the directory overridable gives the gates their own copy:
  // `build:check` / `typecheck:tests` run with `NUXT_BUILD_DIR=.nuxt-check` and
  // type-check against `tsconfig.check.json` / `tsconfig.tests.check.json`,
  // which resolve through `./.nuxt-check/tsconfig.json`. The dev server and the
  // IDE keep the unchanged `.nuxt/` default, so `check` and `dev` can run in
  // parallel. `tests/unit/nuxt-builddir-isolation.test.ts` keeps the wiring
  // honest.
  //
  // `||`, not `??`: an exported-but-empty `NUXT_BUILD_DIR=` is falsy but not
  // nullish, so `??` would forward `''`. Nuxt's schema happens to catch that
  // (`val && typeof val === 'string' ? val : '.nuxt'`) — but relying on it puts
  // the safety in the framework, and without it `resolve(rootDir, '')` is the
  // rootDir itself, i.e. Nuxt would write `tsconfig.json` / `nuxt.d.ts` /
  // `types/` straight over the checked-in sources in this directory.
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',

  // The OUTPUT dir — the second half of the same problem (DEV-2724). `buildDir`
  // above and Nitro's `output.dir` are unrelated knobs, so splitting the former
  // left `.output/` shared between `build`, `build:check` and `lt dev test`. And
  // `lt dev test` rewrites it on EVERY run: it serves the production bundle
  // rather than `nuxt dev`, so each suite run overwrote whatever a local
  // `pnpm run build` (or a server started from it) was using. Nitro ships no env
  // lever of its own here — unlike `buildDir` there is no `NITRO_OUTPUT_DIR` that
  // works out of the box — so this opens one.
  //
  // `||`, not `??`, for the same reason as `buildDir`: an exported-but-empty
  // `NITRO_OUTPUT_DIR=` is falsy but not nullish, and Nitro resolves `output.dir`
  // against `rootDir`, so `''` would resolve to the rootDir itself.
  //
  // `publicDir` / `serverDir` are deliberately NOT set: Nitro defaults them to
  // `{{ output.dir }}/public` and `{{ output.dir }}/server` and resolves
  // `output.dir` first, so they follow this on their own.
  nitro: {
    output: {
      dir: process.env.NITRO_OUTPUT_DIR || '.output',
    },
  },

  compatibilityDate: '2025-01-15',

  // ============================================================================
  // Styles
  // ============================================================================
  css: ['~/assets/css/tailwind.css'],

  // ============================================================================
  // Development Server
  // ============================================================================
  devServer: {
    port: Number(process.env.PORT) || 3001,
  },

  // ============================================================================
  // Experimental Features
  // ============================================================================
  experimental: {
    asyncContext: true,
    renderJsonPayloads: false,
    typedPages: true,
  },

  // ============================================================================
  // Environment-specific Layers
  // ============================================================================
  extends: devBuild ? ['./docs'] : [],

  // ============================================================================
  // Image Optimization
  // ============================================================================
  image: {
    ipx: {
      maxAge: 2592000, // 30 days
    },
    provider: 'ipx',
  },

  // ============================================================================
  // Icon Configuration
  // ============================================================================
  icon: {
    // Icons used in v-for loops or dynamic rendering must be in the client bundle
    // Dynamic icons can set via icons, e.g. icons: ['lucide:trash', 'lucide:key', 'lucide:copy', 'lucide:loader-circle'],
    clientBundle: {
      scan: true,
    },
    // Move the icon fallback endpoint off `/api/**`.
    //
    // The Vite dev proxy below forwards every `/api/*` request to the backend,
    // so the module's default `/api/_nuxt_icon/:collection` is answered by the
    // NestJS API with a 404. Any icon that misses the client bundle — a runtime
    // name like `i-lucide-${key}`, or one configured in `app.config.ts` — then
    // silently fails to render, with nothing but a console warning to say why.
    localApiEndpoint: '/_nuxt_icon',
  },

  // ============================================================================
  // Auto-imports
  // ============================================================================
  imports: {
    dirs: ['./states', './stores', './forms', './interfaces', './base', './plugins'],
  },

  // ============================================================================
  // lenne.tech Nuxt Extensions
  // ============================================================================
  ltExtensions: {
    ai: {
      // AI assistant composables. basePath must match the nest-server AI controller.
      enabled: true,
      basePath: '/ai',
    },
    auth: {
      enabled: true,
      // baseURL: resolved at runtime via NUXT_PUBLIC_API_URL (not baked at build time)
      // Local dev: .env provides http://localhost:3000
      // Production: deployment env provides the production API URL
      baseURL: '',
      basePath: '/iam',
      loginPath: '/auth/login',
      twoFactorRedirectPath: '/auth/2fa',
      enableAdmin: true,
      enableTwoFactor: true,
      enablePasskey: true,
      systemSetup: {
        enabled: true,
        setupPath: '/auth/setup',
      },
      interceptor: {
        enabled: true,
        publicPaths: ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/setup'],
      },
    },
    tus: {
      defaultEndpoint: '/files/upload',
      defaultChunkSize: 5 * 1024 * 1024,
    },
  },

  // ============================================================================
  // Nuxt Modules
  // ============================================================================
  modules: [
    '@lenne.tech/nuxt-extensions', // Auth, Upload, Transitions
    '@nuxt/test-utils/module', // E2E testing with Playwright
    '@lenne.tech/bug.lt', // Bug reporting to Linear
    '@vueuse/nuxt', // Vue composition utilities
    '@nuxt/image', // Image optimization
    '@nuxt/ui', // NuxtUI component library
    '@nuxtjs/plausible', // Privacy-friendly analytics
    '@nuxtjs/seo', // SEO optimization (sitemap, robots, og-image)
    '@pinia/nuxt', // State management — `pinia` is its required peer dependency (kept explicit in package.json; do not drop it as "unused")
  ],

  // ============================================================================
  // Analytics (Plausible)
  // ============================================================================
  plausible: {
    apiHost: process.env.NUXT_PLAUSIBLE_API_URL,
    ignoredHostnames: ['localhost'],
  },

  // ============================================================================
  // SEO: Robots.txt
  // ============================================================================
  robots: {
    // '/docs' is only built into dev bundles (see `extends`), but list it anyway
    // as defense-in-depth: if a dev build is ever relabeled to production at
    // runtime, the docs route stays out of crawlers regardless.
    disallow: ['/app', '/auth', '/admin', '/docs'],
  },

  // ============================================================================
  // Route Rules
  // ============================================================================
  routeRules: {
    // robots.txt already disallows these prefixes, but robots.txt only asks. A
    // per-route `noindex` header travels with the page itself, so a URL that leaks
    // (a shared reset link, a referrer) stays out of an index even when the crawler
    // never read robots.txt.
    '/admin/**': { robots: false },
    '/app/**': { robots: false },
    '/auth/**': { robots: false },
  },

  // ============================================================================
  // Runtime Configuration (Environment Variables)
  // ============================================================================
  runtimeConfig: {
    // Server-only — NUXT_API_URL overrides at runtime
    // Local dev: .env provides http://localhost:3000
    apiUrl: '',
    public: {
      // Build identity (see top of file). Compared against the API's GET /meta
      // under /app/admin/system to detect a drifted / stale deployment. Nitro
      // applies NUXT_PUBLIC_APP_COMMIT / _APP_VERSION over these on boot — but
      // only for keys declared here, hence the explicit defaults.
      appCommit,
      // Deployment environment ("local", "development", "production", ...).
      // MUST be declared for NUXT_PUBLIC_APP_ENV to take effect at runtime; the
      // baked default follows the build (production unless this is a dev build),
      // so an unset variable never unlocks dev-only UI on a production image.
      appEnv,
      appVersion,
      // Client-side — NUXT_PUBLIC_API_URL overrides at runtime
      // Local dev: .env provides http://localhost:3000
      apiUrl: '',
      // Public origin of THIS app. Builds the absolute auth redirect URLs that end
      // up in password-reset and e-mail-verification links (see utils/app-origin.ts).
      //
      // MUST be declared here: Nitro applies NUXT_PUBLIC_* only over keys that
      // already exist in runtimeConfig.public. An undeclared key stays `undefined`
      // no matter how the variable is set — which is exactly how a template literal
      // once produced the text "undefined/auth/reset-password" and locked users out.
      // `tests/unit/runtime-config-contract.test.ts` now guards that for every
      // documented NUXT_PUBLIC_* variable.
      //
      // Use NUXT_PUBLIC_SITE_URL, never NUXT_SITE_URL. Both feed the SEO site config
      // (canonicals, OG tags, sitemap), but only the NUXT_PUBLIC_ form also reaches
      // this key — Nitro derives the variable name from the `public.siteUrl` path.
      // Setting only NUXT_SITE_URL yields correct canonicals and an empty auth origin.
      //
      // Empty is safe but not intended for production: the client then falls back to
      // the browser's own origin, which is right for a single-origin deployment and
      // wrong behind a proxy or vanity domain. The fallback warns on the console.
      siteUrl: '',
      // NUXT_PUBLIC_WEB_PUSH_KEY overrides this
      webPushKey: '',
      // API Proxy: Routes client-side /api/* requests through the Vite dev proxy
      // to the backend (localhost:3000). Required for same-origin cookies during
      // local development. Set NUXT_PUBLIC_API_PROXY=true in .env ONLY for local dev.
      // Nuxt auto-maps NUXT_PUBLIC_API_PROXY to this key.
      // See: @lenne.tech/nuxt-extensions → isLocalDevApiProxy()
      apiProxy: false,
    },
  },

  // ============================================================================
  // SEO: Site Metadata
  // ============================================================================
  site: {
    name: 'Nuxt Base Starter',
    // No `url` here on purpose. nuxt-site-config's own `initSiteConfig()` already
    // reads NUXT_SITE_URL / NUXT_PUBLIC_SITE_URL — at build time with priority
    // `build` (-1) and again per request with priority `runtime` (0). A `url` set
    // in this block lands at priority `config` (-3), so it could never win; writing
    // it here only suggests an authoritative source that isn't one.
    //
    // The per-request read works because the module passes `import.meta.env`, which
    // nitro rewrites to `process.env` for the node preset this template deploys on
    // (`CMD ["node", ".output/server/index.mjs"]`). On an edge/worker preset that
    // object is empty, and the runtime override would silently stop working —
    // relevant only if this template is ever retargeted.
  },

  // ============================================================================
  // SEO: Sitemap
  // ============================================================================
  sitemap: {
    exclude: ['/app/**', '/auth/**'],
  },

  // ============================================================================
  // Rendering Configuration
  // ============================================================================
  spaLoadingTemplate: false,

  ssr: true,

  // ============================================================================
  // Telemetry
  // ============================================================================
  telemetry: false,

  // ============================================================================
  // Vite Configuration
  // ============================================================================
  vite: {
    build: {
      cssMinify: 'esbuild',
    },
    optimizeDeps: {
      exclude: ['@tailwindcss/vite', 'lightningcss', '@vue/devtools-core', '@vue/devtools-kit', '@internationalized/date'],
    },
    plugins: [tailwindcss() as any],
    server: {
      proxy: {
        // API proxy for local development (NUXT_PUBLIC_API_PROXY=true)
        //
        // How it works:
        // 1. Client-side requests go to /api/... (e.g., /api/iam/sign-in, /api/i18n/errors/de)
        // 2. This proxy strips the /api prefix and forwards to the backend
        // 3. Backend receives the original path (e.g., /iam/sign-in, /i18n/errors/de)
        //
        // Why: Frontend (localhost:3001) and backend (localhost:3000) run on different
        // ports. The proxy makes requests same-origin so cookies work correctly.
        '/api': {
          target: process.env.NUXT_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // Direct IAM proxy for BetterAuth endpoints (SSR Nitro server handler
        // and direct browser redirects, e.g., OAuth callbacks)
        '/iam': {
          target: process.env.NUXT_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  },
});
