// `clude verify <pack-dir>` — validates a MemoryPack against just a
// wallet pubkey. No Clude server, no DB, no Solana RPC required for
// the offline verification mode. Optionally fetches each anchor's
// Solana tx with --verify-chain to confirm the on-chain memo matches.
//
// This is the auditor's tool. Future regulators or third parties who
// receive a MemoryPack snapshot run this command and get a deterministic
// answer: "every record signed by <pubkey>, no tampering detected."

import { existsSync } from 'fs';
import { c, printDivider, printError, printInfo, printSuccess } from './banner';
import { readMemoryPack } from '../memorypack/index.js';

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}
function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

interface ChainResult {
  record_hash: string;
  tx: string;
  matched: boolean;
  reason?: string;
}

async function verifyChainAnchors(
  anchors: Array<{ record_hash: string; tx: string; chain: string }>,
  rpcUrl: string,
): Promise<ChainResult[]> {
  const { Connection } = require('@solana/web3.js');
  const conn = new Connection(rpcUrl, 'confirmed');
  const results: ChainResult[] = [];

  for (const a of anchors) {
    const expectedMemo = `clude:v1:${a.record_hash}`;
    try {
      const parsed = await conn.getParsedTransaction(a.tx, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!parsed) {
        results.push({ record_hash: a.record_hash, tx: a.tx, matched: false, reason: 'tx not found' });
        continue;
      }
      const all = [
        ...(parsed.transaction.message.instructions ?? []),
        ...(parsed.meta?.innerInstructions ?? []).flatMap((i: any) => i.instructions),
      ];
      let matched = false;
      for (const ix of all) {
        const ixParsed = (ix as any).parsed;
        if (ixParsed && typeof ixParsed === 'string' && ixParsed === expectedMemo) {
          matched = true; break;
        }
        // Memo program memos may also surface as raw data
        const data = (ix as any).data;
        if (typeof data === 'string' && data.includes(a.record_hash)) {
          matched = true; break;
        }
      }
      results.push({
        record_hash: a.record_hash,
        tx: a.tx,
        matched,
        reason: matched ? undefined : `memo did not contain ${expectedMemo}`,
      });
    } catch (err) {
      results.push({
        record_hash: a.record_hash,
        tx: a.tx,
        matched: false,
        reason: `rpc: ${(err as Error).message}`,
      });
    }
  }
  return results;
}

export async function runVerify(): Promise<void> {
  const args = process.argv.slice(3);

  if (flag(args, '--help') || flag(args, '-h') || args.length === 0) {
    console.log(`
  ${c.bold}Usage:${c.reset}  npx @clude/sdk verify <pack-dir> [options]

  Verifies a MemoryPack v0.1 directory: parses manifest, runs ed25519
  signature verification on every record, and (optionally) confirms
  each on-chain anchor against Solana mainnet.

  ${c.bold}Options:${c.reset}
    --pubkey <base58>      Override the public key from manifest.producer
    --strict-signatures    Reject if any record is unsigned
    --verify-chain         Fetch each anchor's Solana tx and confirm memo
    --rpc <url>            Solana RPC URL (default: mainnet-beta)
    -h, --help             Show this help

  ${c.bold}Examples:${c.reset}
    ${c.cyan}npx @clude/sdk verify ./mypack${c.reset}
    ${c.cyan}npx @clude/sdk verify ./mypack --strict-signatures${c.reset}
    ${c.cyan}npx @clude/sdk verify ./mypack --verify-chain${c.reset}
    ${c.cyan}npx @clude/sdk verify ./mypack --pubkey 7xK3...${c.reset}

  Exit code is 0 on success, 1 on any verification failure.
`);
    return;
  }

  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir || !existsSync(dir)) {
    printError(`pack directory not found: ${dir ?? '(missing)'}`);
    process.exit(1);
  }

  const pubkey = arg(args, '--pubkey');
  const strictSignatures = flag(args, '--strict-signatures');
  const verifyChain = flag(args, '--verify-chain');
  const rpcUrl = arg(args, '--rpc') ?? 'https://api.mainnet-beta.solana.com';

  printDivider();
  console.log(`\n  ${c.bold}MemoryPack verify${c.reset}\n`);
  printInfo(`pack: ${dir}`);
  if (pubkey) printInfo(`pubkey override: ${pubkey}`);
  if (strictSignatures) printInfo('strict-signatures: every record must be signed');
  if (verifyChain) printInfo(`verify-chain: ${rpcUrl}`);
  console.log('');

  let result;
  try {
    result = readMemoryPack(dir, { publicKey: pubkey, strictSignatures });
  } catch (err) {
    printError(`signature/format check failed: ${(err as Error).message}`);
    process.exit(1);
  }

  printSuccess(`Format ok — ${result.records.length} records, manifest v${result.manifest.memorypack_version}`);
  printInfo(`producer: ${result.manifest.producer.name} v${result.manifest.producer.version}`);
  if (result.manifest.producer.public_key) {
    printInfo(`public key: ${result.manifest.producer.public_key}`);
  }

  if (result.verifiedRecords.size > 0) {
    printSuccess(`Verified ${result.verifiedRecords.size}/${result.records.length} record signatures`);
  }
  if (result.unsignedRecords.size > 0) {
    printInfo(`Unsigned: ${result.unsignedRecords.size} records (no signatures.jsonl)`);
  }
  for (const w of result.warnings) printInfo(`warning: ${w}`);

  let chainFailures = 0;
  if (verifyChain) {
    if (result.anchors.length === 0) {
      printInfo('No anchors.jsonl present — nothing to chain-verify');
    } else {
      console.log('');
      printInfo(`Checking ${result.anchors.length} on-chain anchors via ${rpcUrl}…`);
      const checks = await verifyChainAnchors(result.anchors, rpcUrl);
      for (const c2 of checks) {
        if (c2.matched) {
          console.log(`    ${c.green ?? ''}✓${c.reset} ${c2.tx.slice(0, 12)}…  →  ${c2.record_hash.slice(0, 16)}…`);
        } else {
          chainFailures++;
          console.log(`    ${c.red ?? ''}✗${c.reset} ${c2.tx.slice(0, 12)}…  ${c2.reason}`);
        }
      }
      if (chainFailures > 0) {
        printError(`${chainFailures} anchor(s) did not match on-chain — VERIFICATION FAILED`);
      } else {
        printSuccess(`All ${checks.length} on-chain anchors confirmed`);
      }
    }
  }

  printDivider();
  console.log('');

  if (chainFailures > 0) process.exit(1);
}
