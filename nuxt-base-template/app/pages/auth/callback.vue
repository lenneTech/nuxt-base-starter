<script setup lang="ts">
// ============================================================================
// Sign-in through a social provider: the last step
// ============================================================================
// The API's OAuth callback sends the browser here (`callbackURL` in `login.vue`) after the
// provider signed the user in. The session is in the API's httpOnly cookie by then;
// `validateSession()` loads the user into the auth state. No global middleware stops a visitor
// without `lt-auth-state` here: `auth.global` and `admin.global` guard `/app` only, `guest.global`
// `/auth/login` only.
//
// A session is not yet a completed sign-in. The route guard and every reload read the user from the
// `lt-auth-state` cookie in `document.cookie`. When the browser refused to store it (over its 4096
// bytes, for example a large user object), `useLtAuth()` still reports the user from the ref
// `useCookie` keeps in memory, the guard sends the visitor to `/auth/login?redirect=…` without
// `error`, and the login page starts the next silent attempt: app, API and provider loop, a session
// row per round. So the page goes on only when `isLtAuthenticated()`, the library's read of
// `document.cookie` without that in-memory fallback, finds the user.

// ============================================================================
// Composables
// ============================================================================
const { validateSession } = useLtAuth();
const route = useRoute();

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

useHead({
  title: 'Anmeldung',
});

// ============================================================================
// Lifecycle
// ============================================================================
onMounted(async () => {
  // `safeRedirectTarget` and never the raw value: the query is anybody's to write.
  const target = safeRedirectTarget(route.query.redirect);

  let signedIn = false;
  try {
    signedIn = await validateSession();
  } catch {
    signedIn = false;
  }

  // Complete only when the auth state is where the guard and a reload look for it (see above).
  if (signedIn && isLtAuthenticated()) {
    // A sign-in through the provider worked, so the next visit without a session may try the
    // silent attempt again (app/utils/social-sign-in.ts).
    socialSignInMarks.clear();
    await navigateTo(target, { replace: true });
    return;
  }

  // The provider was done, but no session arrived (a session cookie the browser refused, an expired
  // state), or the app could not store the auth state. The marks stay, and the login page, reached
  // with `error`, never starts a silent attempt: it shows the code instead of looping. The deep link
  // survives the detour.
  await navigateTo({ path: '/auth/login', query: { error: SOCIAL_SIGN_IN_NO_SESSION, redirect: target } }, { replace: true });
});
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <p class="text-center text-muted" role="status">Anmeldung wird abgeschlossen …</p>
  </UPageCard>
</template>
