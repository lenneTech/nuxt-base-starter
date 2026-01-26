# Better Auth Integration

This document describes the Better Auth integration in the nuxt-base-starter template.

## Overview

The template uses [Better Auth](https://www.better-auth.com/) for authentication with the following features:

| Feature               | Status | Description                            |
| --------------------- | ------ | -------------------------------------- |
| Email & Password      | ✅     | Standard email/password authentication |
| Two-Factor Auth (2FA) | ✅     | TOTP-based 2FA with backup codes       |
| Passkey (WebAuthn)    | ✅     | Passwordless authentication            |
| Session Management    | ✅     | Cookie-based sessions with SSR support |
| Password Hashing      | ✅     | Client-side SHA256 hashing             |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Nuxt)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   auth-client   │───▶│  useBetterAuth  │                     │
│  │     (lib/)      │    │  (composable)   │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                              │
│           │  SHA256 Hashing      │  Cookie-based State          │
│           │  Plugin Config       │  Session Validation          │
│           │                      │                              │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (nest-server)                      │
├─────────────────────────────────────────────────────────────────┤
│  /iam/sign-in/email          /iam/session                       │
│  /iam/sign-up/email          /iam/sign-out                      │
│  /iam/passkey/*              /iam/two-factor/*                  │
└─────────────────────────────────────────────────────────────────┘
```

## Files

| File                                 | Purpose                          |
| ------------------------------------ | -------------------------------- |
| `app/lib/auth-client.ts`             | Better Auth client configuration |
| `app/composables/use-better-auth.ts` | Auth state management composable |
| `app/pages/auth/login.vue`           | Login page                       |
| `app/pages/auth/register.vue`        | Registration page                |
| `app/pages/auth/2fa.vue`             | Two-factor authentication page   |
| `app/pages/auth/forgot-password.vue` | Password reset request           |
| `app/pages/auth/reset-password.vue`  | Password reset form              |
| `app/utils/crypto.ts`                | SHA256 hashing utility           |

## Usage

### Basic Authentication

```typescript
// In a Vue component
const { signIn, signUp, signOut, user, isAuthenticated } = useBetterAuth();

// Sign in
const result = await signIn.email({
  email: 'user@example.com',
  password: 'password123',
});

// Sign up
const result = await signUp.email({
  email: 'user@example.com',
  name: 'John Doe',
  password: 'password123',
});

// Sign out
await signOut();

// Check auth state
if (isAuthenticated.value) {
  console.log('User:', user.value);
}
```

### Passkey Authentication

```typescript
import { authClient } from '~/lib/auth-client';

// Sign in with passkey
const result = await authClient.signIn.passkey();

if (result.error) {
  console.error('Passkey login failed:', result.error.message);
} else {
  // Validate session to get user data (passkey returns session only)
  await validateSession();
  navigateTo('/app');
}
```

### Two-Factor Authentication

```typescript
import { authClient } from '~/lib/auth-client';

// Verify TOTP code
const result = await authClient.twoFactor.verifyTotp({
  code: '123456',
});

// Verify backup code
const result = await authClient.twoFactor.verifyBackupCode({
  code: 'backup-code-here',
});
```

### Session Validation

```typescript
const { validateSession, user } = useBetterAuth();

// On app init, validate the session
const isValid = await validateSession();

if (isValid) {
  console.log('Session valid, user:', user.value);
} else {
  console.log('No valid session');
}
```

## Configuration

### Environment Variables

```env
# API URL (required)
API_URL=http://localhost:3000

# Or via Vite
VITE_API_URL=http://localhost:3000
```

### Custom Configuration

```typescript
import { createBetterAuthClient } from '~/lib/auth-client';

// Create a custom client
const customClient = createBetterAuthClient({
  baseURL: 'https://api.example.com',
  basePath: '/auth', // Default: '/iam'
  twoFactorRedirectPath: '/login/2fa', // Default: '/auth/2fa'
  enableAdmin: false,
  enableTwoFactor: true,
  enablePasskey: true,
});
```

## Security

### Password Hashing

Passwords are hashed with SHA256 on the client-side before transmission:

```typescript
// This happens automatically in auth-client.ts
const hashedPassword = await sha256(plainPassword);
// Result: 64-character hex string
```

**Why client-side hashing?**

1. Prevents plain text passwords in network logs
2. Works with nest-server's `normalizePasswordForIam()` which detects SHA256 hashes
3. Server re-hashes with bcrypt for storage

### Cookie-Based Sessions

Sessions are stored in cookies for SSR compatibility:

| Cookie                      | Purpose                    |
| --------------------------- | -------------------------- |
| `auth-state`                | User data (SSR-compatible) |
| `token`                     | Session token              |
| `better-auth.session_token` | Better Auth native cookie  |

### Cross-Origin Requests

The client is configured with `credentials: 'include'` for cross-origin cookie handling:

```typescript
// In auth-client.ts
fetchOptions: {
  credentials: 'include',
}
```

**Backend CORS Configuration:**

```typescript
// In nest-server config
cors: {
  origin: 'http://localhost:3001',  // Not '*'
  credentials: true,
}
```

## Better Auth Endpoints

The following endpoints are provided by the nest-server backend:

### Authentication

| Endpoint             | Method | Description                 |
| -------------------- | ------ | --------------------------- |
| `/iam/sign-in/email` | POST   | Email/password sign in      |
| `/iam/sign-up/email` | POST   | Email/password registration |
| `/iam/sign-out`      | POST   | Sign out                    |
| `/iam/session`       | GET    | Get current session         |

### Passkey (WebAuthn)

| Endpoint                                     | Method | Description              |
| -------------------------------------------- | ------ | ------------------------ |
| `/iam/passkey/generate-register-options`     | GET    | Get registration options |
| `/iam/passkey/verify-registration`           | POST   | Verify registration      |
| `/iam/passkey/generate-authenticate-options` | GET    | Get auth options         |
| `/iam/passkey/verify-authentication`         | POST   | Verify authentication    |
| `/iam/passkey/list-user-passkeys`            | GET    | List user's passkeys     |
| `/iam/passkey/delete-passkey`                | POST   | Delete a passkey         |

### Two-Factor Authentication

| Endpoint                             | Method | Description        |
| ------------------------------------ | ------ | ------------------ |
| `/iam/two-factor/enable`             | POST   | Enable 2FA         |
| `/iam/two-factor/disable`            | POST   | Disable 2FA        |
| `/iam/two-factor/verify-totp`        | POST   | Verify TOTP code   |
| `/iam/two-factor/verify-backup-code` | POST   | Verify backup code |

## Troubleshooting

### "Passkey not found" Error

1. Ensure the user has registered a passkey first
2. Check that cookies are being sent (`credentials: 'include'`)
3. Verify CORS is configured correctly on the backend

### 2FA Redirect Not Working

Ensure the 2FA redirect is handled in the login page:

```typescript
// Check for 2FA redirect in login response
if (result.data?.twoFactorRedirect) {
  await navigateTo('/auth/2fa');
  return;
}
```

### Session Not Persisting After Passkey Login

The passkey response only contains the session, not the user. Call `validateSession()`:

```typescript
if (result.data?.session) {
  await validateSession(); // Fetches user data
}
```

### Form Not Submitting (Nuxt UI)

Ensure UForm has the `:state` binding:

```vue
<UForm :schema="schema" :state="formState" @submit="onSubmit">
  <UInput v-model="formState.field" />
</UForm>
```

## References

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth Passkey Plugin](https://www.better-auth.com/docs/plugins/passkey)
- [Better Auth Two-Factor Plugin](https://www.better-auth.com/docs/plugins/two-factor)
- [nest-server Better Auth Integration](https://github.com/lenneTech/nest-server)
