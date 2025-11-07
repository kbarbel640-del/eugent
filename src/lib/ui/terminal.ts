/**
 * Terminal UI utilities
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../../../package.json');

/**
 * Clear terminal and print logo with header
 */
export function clearAndPrintHeader(model?: string): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1Bc');
    process.stdout.write('\x1B[?25l'); // Hide cursor after clear
  }

  console.log('');
  console.log('  \x1b[1m\x1b[33m░█▀▀░█░█░█▀▀░█▀▀░█▀█░▀█▀\x1b[0m');
  console.log('  \x1b[1m\x1b[33m░█▀▀░█░█░█░█░█▀▀░█░█░░█░\x1b[0m');
  console.log('  \x1b[1m\x1b[33m░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░░▀░\x1b[0m');
  console.log(`  \x1b[2mv${packageJson.version}\x1b[0m`);
  console.log('  \x1b[2mvibe coding cli powered by Mistral API\x1b[0m');
  console.log(`  \x1b[2mmodel: ${model || 'devstral-medium-2507'}\x1b[0m`);
  console.log('');
}

/**
 * Print just the logo and version (for startup)
 */
export function printLogo(): void {
  console.log('');
  console.log('  \x1b[1m\x1b[33m░█▀▀░█░█░█▀▀░█▀▀░█▀█░▀█▀\x1b[0m');
  console.log('  \x1b[1m\x1b[33m░█▀▀░█░█░█░█░█▀▀░█░█░░█░\x1b[0m');
  console.log('  \x1b[1m\x1b[33m░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░░▀░\x1b[0m');
  console.log(`  \x1b[2mv${packageJson.version}\x1b[0m`);
}
