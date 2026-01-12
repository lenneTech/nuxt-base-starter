export default defineNuxtRouteMiddleware(async (to) => {
  // Only check routes starting with /app/admin
  if (!to.path.startsWith('/app/admin')) {
    return;
  }

  const { isAdmin, isAuthenticated, isLoading } = useBetterAuth();

  // Wait for session to load
  if (isLoading.value) {
    return;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated.value) {
    return navigateTo('/auth/login');
  }

  // Redirect to /app if authenticated but not admin
  if (!isAdmin.value) {
    return navigateTo('/app');
  }
});
