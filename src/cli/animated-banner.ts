/**
 * Animated CLI banner for Clude
 * Inspired by GitHub Copilot CLI's ASCII animation
 * Brain on the left with color gradients, CLUDE text with shadow
 */

const ESC = '\x1b';
const reset = `${ESC}[0m`;
const bold = `${ESC}[1m`;
const dim = `${ESC}[2m`;
const italic = `${ESC}[3m`;

// Colors
const white = `${ESC}[97m`;
const gray = `${ESC}[90m`;
const darkGray = `${ESC}[38;5;240m`;

// Brain gradient colors (blue/cyan/magenta spectrum)
const brainColors = {
  outer: `${ESC}[38;5;63m`,    // soft blue
  mid: `${ESC}[38;5;33m`,      // bright blue  
  inner: `${ESC}[38;5;39m`,    // cyan blue
  core: `${ESC}[38;5;75m`,     // light cyan
  pulse: `${ESC}[38;5;117m`,   // bright cyan
  spark: `${ESC}[38;5;213m`,   // pink/magenta for synapses
};

// Shadow color for text
const shadow = `${ESC}[38;5;236m`; // very dark gray
const textMain = `${ESC}[38;5;255m`; // bright white
const textAccent = `${ESC}[38;5;75m`; // cyan accent
const tagline = `${ESC}[38;5;246m`; // medium gray

// Cursor control
const hideCursor = `${ESC}[?25l`;
const showCursor = `${ESC}[?25h`;
const clearLine = `${ESC}[2K`;
const cursorUp = (n: number) => `${ESC}[${n}A`;
const cursorTo = (col: number) => `${ESC}[${col}G`;

// ── Brain frames ─────────────────────────────────────────────────────

const brainFrames = [
  // Frame 0: empty
  [
    '              ',
    '              ',
    '              ',
    '              ',
    '              ',
    '              ',
    '              ',
    '              ',
    '              ',
  ],
  // Frame 1: outline appears
  [
    '     ╭───╮    ',
    '   ╭─┤   ├─╮  ',
    '  ╭┤ │   │ ├╮ ',
    '  │╰─┤   ├─╯│ ',
    '  │  ╰───╯  │ ',
    '  ╰─╮     ╭─╯ ',
    '    ╰─┬─┬─╯   ',
    '      │ │     ',
    '      ╰─╯     ',
  ],
  // Frame 2: inner structure
  [
    '     ╭───╮    ',
    '   ╭─┤ · ├─╮  ',
    '  ╭┤ │╱ ╲│ ├╮ ',
    '  │╰─┤ · ├─╯│ ',
    '  │  ╰─┼─╯  │ ',
    '  ╰─╮  │  ╭─╯ ',
    '    ╰─┬─┬─╯   ',
    '      │ │     ',
    '      ╰─╯     ',
  ],
  // Frame 3: synapses firing
  [
    '     ╭───╮    ',
    '   ╭─┤ ∗ ├─╮  ',
    '  ╭┤ │╱·╲│ ├╮ ',
    '  │╰─┤·∗·├─╯│ ',
    '  │  ╰─┼─╯  │ ',
    '  ╰─╮ ·│· ╭─╯ ',
    '    ╰─┬─┬─╯   ',
    '      │·│     ',
    '      ╰─╯     ',
  ],
  // Frame 4: full pulse
  [
    '     ╭───╮    ',
    '   ╭─┤ ◆ ├─╮  ',
    '  ╭┤·│╱◆╲│·├╮ ',
    '  │╰─┤◆·◆├─╯│ ',
    '  │ ·╰─┼─╯· │ ',
    '  ╰─╮·◆│◆·╭─╯ ',
    '    ╰─┬─┬─╯   ',
    '      │◆│     ',
    '      ╰─╯     ',
  ],
];

// ── CLUDE text (block letters) ───────────────────────────────────────

const cludeTextShadow = [
  '  ▄▄▄  █     █   █ █▄▄▀ █▄▄▄ ',
  ' █     █     █   █ █  █ █    ',
  ' █     █     █   █ █  █ █▀▀  ',
  ' █     █     █   █ █  █ █    ',
  '  ▀▀▀  ▀▀▀▀  ▀▀▀  ▀▀▀  ▀▀▀▀ ',
];

const cludeText = [
  '  ▄▄▄  █     █   █ █▄▄▀ █▄▄▄',
  ' █     █     █   █ █  █ █   ',
  ' █     █     █   █ █  █ █▀▀ ',
  ' █     █     █   █ █  █ █   ',
  '  ▀▀▀  ▀▀▀▀  ▀▀▀  ▀▀▀  ▀▀▀▀',
];

// ── Colorize brain frame ─────────────────────────────────────────────

function colorizeBrain(frame: string[], pulse: number): string[] {
  return frame.map((line, row) => {
    let colored = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === ' ') {
        colored += ch;
      } else if (ch === '◆' || ch === '∗') {
        // Synapse points - sparkle
        colored += (pulse % 2 === 0 ? brainColors.spark : brainColors.pulse) + ch + reset;
      } else if (ch === '·') {
        colored += brainColors.pulse + ch + reset;
      } else if (row <= 1 || row >= 7) {
        colored += brainColors.outer + ch + reset;
      } else if (row === 2 || row === 6) {
        colored += brainColors.mid + ch + reset;
      } else if (row === 3 || row === 5) {
        colored += brainColors.inner + ch + reset;
      } else {
        colored += brainColors.core + ch + reset;
      }
    }
    return colored;
  });
}

// ── Animation ────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function writeFrame(lines: string[]): void {
  for (const line of lines) {
    process.stdout.write(line + '\n');
  }
}

function overwriteFrame(lines: string[], height: number): void {
  process.stdout.write(cursorUp(height));
  for (const line of lines) {
    process.stdout.write(clearLine + line + '\n');
  }
}

export async function printAnimatedBanner(): Promise<void> {
  // Check if animation should be skipped
  if (process.env.NO_ANIMATION === 'true' || !process.stdout.isTTY) {
    printStaticBanner();
    return;
  }

  const totalHeight = 13; // total lines we'll use
  process.stdout.write(hideCursor);

  try {
    // Phase 1: Brain builds up (frames 0-4)
    for (let f = 0; f <= 4; f++) {
      const brain = colorizeBrain(brainFrames[f], f);
      const lines: string[] = [''];
      
      for (let row = 0; row < 9; row++) {
        const brainLine = brain[row] || '              ';
        
        // Text appears from frame 2 onwards
        let textLine = '';
        if (f >= 2 && row >= 1 && row <= 5) {
          const textRow = row - 1;
          if (textRow < cludeText.length) {
            // Shadow first, then text on top
            textLine = `  ${shadow}${cludeTextShadow[textRow]}${reset}`;
            // Overwrite with main text (shifted 1 char left)
            textLine = `  ${shadow}${cludeTextShadow[textRow].slice(-1)}${reset}${textMain}${bold}${cludeText[textRow]}${reset}`;
          }
        }
        
        lines.push(`  ${brainLine}${textLine}`);
      }

      // Tagline appears from frame 3
      lines.push('');
      if (f >= 3) {
        const tag = 'persistent memory for AI agents';
        const shown = f >= 4 ? tag : tag.slice(0, Math.floor(tag.length * 0.6));
        lines.push(`  ${' '.repeat(15)}${tagline}${italic}${shown}${reset}`);
      } else {
        lines.push('');
      }
      lines.push('');

      if (f === 0) {
        writeFrame(lines);
      } else {
        overwriteFrame(lines, totalHeight);
      }

      await sleep(f === 0 ? 150 : 200);
    }

    // Phase 2: Pulse cycle (2 quick pulses)
    for (let p = 0; p < 3; p++) {
      const brain = colorizeBrain(brainFrames[p % 2 === 0 ? 4 : 3], p);
      const lines: string[] = [''];

      for (let row = 0; row < 9; row++) {
        const brainLine = brain[row];
        let textLine = '';
        if (row >= 1 && row <= 5) {
          const textRow = row - 1;
          if (textRow < cludeText.length) {
            textLine = `  ${shadow}${cludeTextShadow[textRow].slice(-1)}${reset}${textMain}${bold}${cludeText[textRow]}${reset}`;
          }
        }
        lines.push(`  ${brainLine}${textLine}`);
      }

      lines.push('');
      lines.push(`  ${' '.repeat(15)}${tagline}${italic}persistent memory for AI agents${reset}`);
      lines.push('');

      overwriteFrame(lines, totalHeight);
      await sleep(180);
    }

    // Phase 3: Settle on final frame with version
    const finalBrain = colorizeBrain(brainFrames[4], 0);
    const finalLines: string[] = [''];

    for (let row = 0; row < 9; row++) {
      const brainLine = finalBrain[row];
      let textLine = '';
      if (row >= 1 && row <= 5) {
        const textRow = row - 1;
        if (textRow < cludeText.length) {
          textLine = `  ${shadow}${cludeTextShadow[textRow].slice(-1)}${reset}${textMain}${bold}${cludeText[textRow]}${reset}`;
        }
      }
      // Version on the right of tagline row
      if (row === 7) {
        textLine = `${' '.repeat(20)}${darkGray}v${getVersion()}${reset}`;
      }
      finalLines.push(`  ${brainLine}${textLine}`);
    }

    finalLines.push('');
    finalLines.push(`  ${' '.repeat(15)}${tagline}${italic}persistent memory for AI agents${reset}`);
    finalLines.push('');

    overwriteFrame(finalLines, totalHeight);

  } finally {
    process.stdout.write(showCursor);
  }
}

// ── Static fallback ──────────────────────────────────────────────────

export function printStaticBanner(): void {
  const brain = colorizeBrain(brainFrames[4], 0);
  
  console.log('');
  for (let row = 0; row < 9; row++) {
    const brainLine = brain[row];
    let textLine = '';
    if (row >= 1 && row <= 5) {
      const textRow = row - 1;
      if (textRow < cludeText.length) {
        textLine = `  ${textMain}${bold}${cludeText[textRow]}${reset}`;
      }
    }
    if (row === 7) {
      textLine = `${' '.repeat(20)}${darkGray}v${getVersion()}${reset}`;
    }
    console.log(`  ${brainLine}${textLine}`);
  }
  console.log('');
  console.log(`  ${' '.repeat(15)}${tagline}${italic}persistent memory for AI agents${reset}`);
  console.log('');
}

function getVersion(): string {
  try {
    return require('../../package.json').version;
  } catch {
    return '0.0.0';
  }
}
