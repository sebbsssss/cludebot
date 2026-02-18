#!/usr/bin/env node

const command = process.argv[2];

if (command === 'init') {
  const { runInit } = require('./init');
  runInit().catch((err: Error) => {
    console.error('Init failed:', err.message);
    process.exit(1);
  });
} else if (command === 'help' || command === '--help' || command === '-h') {
  const { printBanner, c } = require('./banner');
  printBanner();
  console.log(`  ${c.bold}Usage:${c.reset}\n`);
  console.log(`    ${c.cyan}npx clude-bot init${c.reset}      Set up Supabase, API keys, and schema`);
  console.log(`    ${c.cyan}npx clude-bot help${c.reset}      Show this help message`);
  console.log(`    ${c.cyan}npx clude-bot${c.reset}           Start the Clude bot (requires full config)\n`);
  console.log(`  ${c.bold}As a library:${c.reset}\n`);
  console.log(`    ${c.dim}const { Cortex } = require('clude-bot');${c.reset}`);
  console.log(`    ${c.dim}const brain = new Cortex({ supabase: { url, serviceKey } });${c.reset}`);
  console.log(`    ${c.dim}await brain.init();${c.reset}\n`);
  console.log(`  ${c.dim}Docs: https://github.com/sebbsssss/cludebot${c.reset}\n`);
} else if (command === 'version' || command === '--version' || command === '-v') {
  const pkg = require('../../package.json');
  console.log(pkg.version);
} else {
  // No subcommand or unknown — run the bot
  require('../index');
}
