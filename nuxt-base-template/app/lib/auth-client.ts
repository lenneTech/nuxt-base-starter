import { passkeyClient } from '@better-auth/passkey/client';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        navigateTo('/auth/2fa');
      },
    }),
    passkeyClient(),
  ],
});

export type AuthClient = typeof authClient;
