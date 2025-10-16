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
  bug: {
    enabled: process.env.APP_ENV !== 'production',
    linearApiKey: process.env.LINEAR_API_KEY,
    linearProjectName: process.env.LINEAR_PROJECT_NAME,
    linearTeamName: process.env.LINEAR_TEAM_NAME,
  },

  // ============================================================================
  // Color Mode (Dark/Light Theme)
  // ============================================================================
  colorMode: {
    classSuffix: '', // Required for Tailwind CSS v4 compatibility
    storage: 'localStorage', // or 'sessionStorage' or 'cookie'
    storageKey: 'nuxt-color-mode',
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
  extends: process.env.APP_ENV === 'development' ? ['./dev'] : [],

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
  // Auto-imports
  // ============================================================================
  imports: {
    dirs: ['./states', './stores', './forms', './interfaces', './base', './plugins'],
  },

  // ============================================================================
  // Nuxt Modules
  // ============================================================================
  modules: [
    '@nuxt/test-utils/module', // E2E testing with Playwright
    '@lenne.tech/nuxt-base', // Base functionality & API integration
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
  // @lenne.tech/nuxt-base Configuration
  // ============================================================================
  nuxtBase: {
    disableGraphql: true,
    generateTypes: process.env['GENERATE_TYPES'] === '1',
    gqlHost: process.env.API_URL + '/graphql',
    host: process.env.API_URL,
    schema: process.env.API_SCHEMA,
    storagePrefix: process.env.STORAGE_PREFIX,
  },

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
    apiHost: process.env.PLAUSIBLE_API_URL,
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
    public: {
      apiUrl: process.env.API_URL || 'http://localhost:3000',
      host: process.env.API_URL,
      webPushKey: process.env.WEB_PUSH_KEY,
    },
  },

  // ============================================================================
  // SEO: Site Metadata
  // ============================================================================
  site: {
    name: 'Nuxt Base Starter',
    url: process.env.SITE_URL,
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
  },
});
