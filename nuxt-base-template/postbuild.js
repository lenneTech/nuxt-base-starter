import { execSync } from 'child_process';
import * as path from 'path';

const tslibPath = path.resolve('.output', 'server', 'node_modules', 'tslib');

async function runPostinstall() {
  const { default: config } = await import('./nuxt.config.ts');

  if (!config.ssr) {
    console.debug('⚠️ SSR is disabled, skipping postinstall script.');
    process.exit(0);
  }

  try {
    process.chdir(tslibPath);
    const command = 'npm pkg set \'exports[.].import.node\'=\'./tslib.es6.mjs\'';
    execSync(command, { stdio: 'inherit' });
    console.debug('✅ Successfully ran postinstall script');
  } catch (error) {
    console.error('❌ Error executing postinstall script:', error);
    process.exit(1);
  }
  
}

runPostinstall();
