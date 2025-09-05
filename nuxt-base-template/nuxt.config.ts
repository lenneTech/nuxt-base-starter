// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  app: {
    head: {
      title: 'Nuxt Base Starter',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    },
  },

  bug: {
    enabled: process.env.APP_ENV !== 'production',

    // Linear Integration
    linearApiKey: process.env.LINEAR_API_KEY,
    linearProjectName: process.env.LINEAR_PROJECT_NAME,
    linearTeamName: process.env.LINEAR_TEAM_NAME,
  },

  colorMode: {
    classSuffix: '',
  },

  compatibilityDate: '2024-09-05',

  css: ['~/assets/css/tailwind.css'],

  devServer: {
    port: 3001,
  },

  experimental: {
    asyncContext: true,
    renderJsonPayloads: false,
    typedPages: true,
  },

  image: {
    ipx: {
      maxAge: 2592000,
    },
    provider: 'ipx',
  },

  imports: {
    dirs: ['./states', './stores', './forms', './interfaces', './base', './plugins'],
  },

  modules: [
    '@nuxt/test-utils/module',
    '@lenne.tech/nuxt-base',
    '@lenne.tech/bug.lt',
    '@vueuse/nuxt',
    '@nuxtjs/google-fonts',
    '@nuxtjs/color-mode',
    'dayjs-nuxt',
    '@nuxt/image',
    '@nuxtjs/plausible',
    '@nuxtjs/seo',
  ],

  nuxtBase: {
    disableGraphql: false,
    generateTypes: process.env['GENERATE_TYPES'] === '1',
    gqlHost: process.env.API_URL + '/graphql',
    host: process.env.API_URL,
    schema: process.env.API_SCHEMA,
    storagePrefix: process.env.STORAGE_PREFIX,
  },

  // sets the default renderer to chromium
  ogImage: {
    defaults: {
      renderer: 'chromium',
    },
  },

  plausible: {
    apiHost: process.env.PLAUSIBLE_API_URL,
    ignoredHostnames: ['localhost'],
  },

  robots: {
    disallow: ['/app', '/auth', '/admin'],
  },

  runtimeConfig: {
    public: {
      gqlHost: process.env.API_URL + '/graphql',
      host: process.env.API_URL,
      webPushKey: process.env.WEB_PUSH_KEY,
    },
  },

  site: {
    name: 'Nuxt Base Starter',
    url: process.env.SITE_URL,
  },

  sitemap: {
    exclude: ['/app/**', '/auth/**'],
  },

  spaLoadingTemplate: false,

  ssr: true,

  telemetry: false,

  vite: {
    build: {
      cssMinify: 'lightningcss',
    },
    plugins: [tailwindcss()],
  },
});
