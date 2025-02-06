/** @type {import('tailwindcss').Config} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { iconsPlugin, getIconCollections } = require('@egoist/tailwindcss-icons');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('tailwindcss/plugin');

module.exports = {
  plugins: [
    iconsPlugin({
      // Select the icon collections you want to use
      collections: getIconCollections(['bi']),
    }),
    plugin(({ addVariant, e }) => {
      addVariant('pwa', ({ modifySelectors, separator }) => {
        modifySelectors(({ className }) => {
          return `.pwa .${e(`pwa${separator}${className}`)}`;
        });
      });
    }),
  ],
};
