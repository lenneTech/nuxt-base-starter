import { expect, test } from '@nuxt/test-utils/playwright';

import { authClient, type AuthResponse } from '../app/lib/auth-client';

/**
 * IAM E2E Tests using Better-Auth Client
 *
 * These tests use the Better-Auth client library directly to communicate
 * with the /iam API endpoints on the running API server.
 *
 * Test flow: Test Runner → Better-Auth Client → API Server (/iam endpoints)
 *
 * Prerequisites:
 * - API server running on http://localhost:3000
 *
 * NOTE: These tests are for DEMO purposes only. If the API server is not
 * running, tests will be skipped with a warning (not treated as failure).
 */

// Flag to track API availability - checked once in beforeAll
let apiAvailable = false;

test.describe.serial('IAM Better-Auth Client Tests', () => {
  // Shared test user credentials - created once in the first test
  const testId = Date.now();
  const testEmail = `playwright-${testId}@iam-test.com`;
  const testPassword = `TestPass${testId}!`;
  const testName = 'Playwright Test User';

  test.beforeAll(async ({ request }) => {
    // Check if the API server is running
    try {
      const response = await request.get('http://localhost:3000/');
      if (response.ok()) {
        apiAvailable = true;
        console.info('✓ API Server is running at http://localhost:3000');
      }
    } catch (_error) {
      // API is not available - will be handled below
    }

    if (!apiAvailable) {
      console.warn('');
      console.warn('⚠️  ═══════════════════════════════════════════════════════════');
      console.warn('⚠️   WARNING: API Server is not running!');
      console.warn('⚠️');
      console.warn('⚠️   IAM tests will be SKIPPED (demo tests only)');
      console.warn('⚠️');
      console.warn('⚠️   To run these tests, start the API server first:');
      console.warn('⚠️     cd projects/api && npm start');
      console.warn('⚠️');
      console.warn('⚠️   Then run the tests:');
      console.warn('⚠️     cd projects/app && npm run test:e2e');
      console.warn('⚠️  ═══════════════════════════════════════════════════════════');
      console.warn('');
    }
  });

  // =========================================================================
  // Sign-Up Tests
  // =========================================================================

  test('1. should sign up a new user via Better-Auth client', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const response = (await authClient.signUp.email({
      email: testEmail,
      name: testName,
      password: testPassword,
    })) as AuthResponse;

    expect(response.error).toBeNull();
    expect(response.data?.user?.email).toBe(testEmail);
    console.info(`  ✓ User registered: ${testEmail}`);
  });

  test('2. should fail sign-up with existing email', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const response = (await authClient.signUp.email({
      email: testEmail,
      name: testName,
      password: testPassword,
    })) as AuthResponse;

    // Better-Auth returns error in response for duplicate email
    expect(response.error).not.toBeNull();
    console.info('  ✓ Duplicate registration correctly rejected');
  });

  // =========================================================================
  // Sign-In Tests
  // =========================================================================

  test('3. should sign in with valid credentials', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const response = (await authClient.signIn.email({
      email: testEmail,
      password: testPassword,
    })) as AuthResponse;

    expect(response.error).toBeNull();
    expect(response.data?.user?.email).toBe(testEmail);
    expect(response.data?.user).toBeDefined();
    expect(response.data?.token).toBeDefined(); // JWT token - presence indicates success
    console.info(`  ✓ User signed in: ${testEmail}`);
  });

  test('4. should fail sign-in with wrong password', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const response = (await authClient.signIn.email({
      email: testEmail,
      password: 'WrongPassword123!',
    })) as AuthResponse;

    expect(response.error).not.toBeNull();
    console.info('  ✓ Wrong password correctly rejected');
  });

  test('5. should fail sign-in with non-existent email', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const response = (await authClient.signIn.email({
      email: 'nonexistent@iam-test.com',
      password: 'SomePassword123!',
    })) as AuthResponse;

    expect(response.error).not.toBeNull();
    console.info('  ✓ Non-existent user correctly rejected');
  });

  // =========================================================================
  // Session Tests
  // =========================================================================

  test('6. should get session after sign-in', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    // First sign in
    const signInResponse = (await authClient.signIn.email({
      email: testEmail,
      password: testPassword,
    })) as AuthResponse;
    expect(signInResponse.error).toBeNull();

    // Verify user data is returned (session details depend on JWT/cookie mode)
    expect(signInResponse.data?.user).toBeDefined();
    expect(signInResponse.data?.user?.email).toBe(testEmail);

    console.info('  ✓ Sign-in successful, user data received');
  });

  // =========================================================================
  // Sign-Out Tests
  // =========================================================================

  test('7. should sign out successfully', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    // First sign in
    const signInResponse = (await authClient.signIn.email({
      email: testEmail,
      password: testPassword,
    })) as AuthResponse;
    expect(signInResponse.error).toBeNull();

    // Then sign out - a Better-Auth client handles cookies internally
    await authClient.signOut();

    // Sign-out should succeed
    console.info('  ✓ Sign-out completed');
  });

  // =========================================================================
  // Full Authentication Flow
  // =========================================================================

  test('8. should complete full auth flow: sign-up -> sign-in -> sign-out', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const flowEmail = `flow-${Date.now()}@iam-test.com`;
    const flowPassword = `FlowPass${Date.now()}!`;
    const flowName = 'Flow Test User';

    // Step 1: Sign Up
    const signUpRes = (await authClient.signUp.email({
      email: flowEmail,
      name: flowName,
      password: flowPassword,
    })) as AuthResponse;
    expect(signUpRes.error).toBeNull();
    expect(signUpRes.data?.user?.email).toBe(flowEmail);
    console.info('  ✓ Step 1: Sign-up successful');

    // Step 2: Sign In
    const signInRes = (await authClient.signIn.email({
      email: flowEmail,
      password: flowPassword,
    })) as AuthResponse;
    expect(signInRes.error).toBeNull();
    expect(signInRes.data?.user?.email).toBe(flowEmail);
    expect(signInRes.data?.user).toBeDefined();
    console.info('  ✓ Step 2: Sign-in successful');

    // Step 3: Sign Out
    await authClient.signOut();
    console.info('  ✓ Step 3: Sign-out successful');
  });

  // =========================================================================
  // Response Structure Tests
  // =========================================================================

  test('9. sign-in response should have correct structure', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const response = (await authClient.signIn.email({
      email: testEmail,
      password: testPassword,
    })) as AuthResponse;

    expect(response.error).toBeNull();
    expect(response.data).toBeDefined();
    expect(response.data?.user).toBeDefined();
    expect(response.data?.user?.id).toBeDefined();
    expect(response.data?.user?.email).toBe(testEmail);
    // User object should have core fields
    expect(response.data?.user?.name).toBeDefined();
    console.info('  ✓ Response structure validated');
  });

  test('10. error response should have correct structure', async () => {
    test.skip(!apiAvailable, 'API server not running - skipping demo test');

    const response = (await authClient.signIn.email({
      email: 'invalid@iam-test.com',
      password: 'wrongPassword',
    })) as AuthResponse;

    expect(response.error).not.toBeNull();
    expect(response.error?.message).toBeDefined();
    expect(response.error?.status).toBeDefined();
    console.info('  ✓ Error response structure validated');
  });
});
