import { setLocale } from 'yup';

export default defineNuxtPlugin(async () => {
  setLocale({
    // use constant translation keys for messages without values
    mixed: {
      default: 'Dieses Feld ist ungültig.',
      notType: 'Dieses Feld ist ungültig.',
      required: 'Dieses Feld ist erforderlich.',
    },
    string: {
      email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    },
  });

  // Custom validation rules
  // https://github.com/jquense/yup?tab=readme-ov-file#addmethodschematype-schema-name-string-method--schema-void
  // addMethod(string, 'plz', () => {
  //     return
  // });
});
