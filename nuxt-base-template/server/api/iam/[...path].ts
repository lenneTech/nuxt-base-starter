/**
 * Proxy handler for Better Auth API requests
 * This ensures cookies are properly forwarded between frontend (localhost:3001) and API (localhost:3000)
 * Required for WebAuthn/Passkey functionality in development mode
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') || '';
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const targetUrl = `${apiUrl}/iam/${path}`;

  // Get query string
  const query = getQuery(event);
  const queryString = new URLSearchParams(query as Record<string, string>).toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  // Get request body for POST/PUT requests
  const method = event.method;
  let body: any;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    body = await readBody(event);
  }

  // Forward cookies and origin from the incoming request
  const cookieHeader = getHeader(event, 'cookie');
  const originHeader = getHeader(event, 'origin') || 'http://localhost:3001';

  // Make the request to the API
  const response = await $fetch.raw(fullUrl, {
    method: method as any,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      'Origin': originHeader,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    credentials: 'include',
    // Don't throw on error status codes
    ignoreResponseError: true,
  });

  // Forward Set-Cookie headers from the API response
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  for (const cookie of setCookieHeaders) {
    // Rewrite cookie to work on localhost (remove domain/port specifics)
    const rewrittenCookie = cookie
      .replace(/domain=[^;]+;?\s*/gi, '')
      .replace(/secure;?\s*/gi, '');
    appendResponseHeader(event, 'Set-Cookie', rewrittenCookie);
  }

  // Set response status
  setResponseStatus(event, response.status);

  // Return the response body
  return response._data;
});
