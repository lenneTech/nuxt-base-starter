# nuxt-base-starter (repository root)

This root carries the release tooling; the app is `nuxt-base-template/`, and its conventions are in
[`nuxt-base-template/CLAUDE.md`](./nuxt-base-template/CLAUDE.md). `lt fullstack init` and
`lt frontend nuxt` copy only `nuxt-base-template/`, so nothing in this file reaches a generated
project.

## Versioning: the starter follows nuxt-extensions, release for release

Owner rule (Kai, 2026-11-07), the same as nest-server-starter's for nest-server:

1. **Same number.** The `version` in the root `package.json` equals the
   `@lenne.tech/nuxt-extensions` version that `nuxt-base-template/package.json` pins. The starter is
   not a separately versioned product; it is the template for exactly one framework release.
2. **Every nuxt-extensions version gets its starter version.** Each version published to npm is
   followed by a starter release with the same number, also when the bump is the only change. The
   bump PR raises the pin in `nuxt-base-template/package.json` and the root `version` together;
   `scripts/starter-version.test.mjs` (part of `check`) fails when they differ. After the squash
   merge the release commit `chore(release): X.Y.Z` adds the changelog section with the commit
   links, and the tag `vX.Y.Z` follows; `.github/workflows/release.yml` turns the lines that commit
   adds to `CHANGELOG.md` into the GitHub release.
3. **Nothing else changes the version.** Starter-only changes between two nuxt-extensions releases
   are merged to `main` with a normal conventional commit and leave `version` as it is: no patch
   bump, no starter-only release, no tag. `lt fullstack init` clones `main`, so new projects get
   them at once; they appear in the changelog section of the next release, which lists every
   commit since the previous tag.

The schema itself is nuxt-extensions': **MAJOR** = the Nuxt major, **MINOR** = a change a project has
to migrate, **PATCH** = taken over as is. A breaking change is therefore a MINOR, never a MAJOR.

The switch skips numbers. nuxt-extensions goes from 1.28.0 to 4.0.0 (Nuxt 4); 2.x and 3.x do not
exist. The starter follows from 2.38.5 to 4.0.0; there is no starter 3.x.

Migration guides keep the starter version in their name (`migration-guides/<version>-<topic>.md`;
the jump is `2.38.x-to-4.0.0.md`). A guide for a starter-only change is written with that change
and renamed to the version it ships in by the release commit, together with the changelog link.

This rule does not apply to projects generated from the starter: they carry their own version and
upgrade nuxt-extensions on their own.
