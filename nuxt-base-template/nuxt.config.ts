// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: "./src",
  modules: ["@nuxtjs/tailwindcss", "@lenne.tech/nuxt-base"],
  nuxtBase: {
    host: "http://localhost:3100/api",
    watch: false,
    autoImport: true,
    apollo: {
      authType: "Bearer",
      authHeader: "Authorization",
      tokenStorage: "cookie",
      proxyCookies: true,
    },
  },
  imports: {
    dirs: ["./states", "./stores"],
  },
});
