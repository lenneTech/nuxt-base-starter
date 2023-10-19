import { callWithNuxt, defineNuxtPlugin, useNuxtApp, useRuntimeConfig } from 'nuxt/app';
import { ofetch } from 'ofetch';

export default defineNuxtPlugin({
  name: 'auth-server',
  enforce: 'pre',
  async setup() {
    console.debug('4.auth.server.ts::init');
    const _nuxt = useNuxtApp();
    const config = await callWithNuxt(_nuxt, useRuntimeConfig);
    const { refreshToken, accessToken } = await callWithNuxt(_nuxt, useAuthState);
    const { setCurrentUser, getDecodedAccessToken, setTokens } = await callWithNuxt(_nuxt, useAuth);
    const payload = accessToken.value ? getDecodedAccessToken(accessToken.value) : null;

    if (!refreshToken.value) {
      return;
    }

    const refreshTokenResult = await ofetch(config.public.host, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshToken.value}`,
      },
      body: JSON.stringify({
        query: 'mutation refreshToken {refreshToken {token, refreshToken}}',
        variables: {},
      }),
    }).catch((err) => {
      console.error('4.auth.server.ts::refreshToken::catch', err.data);
    });

    console.debug('4.auth.server.ts::refreshTokenResult', refreshTokenResult);

    if (refreshTokenResult?.data) {
      const data = refreshTokenResult.data.refreshToken;
      console.debug('4.auth.server.ts::token', data?.token);
      console.debug('4.auth.server.ts::refreshToken', data?.refreshToken);
      setTokens(data.token, data.refreshToken);

      if (payload?.id) {
        const userResult = await ofetch(config.public.host, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${refreshTokenResult.data.refreshToken?.token}`,
          },
          body: JSON.stringify({
            query: 'query getUser($id: String!){' +
                            'getUser(id: $id){' +
                            'id ' +
                            'avatar ' +
                            'firstName ' +
                            'lastName ' +
                            'email ' +
                            'roles ' +
                            '}}',
            variables: {
              id: payload.id,
            },
          }),
        }).catch((err) => {
          console.error('4.auth.server.ts::getUser::catch', err.data);
        });
        console.debug('4.auth.server.ts::getUser::userResult', userResult);
        if (userResult?.data) {
          setCurrentUser(userResult?.data?.getUser);
        }
      }
    }
  },
});