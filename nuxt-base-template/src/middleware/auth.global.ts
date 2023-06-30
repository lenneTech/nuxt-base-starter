export default defineNuxtRouteMiddleware((to, from) => {
  const store = useAuthStore();

  if (to.fullPath.startsWith('/auth/')) {
    return;
  }

  if (!store.token || !store.currentUser) {
    return navigateTo('/auth/login');
  }
});
