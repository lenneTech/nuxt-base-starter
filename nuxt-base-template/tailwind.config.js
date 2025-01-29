/** @type {import('tailwindcss').Config} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const defaultTheme = require('tailwindcss/defaultTheme');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getIconCollections, iconsPlugin } = require('@egoist/tailwindcss-icons');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const typography = require('@tailwindcss/typography');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const forms = require('@tailwindcss/forms');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('tailwindcss/plugin');

module.exports = {
  darkMode: 'class',
  plugins: [
    typography,
    forms,
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
  theme: {
    // fontFamily: {
    //   montserrat: ['Montserrat'],
    //   sans: ['Work Sans', 'Montserrat', ...defaultTheme.fontFamily.sans],
    //   serif: ['Work Sans', 'Montserrat', ...defaultTheme.fontFamily.serif],
    // },
    extend: {
      colors: {
        active: 'hsl(0 0% 100% / 0.2)',
        background: '#FFFFFF',
        border: 'hsl(0 0% 0% / 0.5)',
        foreground: '#000000',
        hover: 'hsl(0 0% 100% / 0.2)',
        primary: {
          50: '#f3faf7',
          100: '#d6f1e7',
          200: '#ade2d0',
          300: '#7cccb3',
          400: '#57b39a',
          500: '#37957d',
          600: '#2a7765',
          700: '#256052',
          800: '#224d45',
          900: '#20413a',
          950: '#0d2621',
          DEFAULT: '#57B39A',
        },
      },
      screens: {
        '3xl': '2400px',
      },
    },
  },
};
