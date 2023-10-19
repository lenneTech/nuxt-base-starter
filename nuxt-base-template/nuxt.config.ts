// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: true,
  spaLoadingTemplate: false,
  srcDir: './src',
  modules: [
    '@nuxtjs/tailwindcss',
    '@lenne.tech/nuxt-base',
    '@vueuse/nuxt',
    '@formkit/nuxt',
    '@kevinmarrec/nuxt-pwa',
    '@nuxtjs/google-fonts',
    '@nuxtjs/color-mode',
  ],
  experimental: {
    typedPages: true,
    renderJsonPayloads: false,
  },
  nuxtBase: {
    host: 'http://localhost:3000/graphql',
    schema: '../api/schema.gql',
    storagePrefix: 'rk',
    generateTypes: process.env['GENERATE_TYPES'] === '1',
    apollo: {
      authType: 'Bearer',
      authHeader: 'Authorization',
      tokenStorage: 'cookie',
      proxyCookies: true,
    },
  },
  app: {
    head: {
      title: 'Nuxt Base Starter',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
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
