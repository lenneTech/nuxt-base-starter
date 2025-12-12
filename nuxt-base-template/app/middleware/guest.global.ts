export default defineNuxtRouteMiddleware(async (to) => {
  // Only check /auth/login route
  if (to.path !== '/auth/login') {
    return;
  }

  const { isAuthenticated, isLoading } = useBetterAuth();

  // Wait for session to load
  if (isLoading.value) {
    return;
  }

  // Redirect to /app if already authenticated
  if (isAuthenticated.value) {
    return navigateTo('/app');
  }
});
