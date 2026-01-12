import { authClient } from '~/lib/auth-client';

export function useBetterAuth() {
  const session = authClient.useSession();

  const user = computed<null | User>(() => (session.value.data?.user as User) ?? null);
  const isAuthenticated = computed<boolean>(() => !!user.value);
  const isAdmin = computed<boolean>(() => user.value?.role === 'admin');
  const is2FAEnabled = computed<boolean>(() => user.value?.twoFactorEnabled ?? false);
  const isLoading = computed<boolean>(() => session.value.isPending);

  return {
    is2FAEnabled,
    isAdmin,
    isAuthenticated,
    isLoading,
    passkey: authClient.passkey,
    session,
    signIn: authClient.signIn,
    signOut: authClient.signOut,
    signUp: authClient.signUp,
    twoFactor: authClient.twoFactor,
    user,
  };
}
