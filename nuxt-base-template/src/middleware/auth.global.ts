export default defineNuxtRouteMiddleware((to, from) => {
  const { accessToken } = useAuthState();

  if (to.fullPath.startsWith('/app')) {
    if (!accessToken?.value) {
      return navigateTo('/auth/login');
    }
  }
});
