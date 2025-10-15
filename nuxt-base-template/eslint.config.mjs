import vue from '@lenne.tech/eslint-config-vue';

// Override the problematic rule configuration
export default [
  ...vue,
  {
    rules: {
      'vue/object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: false,
      }],
    },
  },
];
