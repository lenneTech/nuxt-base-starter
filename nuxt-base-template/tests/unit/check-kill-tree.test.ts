/**
 * Guards the watchdog's tree kill on Windows.
 *
 * `killTree()` used to collect children via `pgrep` and signal them — neither exists on
 * Windows, so the watchdog ended only the shell and orphaned vitest. `killTreePlan()` is the
 * pure decision behind it; these tests check the plan only and never send a real signal.
 */
import { describe, expect, it } from 'vitest';

import { killTreePlan } from '../../scripts/check.mjs';

describe('killTreePlan', () => {
  it('force-kills the whole tree via taskkill on Windows', () => {
    expect(killTreePlan(4242, 'SIGTERM', 'win32')).toEqual({ args: ['/PID', '4242', '/T', '/F'], command: 'taskkill' });
  });

  it('ignores the signal on Windows — SIGKILL gets the same plan', () => {
    expect(killTreePlan(4242, 'SIGKILL', 'win32')).toEqual(killTreePlan(4242, 'SIGTERM', 'win32'));
  });

  it.each(['darwin', 'linux'] as const)('passes the signal through on %s', (platform) => {
    expect(killTreePlan(4242, 'SIGTERM', platform)).toEqual({ signal: 'SIGTERM' });
    expect(killTreePlan(4242, 'SIGKILL', platform)).toEqual({ signal: 'SIGKILL' });
  });
});
