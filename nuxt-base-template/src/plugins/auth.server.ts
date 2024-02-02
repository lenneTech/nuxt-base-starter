import { callWithNuxt, defineNuxtPlugin, useNuxtApp, useRuntimeConfig } from 'nuxt/app';
import { ofetch } from 'ofetch';

export default defineNuxtPlugin({
  enforce: 'post',
  name: 'auth-server',
  async setup() {
    const _nuxt = useNuxtApp();
    const config = await callWithNuxt(_nuxt, useRuntimeConfig);
    const { accessTokenState, currentUserState, refreshTokenState } = await callWithNuxt(_nuxt, useAuthState);
    const { clearSession, getDecodedAccessToken, isTokenExpired, setCurrentUser, setTokens } = await callWithNuxt(_nuxt, useAuth);
    const payload = accessTokenState.value ? getDecodedAccessToken(accessTokenState.value) : null;

    if (!accessTokenState.value || !refreshTokenState.value || currentUserState.value) {
      return;
    }

    let token = accessTokenState.value;
    if (isTokenExpired(accessTokenState.value)) {
      const refreshTokenResult = await ofetch(config.public.host, {
        body: JSON.stringify({
          query: 'mutation refreshToken {refreshToken {token, refreshToken}}',
          variables: {},
        }),
        headers: {
          Authorization: `Bearer ${refreshTokenState.value}`,
        },
        method: 'POST',
      }).catch((err) => {
        console.error('2.auth.server.ts::refreshToken::catch', err.data);
        clearSession();
        navigateTo('/auth/login');
      });

      const data = refreshTokenResult?.data?.refreshToken;
      if (data) {
        setTokens(data.token, data.refreshToken);
        token = data?.token;
      } else {
        clearSession();
        await navigateTo('/auth/login');
      }
    }

    if (token && payload?.id) {
      const userResult = await ofetch(config.public.host, {
        body: JSON.stringify({
          query: 'query getUser($id: String!){' + 'getUser(id: $id){' + 'id ' + 'avatar ' + 'firstName ' + 'lastName ' + 'email ' + 'gender ' + 'roles ' + '}}',
          variables: {
            id: payload.id,
          },
        }),
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: 'POST',
      }).catch((err) => {
        console.error('2.auth.server.ts::getUser::catch', err);
      });

      if (userResult?.errors) {
        clearSession();
        navigateTo('/auth/login');
        return;
      }

      if (userResult?.data) {
        setCurrentUser(userResult?.data?.getUser);
      }
    }
  },
});
