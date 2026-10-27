export default defineAppConfig({
  // ============================================================================
  // Toast Notifications
  // ============================================================================
  toaster: {
    duration: 5000,
    expand: false,
    // What a screen reader says before every toast it announces. Since @nuxt/ui
    // 4.12 the `de` locale supplies the same word (`toaster.label`) and also names
    // the toast REGION "Benachrichtigungen (F8)" (`toaster.viewport`); up to 4.11
    // Reka's English "Notification" / "Notifications (F8)" came through instead.
    // Kept explicit so the announcement stays German if the UApp locale changes.
    label: 'Benachrichtigung',
    position: 'bottom-right' as const,
  },

  // ============================================================================
  // NuxtUI Configuration
  // ============================================================================
  ui: {
    // Base component modifications
    button: {
      slots: {
        base: 'cursor-pointer',
      },
    },
    checkbox: {
      slots: {
        base: 'cursor-pointer',
      },
    },

    // Semantic color palette (must match tailwind.css)
    colors: {
      error: 'error',
      info: 'info',
      neutral: 'neutral',
      primary: 'primary',
      secondary: 'secondary',
      success: 'success',
      warning: 'warning',
    },

    // Form field styling. Was neutral-400 on white — 2.56:1, far below the
    // 4.5:1 of WCAG AA, under every field description.
    formField: {
      slots: {
        description: 'text-sm text-neutral-600 dark:text-neutral-400',
      },
    },

    // Placeholders. Nuxt UI draws them text-dimmed: neutral-400 on white, 2.56:1,
    // and neutral-500 on neutral-900, 3.75:1, both below WCAG AA. text-muted passes
    // in both modes. Lighthouse only ever caught the USelectMenu one, a real <span>;
    // axe skips `::placeholder`, so the inputs never showed up in an audit. All ten
    // components that draw a placeholder are listed, so one a project adds later is
    // covered too. tests/unit/placeholder-contrast-contract.test.ts pins list and ratio.
    input: { slots: { base: 'placeholder:text-muted' } },
    inputDate: { slots: { segment: 'data-placeholder:text-muted' } },
    inputMenu: {
      slots: { tagsInput: 'placeholder:text-muted' },
      variants: { multiple: { false: { base: 'placeholder:text-muted' } } },
    },
    inputNumber: { slots: { base: 'placeholder:text-muted' } },
    inputTags: { slots: { input: 'placeholder:text-muted' } },
    inputTime: { slots: { segment: 'data-placeholder:text-muted' } },
    pinInput: { slots: { base: 'placeholder:text-muted' } },
    select: { slots: { placeholder: 'text-muted' } },
    selectMenu: { slots: { placeholder: 'text-muted' } },
    textarea: { slots: { base: 'placeholder:text-muted' } },

    // Dark/Light mode icons
    icons: {
      dark: 'i-lucide-moon',
      light: 'i-lucide-sun-medium',
    },

    // Nuxt UI draws an inactive tab text-muted on bg-elevated: 4.34:1, below
    // WCAG AA. One step darker passes in both modes.
    tabs: {
      slots: {
        trigger: 'data-[state=inactive]:text-toned',
      },
    },

    // Modal defaults
    modal: {
      slots: {
        content: 'w-full max-w-2xl',
        footer: 'flex justify-end gap-3 px-4 py-3',
      },
    },

    // Toast notifications
    toast: {
      root: 'pointer-events-auto',
      slots: {
        close: 'text-neutral-900 dark:text-white',
      },
    },
  },
});
