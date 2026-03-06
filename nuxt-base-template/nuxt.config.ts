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
  // @ts-expect-error bug.lt module config - module temporarily disabled
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
  extends: process.env.NUXT_PUBLIC_APP_ENV === 'development' ? ['./docs'] : [],

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
    // Ensure dynamically rendered icons (e.g., inside v-for) are included in the bundle
    clientBundle: {
      icons: ['lucide:trash', 'lucide:key', 'lucide:copy', 'lucide:loader-circle'],
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
      // baseURL is used in production mode for cross-origin API requests
      // In dev mode, Nuxt proxy is used (baseURL is ignored, requests go through /api/iam)
      // In production, requests go directly to baseURL + basePath (e.g., https://api.example.com/iam)
      baseURL: process.env.NUXT_API_URL || 'http://localhost:3000',
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
    // '@lenne.tech/bug.lt', // Bug reporting to Linear - TEMPORARILY DISABLED FOR TESTING
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
    // Server-only — NUXT_API_URL overrides this
    apiUrl: 'http://localhost:3000',
    public: {
      // Client-side — NUXT_PUBLIC_API_URL overrides this
      apiUrl: 'http://localhost:3000',
      // NUXT_PUBLIC_WEB_PUSH_KEY overrides this
      webPushKey: '',
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
    plugins: [tailwindcss()],
    server: {
      proxy: {
        // IAM proxy via /api prefix (nuxt-extensions adds /api in dev mode)
        // Must be before /api to match more specifically
        '/api/iam': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // API proxy - no rewrite, backend expects /api/... paths
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        // IAM proxy for direct BetterAuth endpoints (SSR mode)
        '/iam': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  },
});
