// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: './src',
  modules: [
    '@nuxtjs/tailwindcss',
    '@lenne.tech/nuxt-base',
    '@vueuse/nuxt',
    '@formkit/nuxt',
  ],
  nuxtBase: {
    host: 'http://localhost:3000/graphql',
    schema: '../api/schema.gql',
    watch: false,
    autoImport: true,
    apollo: {
      authType: 'Bearer',
      authHeader: 'Authorization',
      tokenStorage: 'cookie',
      proxyCookies: true,
    },
  },
  imports: {
    dirs: ['./states', './stores', './forms'],
  },
});
