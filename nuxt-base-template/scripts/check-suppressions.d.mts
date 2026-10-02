/**
 * Public surface of `scripts/check-suppressions.mjs`, so the unit tests can import its helpers
 * under `strict`. Everything not declared here is internal.
 */

export type SuppressionStatus = 'fix-available' | 'fix-unpublished' | 'not-present' | 'unfixable' | 'unverified' | 'withdrawn';

export interface SuppressionResult {
  /** Why the entry got its verdict, for the report line. */
  detail: string;
  /** GHSA id as listed under `ignoreGhsas`. */
  id: string;
  status: SuppressionStatus;
}

export interface SuppressionDeps {
  fetchAdvisory: (id: string) => Promise<{ advisory: unknown; ok: true } | { ok: false; reason: string }>;
  /** Versions the lockfile resolves for a package; null when the lockfile cannot be read. */
  lockedVersions: (name: string) => string[] | null;
  /** true: published · false: the registry says it does not exist · null: could not ask. */
  npmHasVersion: (name: string, version: string) => Promise<boolean | null>;
}

/** Verdicts that make the check fail. */
export const OBSOLETE: ReadonlySet<SuppressionStatus>;
export function assessSuppression(id: string, deps: SuppressionDeps): Promise<SuppressionResult>;
export function createAdvisoryFetcher(options?: { fetchImpl?: typeof fetch; token?: string }): SuppressionDeps['fetchAdvisory'];
export function createNpmVersionProbe(options?: { fetchImpl?: typeof fetch }): SuppressionDeps['npmHasVersion'];
export function exitCodeFor(results: SuppressionResult[], context: { ci: boolean; token: boolean }): 0 | 1;
/** Nearest directory at or above `start` holding a pnpm-workspace.yaml; null when none. */
export function findWorkspaceRoot(start: string, exists?: (path: string) => boolean): string | null;
export function inVulnerableRange(version: string, range: string | null | undefined): boolean | null;
export function listSuppressions(workspaceYaml: string): string[];
export function patchedVersionOf(vulnerability: unknown): string | null;
export function resolvedVersions(lockText: string, name: string): string[];
/** Resolves to the exit code. */
export function run(options?: { cwd?: string; env?: Record<string, string | undefined>; log?: (line: string) => void }): Promise<0 | 1>;
export function summaryLine(results: SuppressionResult[]): string;
