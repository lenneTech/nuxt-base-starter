/**
 * Vitest Global Setup
 *
 * This file is loaded before each test file.
 * It sets up global mocks and utilities.
 */

import { vi } from 'vitest';

// Mock window.location for tests
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3001',
    origin: 'http://localhost:3001',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});

// Mock document.cookie
let cookies: Record<string, string> = {};

Object.defineProperty(document, 'cookie', {
  get: () => {
    return Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  },
  set: (value: string) => {
    const [cookiePart] = value.split(';');
    const [key, val] = cookiePart.split('=');
    if (val === '' || value.includes('max-age=0')) {
      delete cookies[key];
    } else {
      cookies[key] = val;
    }
  },
});

// Helper to reset cookies between tests
export function resetCookies(): void {
  cookies = {};
}

// Mock fetch globally
globalThis.fetch = vi.fn();

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});

// Export for use in tests
export { vi };
