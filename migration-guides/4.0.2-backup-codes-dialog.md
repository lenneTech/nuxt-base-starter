# Migration Guide: "Neue Backup-Codes generieren" generates codes again

In the backup codes dialog (`app/components/Modal/ModalBackupCodes.vue`), opened from the security
settings with "Backup-Codes anzeigen", the button "Neue Backup-Codes generieren" did nothing. The
form had a schema and a submit handler, but no `:state`, and the password field no `v-model`.
Nuxt UI's `UForm` validates its state against the schema before it submits. It validated
`undefined`, the password rule failed, and the submit handler never ran: no request, no message.

| Project                                              | What to do   |
| ---------------------------------------------------- | ------------ |
| Has the starter's `ModalBackupCodes.vue`             | Steps 1 to 3 |
| Has its own backup codes dialog, or forms of its own | Step 2       |

No dependency and no API change are needed.

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`.

### 1. Bind the form's state

In `app/components/Modal/ModalBackupCodes.vue`, after `type PasswordSchema = …`:

```ts
const passwordState = reactive<{ password: string }>({ password: '' });
```

and in the template:

```vue
<UForm :schema="passwordSchema" :state="passwordState" class="space-y-4" @submit="generateBackupCodes">
  <UFormField label="Passwort" name="password">
    <UInput v-model="passwordState.password" name="password" type="password" placeholder="Dein Passwort" autocomplete="current-password" />
  </UFormField>
```

### 2. Check every other form

Copy `tests/unit/uform-state-contract.test.ts`. It reads every `.vue` file under `app/` (the vendored
`app/core/` aside) and fails for a `<UForm>` without `:state`. A form of your own without a schema
may work without state; give it one anyway or the test reports it.

```bash
pnpm exec vitest run tests/unit/uform-state-contract.test.ts
```

### 3. Take over the E2E step

In `tests/e2e/auth-lifecycle.spec.ts`, Step 6 now opens "Backup-Codes anzeigen", enters the password,
clicks "Neue Backup-Codes generieren", expects HTTP 200 from `/two-factor/generate-backup-codes` and
ten codes in the dialog. Take over the lines between `// New backup codes, with the password.` and
the closing `console.info('  10 new backup codes generated')`.

## Check it

Sign in with 2FA on, open the security settings, click "Backup-Codes anzeigen", enter your password
and click "Neue Backup-Codes generieren": ten new codes appear.
