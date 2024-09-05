// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: true,

  spaLoadingTemplate: false,

  srcDir: './src',

  modules: [
    '@nuxtjs/tailwindcss',
    '@lenne.tech/nuxt-base',
    '@vueuse/nuxt',
    '@nuxtjs/google-fonts',
    '@nuxtjs/color-mode',
    '@nuxt/image',
    'nuxt-simple-robots',
    '@nuxtjs/sitemap',
    '@nuxtjs/plausible',
  ],

  plausible: {
    apiHost: '',
  },

  compatibilityDate: '2024-09-05',

  experimental: {
    asyncContext: true,
    renderJsonPayloads: false,
    typedPages: true,
  },

  sitemap: {
    exclude: ['/app/**'],
  },

  image: {
    ipx: {
      maxAge: 2592000,
    },
    provider: 'ipx',
  },

  nuxtBase: {
    generateTypes: process.env['GENERATE_TYPES'] === '1',
    host: process.env.API_URL + '/graphql',
    schema: process.env.API_SCHEMA,
    storagePrefix: process.env.STORAGE_PREFIX,
  },

  app: {
    head: {
      title: 'Nuxt Base Starter',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    },
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.API_URL,
      webPushKey: process.env.WEB_PUSH_KEY,
    },
  },

  devServer: {
    port: 3001,
  },

  colorMode: {
    classSuffix: '',
  },

  // googleFonts: {
  //   families: {
  //     Montserrat: [400, 600, 800, 900],
  //     'Work Sans': [400, 600, 800, 900],
  //   },
  //   download: true,
  //   base64: true,
  //   stylePath: '~/assets/css/fonts.css',
  // },

  imports: {
    dirs: ['./states', './stores', './forms', './interfaces', './base', './plugins'],
  },

  telemetry: false,
});
