#!/usr/bin/env node
/**
 * Guards where CI lives in this repo — and that this repo tests itself at all.
 *
 * THE DEFECT THIS EXISTS FOR.
 * GitHub reads workflows only from `.github/workflows/` at the ROOT of a
 * repository. A workflow file anywhere else is inert: no error, no warning, no
 * run — it simply looks like CI without being CI.
 *
 * This repo is built to trip over that. `nuxt-base-template/.github/workflows/`
 * is TEMPLATE CONTENT, shipped to generated projects, and it reads exactly like
 * this repo's own pipeline. It is not. For a long time the root held only
 * `release.yml`, which turns a tag into a GitHub release and tests nothing, so
 * every release here went out untested while a full-looking CI config sat one
 * directory down.
 *
 * That is how commit 33979ce shipped: better-auth was raised to 1.7.1 in the
 * template while the API was still pinned to 1.6.26, splitting client from
 * server across every fullstack project. Nothing in this repository ran a
 * single test on it, and nothing was configured to.
 *
 * WHAT IS CHECKED
 *   1. No workflow sits in a directory where it can never run.
 *   2. The root has a workflow that actually triggers on pushes / PRs —
 *      a release-only pipeline is not self-testing.
 *   3. A behaviour stage in the template (a job with service containers, i.e.
 *      one that boots a database or an API) has a counterpart at the root.
 *      Otherwise the template ships a gate this repo never runs.
 *
 * Deliberately text-based, no YAML parser: the repo root carries four packages
 * and a guard is not worth a fifth. Every pattern below is anchored to
 * YAML-significant indentation so a mention inside a comment cannot trigger it.
 *
 * Exit code: 0 when the layout is coherent, 1 otherwise.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Directories whose `.github/` is template content on purpose.
 *
 * An entry here is a statement that the workflows below it are SHIPPED, not
 * run. Adding one silences check 1 for that path — so add it only for a
 * directory that really is a template, and expect check 3 to then demand a
 * root-level counterpart for any behaviour stage it contains.
 */
const TEMPLATE_DIRS = ['nuxt-base-template'];

/** Directories never worth walking into. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.nuxt', '.nuxt-check', '.nuxt-test', '.output', '.output-test', 'dist', 'coverage', 'test-results', 'playwright-report']);

/** Collect every `<dir>/.github/workflows` in the tree. */
function findWorkflowDirs(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);

    if (entry.name === '.github') {
      const wf = join(full, 'workflows');
      if (existsSync(wf)) out.push(wf);
      continue; // nothing else of interest inside .github
    }
    findWorkflowDirs(full, out);
  }
  return out;
}

/** The `.yml` / `.yaml` files in a workflow directory. */
function workflowFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => join(dir, f));
}

/**
 * Does this workflow run on ordinary development activity?
 *
 * A tag-triggered release pipeline is not self-testing — that distinction is
 * the whole point of check 2, so `push:` alone does not count when the only
 * thing under it is `tags:`.
 */
function runsOnDevActivity(text) {
  if (/^\s{2}pull_request:/m.test(text)) return true;
  const push = /^\s{2}push:\n((?:\s{4}.*\n)*)/m.exec(text);
  return push ? /^\s{4}branches:/m.test(push[1]) : false;
}

/** Does this workflow declare at least one job with service containers? */
function hasBehaviourStage(text) {
  return /^\s{4}services:/m.test(text);
}

const problems = [];
const rootWorkflowDir = join(ROOT, '.github', 'workflows');
const allDirs = findWorkflowDirs(ROOT);

// --- 1. Nothing may sit where it can never run -----------------------------
for (const dir of allDirs) {
  if (dir === rootWorkflowDir) continue;
  const rel = relative(ROOT, dir);
  const owner = rel.split('/')[0];
  if (TEMPLATE_DIRS.includes(owner)) continue;

  problems.push(
    `${rel} holds workflow files that GitHub will never run.\n` +
      `      Workflows are read from the repository ROOT only. This one produces no run,\n` +
      `      no warning and no error — it just looks like CI.\n` +
      `      Move it to .github/workflows/, or add "${owner}" to TEMPLATE_DIRS in this\n` +
      `      script if it is template content that ships to generated projects.`,
  );
}

// --- 2. The root must test itself, not just release ------------------------
const rootFiles = existsSync(rootWorkflowDir) ? workflowFiles(rootWorkflowDir) : [];
const rootTexts = rootFiles.map((f) => readFileSync(f, 'utf8'));
const selfTesting = rootTexts.filter(runsOnDevActivity);

if (selfTesting.length === 0) {
  problems.push(
    `the repository root has no workflow that runs on pushes or pull requests.\n` +
      `      ${rootFiles.length === 0 ? 'There are no root workflows at all.' : `Found ${rootFiles.length} root workflow(s), all release/tag-triggered.`}\n` +
      `      A release-only pipeline never tests what it releases — which is exactly how\n` +
      `      a client/server version split shipped from here untested.`,
  );
}

// --- 3. A behaviour stage in the template needs one at the root ------------
const templateBehaviourStages = [];
for (const dir of allDirs) {
  if (dir === rootWorkflowDir) continue;
  for (const file of workflowFiles(dir)) {
    if (hasBehaviourStage(readFileSync(file, 'utf8'))) templateBehaviourStages.push(relative(ROOT, file));
  }
}

if (templateBehaviourStages.length > 0 && !rootTexts.some(hasBehaviourStage)) {
  problems.push(
    `the template ships a behaviour stage the root does not run:\n` +
      templateBehaviourStages.map((f) => `        ${f}`).join('\n') +
      `\n      A job with service containers boots a database or an API — it is the only\n` +
      `      kind that can catch a contract broken on the other side of the wire. Shipping\n` +
      `      one to generated projects while this repo runs none means the repo cannot\n` +
      `      catch the very defect it hands consumers a gate for.`,
  );
}

if (problems.length > 0) {
  console.error('[ci-placement] CI is not where it can do its job:\n');
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  process.exit(1);
}

console.log(
  `[ci-placement] ok — ${rootFiles.length} root workflow(s), ${selfTesting.length} self-testing` +
    (templateBehaviourStages.length > 0 ? `, behaviour stage mirrored at the root` : ''),
);
