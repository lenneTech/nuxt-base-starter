import { de } from '@formkit/i18n';
import { genesisIcons } from '@formkit/icons';
import { generateClasses } from '@formkit/themes';
import formkitTheme from './formkit-theme.js'
import { addAsteriskPlugin } from '~/forms/plugins/asterisk-plugin';
import { scrollToErrors } from '~/forms/plugins/scroll-error-plugin';
import { createInput } from '@formkit/vue';
import { valueChangesPlugin } from "~/forms/plugins/value-changes-plugin";

import InputImage from "~/forms/inputs/InputImage.vue";
import InputTags from "~/forms/inputs/InputTags.vue";
import InputFreeTags from "~/forms/inputs/InputFreeTags.vue";
import InputCheckbox from "~/forms/inputs/InputCheckbox.vue";
import InputToggle from "~/forms/inputs/InputToggle.vue";

export default {
  locales: { de },
  locale: 'de',
  plugins: [addAsteriskPlugin, scrollToErrors, valueChangesPlugin],
  inputs: {
    image: createInput(InputImage),
    tags: createInput(InputTags),
    freeTags: createInput(InputFreeTags),
    checkbox: createInput(InputCheckbox),
    toggle: createInput(InputToggle),
  },
  icons: {
    ...genesisIcons,
  },
  config: {
    classes: generateClasses(formkitTheme),
  },
};
