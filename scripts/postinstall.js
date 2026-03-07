#!/usr/bin/env node

// Postinstall: show banner, then auto-launch setup wizard.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dim = '\x1b[2m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const white = '\x1b[97m';
const gray = '\x1b[90m';

const banner = `
${dim}────────────────────────────────────────────────────${reset}

${white}        ▄▄▄   ▄     ▄   ▄ ▄▄▄   ▄▄▄${reset}
${white}       █     █     █   █ █   █ █${reset}
${white}       █     █     █   █ █   █ █▀▀${reset}
${white}       █▄▄▄  █▄▄▄  ▀▄▄▀ █▄▄▀  █▄▄▄${reset}

${dim}  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░${reset}
${dim}  ░░░░░  ${reset}${bold}persistent memory for AI agents${reset}${dim}  ░░░░░${reset}
${dim}  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░${reset}

${dim}────────────────────────────────────────────────────${reset}

  ${green}✓${reset} Installed!
`;

const fallbackHelp = `
  ${bold}To set up, run:${reset}

    ${cyan}npx clude-bot setup${reset}

  ${gray}This will register your agent, create .env, and${reset}
  ${gray}optionally install the MCP server for your IDE.${reset}

${dim}────────────────────────────────────────────────────${reset}
`;

// Write banner to /dev/tty (bypasses npm pipe suppression)
function writeTty(text) {
  try {
    fs.writeFileSync('/dev/tty', text);
    return true;
  } catch {
    try { process.stderr.write(text); return false; } catch { return false; }
  }
}

writeTty('\n' + banner);

// ─── Check if already configured ────────────────────────────
// INIT_CWD = directory where `npm install` was run (set by npm)
const userDir = process.env.INIT_CWD || process.cwd();
const envPath = path.join(userDir, '.env');
let alreadyConfigured = false;

try {
  const env = fs.readFileSync(envPath, 'utf-8');
  // Has a real API key (not the placeholder)
  if (env.includes('CORTEX_API_KEY=') && !env.includes('CORTEX_API_KEY=your-api-key')) {
    alreadyConfigured = true;
  }
} catch {
  // No .env — needs setup
}

if (alreadyConfigured) {
  writeTty(`  ${gray}Already configured — .env found with API key.${reset}\n`);
  writeTty(`  ${gray}Run ${reset}${cyan}npx clude-bot setup${reset}${gray} to reconfigure.${reset}\n\n`);
  writeTty(`${dim}────────────────────────────────────────────────────${reset}\n`);
  process.exit(0);
}

// ─── Auto-launch setup wizard ───────────────────────────────
const cliPath = path.join(__dirname, '..', 'dist', 'cli', 'index.js');

if (fs.existsSync(cliPath)) {
  try {
    // Open separate read/write fds so readline works properly
    const ttyIn = fs.openSync('/dev/tty', 'r');
    const ttyOut = fs.openSync('/dev/tty', 'w');

    writeTty(`\n  ${bold}Starting setup wizard...${reset}\n\n`);

    const result = spawnSync(process.execPath, [cliPath, 'setup'], {
      stdio: [ttyIn, ttyOut, ttyOut],
      cwd: userDir,
      env: { ...process.env, INIT_CWD: userDir },
    });

    fs.closeSync(ttyIn);
    fs.closeSync(ttyOut);

    // If setup wizard ran successfully, we're done
    if (result.status === 0) {
      process.exit(0);
    }
  } catch {
    // /dev/tty unavailable (CI, Docker, Windows) — show fallback help
  }
}

// Fallback: just show help text
writeTty(fallbackHelp + '\n');
