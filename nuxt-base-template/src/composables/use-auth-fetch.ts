import type { ExtractedRouteMethod, NitroFetchOptions, NitroFetchRequest, TypedInternalResponse } from 'nitropack';

export function useAuthFetch<DefaultT = unknown, DefaultR extends NitroFetchRequest = NitroFetchRequest, T = DefaultT, R extends NitroFetchRequest = DefaultR, O extends NitroFetchOptions<R> = NitroFetchOptions<R>>(request: R, opts?: O): Promise<TypedInternalResponse<R, T, ExtractedRouteMethod<R, O>>>  {
  const { requestNewToken } = useAuth();
  const config = useRuntimeConfig();

  // @ts-expect-error - because of nice types from ofetch <3
  return $fetch(request, {
    ...opts,
    baseURL: config.public.apiUrl,
    retry: 3,
    async onRequest({ request, options }) {
      const { token } = await requestNewToken();
      options.headers = {
        'Authorization': 'Bearer ' + token,
      };
    },
  });
}