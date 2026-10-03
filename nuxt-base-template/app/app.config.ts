export default defineAppConfig({
  // ============================================================================
  // Toast Notifications
  // ============================================================================
  toaster: {
    duration: 5000,
    expand: false,
    // What a screen reader says before every toast it announces. Reka UI owns
    // that word, outside Nuxt UI's locale, and says "Notification" otherwise.
    // The toast REGION keeps its English name "Notifications (F8)": that is
    // ToastViewport's label, which Nuxt UI (4.11.3) does not pass through.
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
