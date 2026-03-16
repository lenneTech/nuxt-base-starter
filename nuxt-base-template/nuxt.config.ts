// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  // ============================================================================
  // App Configuration
  // ============================================================================
  app: {
    head: {
      title: 'Nuxt Base Starter',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    },
  },

  // ============================================================================
  // Bug Reporting (Linear Integration via @lenne.tech/bug.lt)
  // ============================================================================
  // @ts-ignore bug.lt module has no type declarations
  bug: {
    enabled: process.env.NUXT_PUBLIC_APP_ENV !== 'production',
    linearApiKey: process.env.NUXT_LINEAR_API_KEY,
    linearProjectName: process.env.NUXT_LINEAR_PROJECT_NAME,
    linearTeamName: process.env.NUXT_LINEAR_TEAM_NAME,
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
    port: 3001,
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
  extends: ['local', 'development'].includes(process.env.NUXT_PUBLIC_APP_ENV || '') ? ['./docs'] : [],

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
    'dayjs-nuxt', // Date/time handling
    '@nuxt/image', // Image optimization
    '@nuxt/ui', // NuxtUI component library
    '@nuxtjs/plausible', // Privacy-friendly analytics
    '@nuxtjs/seo', // SEO optimization (sitemap, robots, og-image)
    '@pinia/nuxt', // State management
  ],

  // ============================================================================
  // OG Image Configuration
  // ============================================================================
  ogImage: {
    defaults: {
      renderer: 'chromium',
    },
  },

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
    disallow: ['/app', '/auth', '/admin'],
  },

  // ============================================================================
  // Runtime Configuration (Environment Variables)
  // ============================================================================
  runtimeConfig: {
    // Server-only — NUXT_API_URL overrides at runtime
    // Local dev: .env provides http://localhost:3000
    apiUrl: '',
    public: {
      // Client-side — NUXT_PUBLIC_API_URL overrides at runtime
      // Local dev: .env provides http://localhost:3000
      apiUrl: '',
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
    url: process.env.NUXT_PUBLIC_SITE_URL,
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
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // Direct IAM proxy for BetterAuth endpoints (SSR Nitro server handler
        // and direct browser redirects, e.g., OAuth callbacks)
        '/iam': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  },
});
