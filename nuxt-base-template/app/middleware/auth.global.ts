export default defineNuxtRouteMiddleware(async (to) => {
  // Only check routes starting with /app (but not /app/admin, handled by admin middleware)
  if (!to.path.startsWith('/app') || to.path.startsWith('/app/admin')) {
    return;
  }

  const { isAuthenticated, isLoading } = useBetterAuth();

  // Wait for session to load
  if (isLoading.value) {
    return;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/auth/login');
  }
});
