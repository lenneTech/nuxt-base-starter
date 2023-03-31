// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: './src',
  modules: ['@nuxtjs/tailwindcss', '@lenne.tech/nuxt-base'],
  nuxtBase: {
    host: 'http://localhost:3100/api'
  },
  imports: {
    dirs: ['./states', './stores'],
  },
})
