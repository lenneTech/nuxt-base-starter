import * as path from 'path';
import { execSync } from 'child_process';
const tslibPath = path.resolve('.output', 'server', 'node_modules', 'tslib');
process.chdir(tslibPath);
const command = `npm pkg set "exports[.].import.node"="./tslib.es6.mjs"`;
try {
  execSync(command, { stdio: 'inherit' });
  console.log('✅  Successfully ran postinstall script');
} catch (error) {
  console.error('❌  Error executing postinstall script: ', error);
  process.exit(1);
}