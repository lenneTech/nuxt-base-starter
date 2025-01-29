// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: 'Nuxt Base Starter',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    },
  },

  colorMode: {
    classSuffix: '',
  },

  compatibilityDate: '2024-09-05',

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
    '@nuxtjs/tailwindcss',
    '@lenne.tech/nuxt-base',
    '@vueuse/nuxt',
    '@nuxtjs/google-fonts',
    '@nuxtjs/color-mode',
    '@nuxt/image',
    '@nuxtjs/robots',
    '@nuxtjs/sitemap',
    '@nuxtjs/plausible',
  ],

  nuxtBase: {
    generateTypes: process.env['GENERATE_TYPES'] === '1',
    gqlHost: process.env.API_URL + '/graphql',
    host: process.env.API_URL,
    schema: process.env.API_SCHEMA,
    storagePrefix: process.env.STORAGE_PREFIX,
  },

  plausible: {
    apiHost: '',
  },

  runtimeConfig: {
    public: {
      gqlHost: process.env.API_URL + '/graphql',
      host: process.env.API_URL,
      webPushKey: process.env.WEB_PUSH_KEY,
    },
  },

  sitemap: {
    exclude: ['/app/**'],
  },

  spaLoadingTemplate: false,

  srcDir: './src',

  // googleFonts: {
  //   families: {
  //     Montserrat: [400, 600, 800, 900],
  //     'Work Sans': [400, 600, 800, 900],
  //   },
  //   download: true,
  //   base64: true,
  //   stylePath: '~/assets/css/fonts.css',
  // },

  ssr: true,

  telemetry: false,
});
