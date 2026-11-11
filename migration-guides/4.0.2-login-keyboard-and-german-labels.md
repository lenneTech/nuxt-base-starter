# Migration Guide: "Passwort vergessen?" by keyboard, "Abmelden" instead of "Logout"

Two older accessibility defects:

- **"Passwort vergessen?" was out of the keyboard order.** The link in the password field's label
  row on `/auth/login` carried `tabindex="-1"`, so Tab skipped it. Without a mouse the reset flow
  could be reached only by typing its URL (WCAG 2.1.1). Now it is the next Tab stop after the email
  field, where it is placed visually, and Enter follows it.
- **The header spoke English in a German UI.** The sign-out button was called "Logout" (tooltip and
  `aria-label`), and the sign-in button for visitors "Login". Both now say "Abmelden" and
  "Anmelden".

| Project                                         | What to do              |
| ----------------------------------------------- | ----------------------- |
| Has the starter's `login.vue` and `default.vue` | Steps 1 to 4            |
| Has its own login page or header                | Steps 1 and 2 for yours |

No dependency and no API change are needed.

## Upgrade steps (existing project)

In an `lt fullstack` monorepo, the steps happen in `projects/app/`.

### 1. `app/pages/auth/login.vue`

Remove `tabindex="-1"` from the link in the `#password-hint` slot:

```vue
<ULink to="/auth/forgot-password" class="text-primary font-medium">Passwort vergessen?</ULink>
```

### 2. `app/layouts/default.vue`

```vue
<UTooltip text="Abmelden">
  <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" aria-label="Abmelden" @click="handleLogout" />
</UTooltip>
…
<UButton color="primary" variant="soft" to="/auth/login" icon="i-lucide-log-in" label="Anmelden" />
```

### 3. Move the E2E selectors with the label

The specs find the sign-out button by its old name and fail after step 2 until they move with it.
`/app` has a second button "Abmelden" (in the page), so select the header button by its
`aria-label`, not by role and name:

| File                                       | Before                                         | After                                          |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------- |
| `tests/e2e/auth-lifecycle.spec.ts`         | `page.getByLabel('Logout')`                    | `page.getByLabel('Abmelden', { exact: true })` |
| `tests/e2e/auth-multiple-passkeys.spec.ts` | `page.getByLabel('Logout')`                    | `page.getByLabel('Abmelden', { exact: true })` |
| `tests/e2e/ai-visibility.spec.ts`          | `page.getByRole('button', { name: 'Logout' })` | `page.getByLabel('Abmelden', { exact: true })` |

Specs of your own that select "Logout" or "Login" move the same way.

### 4. Take over the tests

- `tests/unit/keyboard-reachable-controls.test.ts` fails for any link or button under `app/` (the
  vendored `app/core/` aside) with `tabindex="-1"`. An element your code focuses on purpose, such as
  a heading, is no link or button and stays allowed.
- `tests/e2e/auth-keyboard.spec.ts` focuses the email field, presses Tab, expects "Passwort
  vergessen?" focused and Enter to open `/auth/forgot-password`. Vendor mode: change its import
  `from '@lenne.tech/nuxt-extensions/testing'` to `from '../../app/core/runtime/testing'`.

```bash
pnpm exec vitest run tests/unit/keyboard-reachable-controls.test.ts
pnpm exec playwright test tests/e2e/auth-keyboard.spec.ts
```

## Check it

Open `/auth/login`, click into the email field and press Tab: "Passwort vergessen?" is focused, and
Enter opens the reset page. Signed in, the header button reads "Abmelden" on hover and to a screen
reader.
