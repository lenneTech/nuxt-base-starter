// https://nuxt.com/docs/api/configuration/nuxt-config
const defineNuxtConfig = () => ({
  srcDir: "./src",
  modules: ["@nuxtjs/tailwindcss", "@pinia/nuxt"],
  "lenne-module": {
    secret: true,
    prefix: "Lenne",
  },
  imports: {
    dirs: ["./states", "./stores"],
  },
});
export default defineNuxtConfig();
