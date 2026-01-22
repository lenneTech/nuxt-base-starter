/**
 * Proxy handler for Better Auth API requests
 *
 * This proxy is REQUIRED for WebAuthn/Passkey functionality in development mode because:
 * 1. Frontend runs on a different port (e.g., 3001/3002) than the API (3000)
 * 2. WebAuthn validates the origin, which must be consistent
 * 3. Cross-origin requests have cookie handling issues
 *
 * The proxy ensures:
 * - Cookies are properly forwarded between frontend and API
 * - The origin header is preserved for WebAuthn validation
 * - Set-Cookie headers from the API are forwarded to the browser
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') || '';
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const targetUrl = `${apiUrl}/iam/${path}`;

  // Get query string
  const query = getQuery(event);
  const queryString = new URLSearchParams(query as Record<string, string>).toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  // Get request body for POST/PUT/PATCH requests
  const method = event.method;
  let body: any;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    body = await readBody(event);
  }

  // Forward cookies and authorization from the incoming request
  const cookieHeader = getHeader(event, 'cookie');
  const authHeader = getHeader(event, 'authorization');
  // Use the actual origin from the request, fallback to localhost
  const originHeader = getHeader(event, 'origin') || getHeader(event, 'referer')?.replace(/\/[^/]*$/, '') || 'http://localhost:3001';

  // Make the request to the API
  const response = await $fetch.raw(fullUrl, {
    method: method as any,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      Origin: originHeader,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    credentials: 'include',
    // Don't throw on error status codes
    ignoreResponseError: true,
  });

  // Forward Set-Cookie headers from the API response
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  for (const cookie of setCookieHeaders) {
    // Rewrite cookie to work on localhost:
    // 1. Remove domain (cookie will be set for current origin)
    // 2. Remove secure flag (not needed for localhost)
    // 3. Rewrite path from /iam to /api/iam (or set to / for broader access)
    const rewrittenCookie = cookie
      .replace(/domain=[^;]+;?\s*/gi, '')
      .replace(/secure;?\s*/gi, '')
      // Ensure path is set to / so cookies work for all routes
      .replace(/path=\/iam[^;]*;?\s*/gi, 'path=/; ')
      .replace(/path=[^;]+;?\s*/gi, 'path=/; ');
    appendResponseHeader(event, 'Set-Cookie', rewrittenCookie);
  }

  // Set response status
  setResponseStatus(event, response.status);

  // Return the response body
  return response._data;
});
