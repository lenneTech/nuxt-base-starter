/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');
const { iconsPlugin, getIconCollections } = require('@egoist/tailwindcss-icons');
const typography = require('@tailwindcss/typography');
const forms = require('@tailwindcss/forms');
const formkit = require('@formkit/themes/tailwindcss');

module.exports = {
  darkMode: "class",
  content: ['./formkit-theme.js'],
  theme: {
    // fontFamily: {
    //   montserrat: ['Montserrat'],
    //   sans: ['Work Sans', 'Montserrat', ...defaultTheme.fontFamily.sans],
    //   serif: ['Work Sans', 'Montserrat', ...defaultTheme.fontFamily.serif],
    // },
    extend: {
      // colors: {
      //   primary: {
      //     DEFAULT: '#57B39A',
      //     50: '#f3faf7',
      //     100: '#d6f1e7',
      //     200: '#ade2d0',
      //     300: '#7cccb3',
      //     400: '#57b39a',
      //     500: '#37957d',
      //     600: '#2a7765',
      //     700: '#256052',
      //     800: '#224d45',
      //     900: '#20413a',
      //     950: '#0d2621',
      //   },
      // }
      screens: {
        '3xl': '2400px'
      }
    }
  },
  plugins: [
    typography,
    formkit,
    forms,
    iconsPlugin({
      // Select the icon collections you want to use
      collections: getIconCollections(['bi']),
    }),
  ],
};
