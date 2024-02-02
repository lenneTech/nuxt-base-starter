<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    addHomeButtonLabel?: string;
    body?: string;
    buttonLabel?: string;
    closePrompt?: string;
    debug?: boolean;
    delay?: number;
    iosBackgroundColor?: string;
    iosBackgroundColorDark?: string;
    iosBorderColor?: string;
    iosBorderColorDark?: string;
    iosButtonColoDark?: string;
    iosButtonColor?: string;
    iosOverlayColor?: string;
    iosOverlayColorDark?: string;
    iosTextColor?: string;
    iosTextColorDark?: string;
    iosTitleColor?: string;
    iosTitleColorDark?: string;
    title?: string;
  }>(),
  {
    addHomeButtonLabel: '2) Drücken Sie auf "Zum Home-Bildschirm".',
    body: 'Diese Website verfügt über eine App-Funktionalität. Fügen Sie sie zu Ihrem Startbildschirm hinzu, um sie im Vollbildmodus und offline zu nutzen.',
    buttonLabel: '1) Drücken Sie die Schaltfläche "Teilen".',
    closePrompt: 'Abbrechen',
    debug: false,

    delay: 1000,
    iosBackgroundColor: 'rgba(255, 255, 255, 0.9)',

    iosBackgroundColorDark: 'rgba(65, 65, 65, 0.7)',
    iosBorderColor: 'rgba(60, 60, 67, 0.29)',

    iosBorderColorDark: 'rgba(140, 140, 140, 0.7)',
    iosButtonColoDark: 'rgba(9, 132, 255, 1)',

    iosButtonColor: 'rgba(0, 85, 179, 1)',
    iosOverlayColor: 'rgba(10, 10, 10, 0.5)',

    iosOverlayColorDark: 'rgba(10, 10, 10, 0.5)',
    iosTextColor: 'rgba(60, 60, 67, 0.6)',

    iosTextColorDark: 'rgba(235, 235, 245, 0.6)',
    iosTitleColor: 'rgba(0, 0, 0, 1)',

    iosTitleColorDark: 'rgba(255, 255, 255, 1)',
    title: 'Zum Startbildschirm hinzufügen',
  }
);

const cssVariables = [
  `--ios-overlay: ${props.iosOverlayColor}`,
  `--ios-overlay-dark: ${props.iosOverlayColorDark}`,
  `--ios-background: ${props.iosBackgroundColor}`,
  `--ios-background-dark: ${props.iosBackgroundColorDark}`,
  `--ios-button: ${props.iosButtonColor}`,
  `--ios-button-dark: ${props.iosButtonColor}`,
  `--ios-border: ${props.iosBorderColor}`,
  `--ios-border-dark: ${props.iosBorderColorDark}`,
  `--ios-title: ${props.iosTitleColor}`,
  `--ios-title-dark: ${props.iosTitleColorDark}`,
  `--ios-text: ${props.iosTextColor}`,
  `--ios-text-dark: ${props.iosTextColorDark}`,
].join(';');

const HomeIcon = defineComponent({
  render: () =>
    h('svg', { fill: 'currentColor', viewBox: '0 0 578 584' }, [
      h('path', {
        'clip-rule': 'evenodd',
        d: 'M101 35l19-1h333c12 0 23 0 35 3 17 3 34 12 44 27 13 16 16 38 16 58v329c0 19 0 39-8 57a65 65 0 0 1-37 37c-18 7-38 7-57 7H130c-21 1-44 0-63-10-14-7-25-20-30-34-6-15-8-30-8-45V121c1-21 5-44 19-61 13-16 33-23 53-25m7 46c-10 1-19 6-24 14-7 8-9 20-9 31v334c0 12 2 25 10 34 9 10 23 12 35 12h336c14 1 30-3 38-15 6-9 8-20 8-31V125c0-12-2-24-10-33-9-9-22-12-35-12H121l-13 1z',
        'fill-rule': 'evenodd',
      }),
      h('path', {
        'clip-rule': 'evenodd',
        d: 'M271 161c9-11 31-10 38 4 3 5 3 11 3 17v87h88c7 0 16 1 21 7 6 6 7 14 6 22a21 21 0 0 1-10 14c-5 4-11 5-17 5h-88v82c0 7-1 15-6 20-10 10-29 10-37-2-3-6-4-13-4-19v-81h-87c-8-1-17-3-23-9-5-6-6-15-4-22a21 21 0 0 1 11-14c6-3 13-3 19-3h84v-88c0-7 1-14 6-20z',
        'fill-rule': 'evenodd',
      }),
    ]),
});

const ShareIcon = defineComponent({
  render: () =>
    h('svg', { fill: 'currentColor', viewBox: '0 0 566 670' }, [
      h('path', {
        'clip-rule': 'evenodd',
        d: 'M255 12c4-4 10-8 16-8s12 3 16 8l94 89c3 4 6 7 8 12 2 6 0 14-5 19-7 8-20 9-28 2l-7-7-57-60 2 54v276c0 12-10 22-22 22-12 1-24-10-23-22V110l1-43-60 65c-5 5-13 8-21 6a19 19 0 0 1-16-17c-1-7 2-13 7-18l95-91z',
        'fill-rule': 'evenodd',
      }),
      h('path', {
        'clip-rule': 'evenodd',
        d: 'M43 207c16-17 40-23 63-23h83v46h-79c-12 0-25 3-33 13-8 9-10 21-10 33v260c0 13 0 27 6 38 5 12 18 18 30 19l14 1h302c14 0 28 0 40-8 11-7 16-21 16-34V276c0-11-2-24-9-33-8-10-22-13-34-13h-78v-46h75c13 0 25 1 37 4 16 4 31 13 41 27 11 17 14 37 14 57v280c0 20-3 41-15 58a71 71 0 0 1-45 27c-11 2-23 3-34 3H109c-19-1-40-4-56-15-14-9-23-23-27-38-4-12-5-25-5-38V270c1-22 6-47 22-63z',
        'fill-rule': 'evenodd',
      }),
    ]),
});

const showBanner = ref(false);

watch(
  () => showBanner.value,
  () => {
    if (showBanner.value) {
      // Disable scrolling of background
      document.body.style.overflowY = 'hidden';
    } else {
      // Deactivate scrolling of background
      document.body.style.overflowY = '';
    }
  }
);

interface BeforeInstallPromptEvent {
  prompt: () => void;
}
const { storagePrefix } = useRuntimeConfig().public;
const deferredPrompt = ref<BeforeInstallPromptEvent | null>();

const cancelCookie = () => useCookie(`${storagePrefix}_pwa_prompt_canceled`, { default: () => false });

function cancel() {
  cancelCookie().value = true;
  showBanner.value = false;
}

function deviceCheck() {
  const isiOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isiPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints >= 2;
  const isStandalone = 'standalone' in window.navigator && window.navigator.standalone;

  return (isiOS || isiPadOS) && !isStandalone;
}

function reactivate() {
  cancelCookie().value = false;
  showBanner.value = true;
}

function showInAppInstallPromotion() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt();
  }
}

onMounted(() => {
  if (!cancelCookie().value) {
    showBanner.value = deviceCheck();
  }

  // This variable will save the event for later use.
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevents the default mini-infobar or install dialog from appearing on mobile
    e.preventDefault();
    // Save the event because you'll need to trigger it later.
    deferredPrompt = e;
    // Show your customized install prompt for your PWA
    // Your own UI doesn't have to be a single element, you
    // can have buttons in different locations, or wait to prompt
    // as part of a critical journey.
    showInAppInstallPromotion();
  });
});

defineExpose({
  reactivate,
});
</script>

<template>
  <Transition
    enter-active-class="ease-out duration-500 delay-500"
    enter-from-class="translate-y-full"
    enter-to-class="translate-x-0"
    leave-active-class="ease-in duration-500"
    leave-from-class="translate-x-0"
    leave-to-class="translate-y-full"
  >
    <div v-show="showBanner" :style="cssVariables" class="bottom-0 w-full fixed !z-[9998] p-2 max-w-md mx-auto">
      <div class="bg-[var(--ios-background)] backdrop-blur-sm overflow-hidden dark:bg-[var(--ios-background-dark)] rounded-lg">
        <div class="flex justify-between border-b border-[var(--ios-border)] dark:border-[var(--ios-border-dark)]">
          <h4 class="text-[var(--ios-title)] dark:text-[var(--ios-title-dark)] text-md p-4">
            {{ props.title }}
          </h4>
          <button class="text-[var(--ios-button)] dark:text-[var(--ios-button-dark)] text-base p-4" @click="cancel()">
            {{ props.closePrompt }}
          </button>
        </div>
        <div class="px-8 py-4">
          <p class="text-[var(--ios-text)] dark:text-[var(--ios-text-dark)] text-center text-sm border-b px-4 pb-4 border-[var(--ios-border)] dark:border-[var(--ios-border-dark)]">
            {{ props.body }}
          </p>
          <div class="flex flex-col gap-4 p-4 pt-8">
            <div class="flex justify-start items-center gap-6">
              <ShareIcon class="h-8 w-auto text-[var(--ios-button)] dark:text-[var(--ios-button-dark)]" />
              <p class="text-sm text-left text-[var(--ios-text)] dark:text-[var(--ios-text-dark)]">
                {{ props.buttonLabel }}
              </p>
            </div>
            <div class="flex justify-start items-center gap-6">
              <HomeIcon class="h-8 w-auto text-[var(--ios-button)] dark:text-[var(--ios-button-dark)]" />
              <p class="text-sm text-left text-[var(--ios-text)] dark:text-[var(--ios-text-dark)]">
                {{ props.addHomeButtonLabel }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  <Transition
    enter-active-class="ease-out duration-1000"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="ease-in duration-1000"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-show="showBanner" :style="cssVariables" class="absolute inset-0 bg-black/50 !z-[9997] min-h-screen w-full"></div>
  </Transition>
</template>
