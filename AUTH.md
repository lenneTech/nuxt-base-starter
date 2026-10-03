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
│  │ useLtAuthClient │───▶│    useLtAuth    │                     │
│  │ (Better Auth)   │    │  (composable)   │                     │
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

Both boxes ship with `@lenne.tech/nuxt-extensions` and are auto-imported. The template
contains no auth client and no auth composable of its own. Before that package existed it
did (`app/lib/auth-client.ts`, `app/composables/use-better-auth.ts`), and a search for
those names finds nothing today. That is not proof that the feature is missing. List
`node_modules/@lenne.tech/nuxt-extensions/dist/runtime/composables/` (npm mode) or
`app/core/runtime/composables/` (vendor mode) instead.

## Files

| File                                   | Purpose                                         |
| -------------------------------------- | ----------------------------------------------- |
| `nuxt.config.ts` (`ltExtensions.auth`) | Auth configuration: base path, enabled features |
| `app/middleware/auth.global.ts`        | Redirects anonymous visitors to the login       |
| `app/middleware/guest.global.ts`       | Keeps signed-in users off the auth pages        |
| `app/middleware/admin.global.ts`       | Guards `/app/admin/**`                          |
| `app/pages/auth/login.vue`             | Login page (email/password and passkey)         |
| `app/pages/auth/register.vue`          | Registration page                               |
| `app/pages/auth/2fa.vue`               | Two-factor authentication page                  |
| `app/pages/auth/verify-email.vue`      | E-mail verification                             |
| `app/pages/auth/forgot-password.vue`   | Password reset request                          |
| `app/pages/auth/reset-password.vue`    | Password reset form                             |
| `app/pages/auth/setup.vue`             | First-run admin setup                           |
| `app/pages/app/settings/security.vue`  | Manage passkeys and 2FA                         |

## Usage

### Basic Authentication

```typescript
// In a Vue component
const { signIn, signUp, signOut, user, isAuthenticated } = useLtAuth();

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
const { authenticateWithPasskey, setUser, validateSession } = useLtAuth();

// Sign in with passkey (also handles the challengeId of JWT mode)
const result = await authenticateWithPasskey();

if (!result.success) {
  console.error('Passkey login failed:', result.error);
} else {
  // The response may carry the user; if not, fetch it from the session
  result.user ? setUser(result.user) : await validateSession();
  navigateTo('/app');
}
```

Listing and deleting passkeys goes through the raw client:
`useLtAuthClient().passkey.listUserPasskeys()` and `.passkey.deletePasskey({ id })`, as in
`app/pages/app/settings/security.vue`.

### Two-Factor Authentication

```typescript
const authClient = useLtAuthClient();

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
const { validateSession, user } = useLtAuth();

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
# API URL — SSR / server-side, and the Vite dev proxy target (required)
NUXT_API_URL=http://localhost:3000

# API URL — client-side (required)
NUXT_PUBLIC_API_URL=http://localhost:3000

# Public origin of THIS app — required on every non-local stage.
# Builds the absolute redirect URLs that go into auth mails (see below).
NUXT_PUBLIC_SITE_URL=https://app.example.com
```

### Password reset requires nest-server 11.36.1 or newer

The frontend half of this flow is only half of it. **Before `@lenne.tech/nest-server`
11.36.1, no `sendResetPassword` hook was wired at all**, so `POST /iam/request-password-reset`
answered `RESET_PASSWORD_DISABLED` and no mail was ever sent — regardless of what the
frontend sent. From 11.36.1 the hook is injected by `CoreBetterAuthModule` and the route
is live from the first boot, with no configuration needed.

That matters when upgrading a project: pairing this starter's 2.18.0 redirect fix with an
older backend swaps one silent failure for another. The frontend sends a correct absolute
`redirectTo`, and the server still refuses to send anything. Check the backend version
before concluding the reset flow is broken:

```bash
npm view @lenne.tech/nest-server version   # what's current
node -e "console.log(require('./projects/api/package.json').dependencies['@lenne.tech/nest-server'])"
```

Two consequences of that upgrade worth knowing, both from the module's
`INTEGRATION-CHECKLIST.md`:

- **Reset mail starts going out to real users** the moment the backend reaches 11.36.1.
  It is a behaviour change, not just a fix. To keep the flow off (support-mediated or
  SSO-primary reset policies), set `betterAuth.emailAndPassword.passwordReset: false`.
- **Rate limiting is not on unless you configure it.** `betterAuth.rateLimit` is absent by
  default; providing the object at all — even `{}` — enables it. Before 11.36.1 the
  mail-sending endpoint additionally slipped through the strict-endpoint list, so it ran on
  the full limit. What does hold per address either way is the mailer's
  `emailVerification.resendCooldownSeconds` (60 s by default), which this starter's
  forgot-password page reads for its resend cooldown.

### Redirect origins and `trustedOrigins`

Two auth flows send the user out to an e-mail and back: password reset and e-mail
verification. Both hand Better Auth a URL to return to, and both fail in the same
quiet way when that URL is wrong.

**Why the URL must be absolute.** Better Auth resolves the value against **its own**
base URL (`new URL(callbackURL, ctx.baseURL)`), which is the API origin. Since app and
API are separate hosts here, a relative path like `/auth/reset-password` resolves to
`api.<host>/auth/reset-password` — a route that does not exist. Build it with
`appUrl()` from `app/utils/app-origin.ts` (auto-imported):

```typescript
await authClient.requestPasswordReset({
  email,
  redirectTo: appUrl('/auth/reset-password', config.public.siteUrl),
});
```

Never interpolate the config value directly. When `runtimeConfig.public.siteUrl` is
undeclared or unset, a template literal renders the literal text
`"undefined/auth/reset-password"`; Better Auth answers **403 INVALID_REDIRECT_URL**,
no mail is sent, and the user is locked out of their account with only a generic error
to go on. That is a real incident this starter has already had.

**The backend has to agree.** Better Auth validates every `redirectTo` / `callbackURL`
server-side against its `trustedOrigins` list — built from the configured origins, the
CORS `allowedOrigins`, the passkey origins and `appUrl` in `nest-server`, never from
the request. Whatever origin the frontend sends must be in that list, or the same 403
appears. So a new stage needs its origin registered on **both** sides: the frontend's
`NUXT_PUBLIC_SITE_URL` and the backend's trusted origins.

**Never use wildcard entries** (`https://*.example.com`) in `trustedOrigins`. `redirectTo`
is validated against that list and the reset redirect carries a live one-time token, so any
origin the wildcard admits can receive it — an account-takeover path, not a theoretical one.
From nest-server 11.36.1 the framework logs a warning at boot when it finds a wildcard
there. List exact origins.

### Custom Configuration

The client `useLtAuthClient()` returns is configured in `nuxt.config.ts`:

```typescript
ltExtensions: {
  auth: {
    basePath: '/iam', // Must match the nest-server IAM mount point
    twoFactorRedirectPath: '/auth/2fa',
    enableAdmin: true,
    enableTwoFactor: true,
    enablePasskey: true,
  },
}
```

A second, separately configured client is rare. If one is needed, `createLtAuthClient()`
(auto-imported) takes `baseURL`, `basePath`, `twoFactorRedirectPath`, the three `enable*`
flags and `plugins`.

## Security

### Password Hashing

Passwords are hashed with SHA256 on the client-side before transmission:

```typescript
// Happens automatically inside useLtAuthClient(): sign-in, sign-up, password change and
// reset, 2FA enable/disable/backup codes. Not admin.* — nest-server has no route for it.
const hashedPassword = await ltSha256(plainPassword);
// Result: 64-character hex string
```

**Why client-side hashing?**

1. Prevents plain text passwords in network logs
2. Works with nest-server's `normalizePasswordForIam()` which detects SHA256 hashes
3. Server re-hashes with bcrypt for storage

### Cookie-Based Sessions

Sessions are stored in cookies for SSR compatibility:

| Cookie              | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `lt-auth-state`     | User data (SSR-compatible); write it only via `useLtAuth()` |
| `lt-jwt-token`      | JWT, used when the session cookie does not work (JWT mode)  |
| `iam.session_token` | Better Auth native cookie, set by the backend               |

The two `lt-*` names are defaults and can be changed via `ltExtensions.auth.cookieNames`.
The Better Auth prefix `iam` follows the backend's base path `/iam`; nest-server reads
`COOKIE_PREFIX` to override it.

### Cross-Origin Requests

`@lenne.tech/nuxt-extensions` sends its auth requests with `credentials: 'include'`, so the
cookies travel to the API on its separate host.

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
