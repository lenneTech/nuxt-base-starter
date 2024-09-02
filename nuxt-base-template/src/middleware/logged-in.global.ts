export default defineNuxtRouteMiddleware((to, from) => {
  const { accessTokenState } = useAuthState();

  if (to.fullPath === '/auth' || to.fullPath === '/auth/register') {
    if (accessTokenState?.value) {
      return navigateTo('/cms');
    }
  }
});
