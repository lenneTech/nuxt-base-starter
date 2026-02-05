/**
 * Error Translation Unit Tests
 *
 * Tests for the error translation functionality that converts
 * backend error codes (e.g., LTNS_0100) to localized messages.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock error translations (simulating what the backend returns)
const mockErrorTranslations: Record<string, string> = {
  LTNS_0010: 'Ungültige Anmeldedaten',
  LTNS_0100: 'Sie sind nicht angemeldet.',
  LTNS_0101: 'Zugriff verweigert.',
  LTNS_0102: 'Das Benutzerkonto wurde deaktiviert.',
  LTNS_0200: 'E-Mail-Adresse ist bereits registriert.',
  LTNS_0201: 'Passwort entspricht nicht den Sicherheitsanforderungen.',
  LTNS_0300: 'Ungültiger 2FA-Code.',
  LTNS_0301: '2FA ist für dieses Konto nicht aktiviert.',
  LTNS_0400: 'Passkey konnte nicht verifiziert werden.',
};

// Simulated error parser (like the one in nuxt-extensions)
function parseError(errorMessage: string): { code: string | null; message: string } {
  // Format: "#LTNS_0100: Message text"
  const match = errorMessage.match(/^#([A-Z_0-9]+):\s*(.*)$/);
  if (match) {
    return { code: match[1], message: match[2] };
  }
  return { code: null, message: errorMessage };
}

// Simulated error translator
function translateError(error: string | { message?: string; code?: string }): string {
  if (typeof error === 'string') {
    const parsed = parseError(error);
    if (parsed.code && mockErrorTranslations[parsed.code]) {
      return mockErrorTranslations[parsed.code];
    }
    return parsed.message;
  }

  if (error.code && mockErrorTranslations[error.code]) {
    return mockErrorTranslations[error.code];
  }

  return error.message || 'Ein unbekannter Fehler ist aufgetreten.';
}

// ============================================================================
// Test Suite: Error Parsing
// ============================================================================

describe('Error Parsing', () => {
  it('should parse error code from formatted message', () => {
    const result = parseError('#LTNS_0100: Unauthorized - User is not logged in');

    expect(result.code).toBe('LTNS_0100');
    expect(result.message).toBe('Unauthorized - User is not logged in');
  });

  it('should handle message without error code', () => {
    const result = parseError('Simple error message');

    expect(result.code).toBeNull();
    expect(result.message).toBe('Simple error message');
  });

  it('should parse various error code formats', () => {
    const testCases = [
      { input: '#LTNS_0010: Invalid credentials', code: 'LTNS_0010' },
      { input: '#LTNS_0200: Email already exists', code: 'LTNS_0200' },
      { input: '#LTNS_0300: Invalid 2FA code', code: 'LTNS_0300' },
    ];

    testCases.forEach(({ input, code }) => {
      const result = parseError(input);
      expect(result.code).toBe(code);
    });
  });
});

// ============================================================================
// Test Suite: Error Translation
// ============================================================================

describe('Error Translation', () => {
  it('should translate known error code to German message', () => {
    const result = translateError('#LTNS_0010: Invalid credentials');

    expect(result).toBe('Ungültige Anmeldedaten');
  });

  it('should translate authentication errors', () => {
    const errorCodes = [
      { code: 'LTNS_0100', expected: 'Sie sind nicht angemeldet.' },
      { code: 'LTNS_0101', expected: 'Zugriff verweigert.' },
      { code: 'LTNS_0102', expected: 'Das Benutzerkonto wurde deaktiviert.' },
    ];

    errorCodes.forEach(({ code, expected }) => {
      const result = translateError({ code, message: 'Some message' });
      expect(result).toBe(expected);
    });
  });

  it('should translate registration errors', () => {
    const errorCodes = [
      { code: 'LTNS_0200', expected: 'E-Mail-Adresse ist bereits registriert.' },
      { code: 'LTNS_0201', expected: 'Passwort entspricht nicht den Sicherheitsanforderungen.' },
    ];

    errorCodes.forEach(({ code, expected }) => {
      const result = translateError({ code, message: 'Some message' });
      expect(result).toBe(expected);
    });
  });

  it('should translate 2FA errors', () => {
    const errorCodes = [
      { code: 'LTNS_0300', expected: 'Ungültiger 2FA-Code.' },
      { code: 'LTNS_0301', expected: '2FA ist für dieses Konto nicht aktiviert.' },
    ];

    errorCodes.forEach(({ code, expected }) => {
      const result = translateError({ code, message: 'Some message' });
      expect(result).toBe(expected);
    });
  });

  it('should translate passkey errors', () => {
    const result = translateError({ code: 'LTNS_0400', message: 'Passkey error' });

    expect(result).toBe('Passkey konnte nicht verifiziert werden.');
  });

  it('should return original message for unknown error codes', () => {
    const result = translateError({ code: 'UNKNOWN_CODE', message: 'Original message' });

    expect(result).toBe('Original message');
  });

  it('should return fallback for missing message', () => {
    const result = translateError({ code: 'UNKNOWN_CODE' });

    expect(result).toBe('Ein unbekannter Fehler ist aufgetreten.');
  });

  it('should handle string errors without code', () => {
    const result = translateError('Network error');

    expect(result).toBe('Network error');
  });
});

// ============================================================================
// Test Suite: Error Translation API Mock
// ============================================================================

describe('Error Translation API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should load translations from backend endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ errors: mockErrorTranslations }),
    });
    globalThis.fetch = mockFetch;

    const response = await fetch('/api/i18n/errors/de');
    const data = await response.json();

    expect(mockFetch).toHaveBeenCalledWith('/api/i18n/errors/de');
    expect(data.errors).toHaveProperty('LTNS_0010');
    expect(data.errors.LTNS_0010).toBe('Ungültige Anmeldedaten');
  });

  it('should handle backend error gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    globalThis.fetch = mockFetch;

    const response = await fetch('/api/i18n/errors/de');

    expect(response.ok).toBe(false);
  });

  it('should cache translations for performance', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ errors: mockErrorTranslations }),
      });
    });
    globalThis.fetch = mockFetch;

    // Simulated cache
    const translationCache: Record<string, Record<string, string>> = {};

    async function getTranslations(locale: string): Promise<Record<string, string>> {
      if (translationCache[locale]) {
        return translationCache[locale];
      }

      const response = await fetch(`/api/i18n/errors/${locale}`);
      const data = await response.json();
      translationCache[locale] = data.errors;
      return data.errors;
    }

    // First call - should fetch
    await getTranslations('de');
    expect(callCount).toBe(1);

    // Second call - should use cache
    await getTranslations('de');
    expect(callCount).toBe(1); // Still 1, not 2
  });
});

// ============================================================================
// Test Suite: Toast Integration
// ============================================================================

describe('Error Toast Integration', () => {
  it('should format error for toast display', () => {
    interface ToastOptions {
      title: string;
      description: string;
      color: string;
    }

    function createErrorToast(error: string | { code?: string; message?: string }): ToastOptions {
      const translatedMessage = translateError(error);
      return {
        title: 'Fehler',
        description: translatedMessage,
        color: 'error',
      };
    }

    const toast = createErrorToast({ code: 'LTNS_0010', message: 'Invalid credentials' });

    expect(toast.title).toBe('Fehler');
    expect(toast.description).toBe('Ungültige Anmeldedaten');
    expect(toast.color).toBe('error');
  });

  it('should handle custom toast titles', () => {
    interface ToastOptions {
      title: string;
      description: string;
      color: string;
    }

    function createErrorToast(error: string | { code?: string; message?: string }, customTitle?: string): ToastOptions {
      const translatedMessage = translateError(error);
      return {
        title: customTitle || 'Fehler',
        description: translatedMessage,
        color: 'error',
      };
    }

    const toast = createErrorToast({ code: 'LTNS_0010' }, 'Anmeldung fehlgeschlagen');

    expect(toast.title).toBe('Anmeldung fehlgeschlagen');
    expect(toast.description).toBe('Ungültige Anmeldedaten');
  });
});
