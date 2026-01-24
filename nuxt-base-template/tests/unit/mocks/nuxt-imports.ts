/**
 * Mock for #imports (Nuxt auto-imports)
 *
 * This mock provides the essential Nuxt composables and functions
 * needed for unit testing without a full Nuxt environment.
 */

import { ref, computed, reactive, watch, watchEffect, onMounted, onUnmounted } from 'vue';
import { vi } from 'vitest';

// Vue reactivity exports
export { ref, computed, reactive, watch, watchEffect, onMounted, onUnmounted };

// Mock useNuxtApp
export const useNuxtApp = vi.fn(() => ({
  $config: {
    public: {
      ltExtensions: {
        auth: {
          enabled: true,
          baseURL: 'http://localhost:3000',
          basePath: '/iam',
          loginPath: '/auth/login',
          twoFactorRedirectPath: '/auth/2fa',
          enableAdmin: true,
          enableTwoFactor: true,
          enablePasskey: true,
        },
      },
    },
  },
}));

// Mock useRuntimeConfig
export const useRuntimeConfig = vi.fn(() => ({
  public: {
    apiUrl: 'http://localhost:3000',
    ltExtensions: {
      auth: {
        enabled: true,
        baseURL: 'http://localhost:3000',
        basePath: '/iam',
      },
    },
  },
}));

// Mock navigateTo
export const navigateTo = vi.fn((path: string) => Promise.resolve());

// Mock useCookie
export const useCookie = vi.fn((name: string, options?: any) => {
  const value = ref<any>(null);
  return value;
});

// Mock useRouter
export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  go: vi.fn(),
  currentRoute: ref({ path: '/', query: {}, params: {} }),
}));

// Mock useRoute
export const useRoute = vi.fn(() => ({
  path: '/',
  query: {},
  params: {},
  fullPath: '/',
  hash: '',
  matched: [],
  meta: {},
  name: undefined,
  redirectedFrom: undefined,
}));

// Mock useToast
export const useToast = vi.fn(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
}));

// Mock useOverlay
export const useOverlay = vi.fn(() => ({
  create: vi.fn(() => ({
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
  })),
}));

// Re-export for convenience
export default {
  useNuxtApp,
  useRuntimeConfig,
  navigateTo,
  useCookie,
  useRouter,
  useRoute,
  useToast,
  useOverlay,
};
