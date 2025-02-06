export default defineNuxtRouteMiddleware((to) => {
  const { currentUserState } = useAuthState();

  if (to.fullPath.startsWith('/app/admin')) {
    if (!currentUserState?.value?.roles?.includes('admin')) {
      return navigateTo('/app');
    }
  }
});
