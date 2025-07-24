export default defineNuxtRouteMiddleware((to) => {
  const { accessTokenState } = useAuthState();

  if (to.fullPath.startsWith('/app')) {
    if (!accessTokenState?.value) {
      return navigateTo('/auth/login');
    }
  }
});
