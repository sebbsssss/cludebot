// Streaming reader for MemoryPack v0.2.
//
// readMemoryPack loads everything into memory — fine for typical packs,
// fails on multi-hundred-MB archives. streamMemoryPack yields records
// one at a time via an async iterator so callers can process arbitrary
// pack sizes with bounded memory.
//
// What's eager (small files, parsed up front):
//   - manifest.json
//   - signatures.jsonl  (verified up front, kept as Map<hash → signature>)
//   - anchors.jsonl
//
// What's streamed:
//   - records.jsonl      (line-by-line via readline)
//
// What's NOT done in this pass (deferred to v0.3):
//   - Streaming tar extraction. Tarballs are extracted to a temp dir
//     first, then records.jsonl is streamed from the extracted file.
//     A true streaming-from-tar reader (pipe through `tar -xO`) is
//     more complex and not worth shipping until someone hits the
//     extracted-disk-space limit.
//   - Lazy blob resolution. Blobs are NOT loaded by this reader.
//     Callers that want to verify blobs alongside records should use
//     readMemoryPack instead.
//
// Signature semantics match readMemoryPack:
//   - If signatures.jsonl is present, EVERY record must have a
//     matching valid signature. The first record without one throws.
//   - If absent, no verification happens. Pass strictSignatures: true
//     to fail-fast on the first record.
//
// Resource cleanup:
//   - The async iterator owns a finally block that removes any
//     extracted tarball temp dir AFTER iteration completes (success
//     or throw). Callers that abandon the iterator mid-flight will
//     leak the temp dir until process exit — acceptable for a v0.2
//     primitive.

import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import { spawnSync } from 'child_process';
import { createInterface } from 'readline';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  MemoryPackAnchor,
  MemoryPackManifest,
  MemoryPackRecord,
  MemoryPackSignature,
} from './types.js';
import {
  ENCRYPTION_KEY_BYTES,
  decryptString,
  hashRecordLine,
  verifyHash,
} from './sign.js';

export interface StreamReaderOptions {
  /** Override the public key used for signature verification. */
  publicKey?: string;
  /** 32-byte pack-level decryption key. */
  decryptionKey?: Uint8Array;
  /** Throw on the first unsigned record when signatures.jsonl is absent. */
  strictSignatures?: boolean;
}

/**
 * One record yielded by the streaming reader. `hash` is the canonical
 * sha256 of the source line; `verified` is true iff a signature
 * matched.
 */
export interface StreamedRecord {
  record: MemoryPackRecord;
  hash: string;
  verified: boolean;
}

export interface StreamMemoryPackResult {
  manifest: MemoryPackManifest;
  /** Eager-loaded — typically small. */
  anchors: MemoryPackAnchor[];
  /** Async iterator that yields records one at a time. */
  records: AsyncIterable<StreamedRecord>;
  /**
   * Populated as the iterator runs (record_count mismatches, etc).
   * Read AFTER iteration completes — entries pushed before that may
   * not be visible due to AsyncIterator semantics.
   */
  warnings: string[];
}

/**
 * Stream a MemoryPack record-by-record. Returns immediately with
 * manifest + anchors loaded; records are yielded by the async
 * iterator.
 *
 * Usage:
 * ```ts
 * const { manifest, records, warnings } = await streamMemoryPack(path);
 * for await (const { record, hash, verified } of records) {
 *   // process record
 * }
 * ```
 *
 * Tarballs (.tar.zst) are accepted; extraction is eager today, true
 * streaming through tar is v0.3.
 */
export async function streamMemoryPack(
  path: string,
  opts: StreamReaderOptions = {},
): Promise<StreamMemoryPackResult> {
  const isTarball = /\.tar\.zst$/i.test(path) ||
    (existsSync(path) && statSync(path).isFile());

  let dir = path;
  let cleanupDir: string | null = null;

  if (isTarball) {
    cleanupDir = mkdtempSync(join(tmpdir(), 'mp-stream-'));
    const result = spawnSync('tar', ['--zstd', '-xf', path, '-C', cleanupDir], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    if (result.status !== 0) {
      rmSync(cleanupDir, { recursive: true, force: true });
      throw new Error(
        `MemoryPack: tar --zstd extraction failed. ${(result.stderr || '').toString()}`,
      );
    }
    const entries = readdirSync(cleanupDir);
    if (entries.length !== 1) {
      rmSync(cleanupDir, { recursive: true, force: true });
      throw new Error(`MemoryPack: tarball expected single top-level dir, got ${entries.length}`);
    }
    dir = join(cleanupDir, entries[0]);
  }

  const warnings: string[] = [];

  // ── manifest (eager) ──
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
    throw new Error(`MemoryPack: manifest.json not found in ${dir}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as MemoryPackManifest;
  if (!manifest.memorypack_version) {
    if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
    throw new Error('MemoryPack: manifest missing memorypack_version');
  }
  if (!manifest.memorypack_version.startsWith('0.')) {
    if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
    throw new Error(
      `MemoryPack: unsupported memorypack_version ${manifest.memorypack_version} (reader supports 0.x)`,
    );
  }

  // ── signatures (eager + verified up front) ──
  const validSignatureHashes = new Set<string>();
  const sigsPath = join(dir, 'signatures.jsonl');
  const signaturesPresent = existsSync(sigsPath);
  if (signaturesPresent) {
    const pubkey = opts.publicKey ?? manifest.producer.public_key;
    if (!pubkey) {
      if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
      throw new Error('MemoryPack: signatures.jsonl present but no public_key in manifest');
    }
    const sigLines = readFileSync(sigsPath, 'utf-8').split('\n').filter((l) => l.length > 0);
    for (const line of sigLines) {
      const sig = JSON.parse(line) as MemoryPackSignature;
      const ok = verifyHash(sig.record_hash, sig.signature, pubkey);
      if (!ok) {
        if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
        throw new Error(`MemoryPack: signature verification failed for ${sig.record_hash}`);
      }
      validSignatureHashes.add(sig.record_hash);
    }
  }

  // ── anchors (eager) ──
  const anchors: MemoryPackAnchor[] = [];
  const anchorsPath = join(dir, 'anchors.jsonl');
  if (existsSync(anchorsPath)) {
    const anchorLines = readFileSync(anchorsPath, 'utf-8').split('\n').filter((l) => l.length > 0);
    for (const line of anchorLines) {
      anchors.push(JSON.parse(line) as MemoryPackAnchor);
    }
  }

  // ── records.jsonl exists check ──
  const recordsPath = join(dir, 'records.jsonl');
  if (!existsSync(recordsPath)) {
    if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
    throw new Error(`MemoryPack: records.jsonl not found in ${dir}`);
  }

  // Validate decryptionKey length once (avoid per-record overhead)
  if (opts.decryptionKey && opts.decryptionKey.length !== ENCRYPTION_KEY_BYTES) {
    if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
    throw new Error(`MemoryPack: decryptionKey must be ${ENCRYPTION_KEY_BYTES} bytes`);
  }

  // ── streaming iterator ──
  const decryptionKey = opts.decryptionKey;
  const strictSignatures = opts.strictSignatures === true;
  const expectedRecordCount = manifest.record_count;

  async function* iterate(): AsyncIterable<StreamedRecord> {
    let count = 0;
    let stream: ReturnType<typeof createReadStream> | null = null;
    try {
      stream = createReadStream(recordsPath, { encoding: 'utf-8' });
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (line.length === 0) continue;
        const hash = hashRecordLine(line);
        const record = JSON.parse(line) as MemoryPackRecord;

        let verified = false;
        if (signaturesPresent) {
          if (!validSignatureHashes.has(hash)) {
            throw new Error(
              `MemoryPack: signature verification failed — record ${hash} has no matching signature`,
            );
          }
          verified = true;
        } else if (strictSignatures) {
          throw new Error(
            'MemoryPack: strictSignatures=true but signatures.jsonl is absent',
          );
        }

        if (decryptionKey && record.encrypted && record.nonce) {
          try {
            record.content = decryptString(record.content, record.nonce, decryptionKey);
            record.encrypted = false;
            delete record.nonce;
          } catch (e: any) {
            throw new Error(`MemoryPack: decrypt failed for record ${record.id}: ${e.message}`);
          }
        }

        yield { record, hash, verified };
        count++;
      }

      if (count !== expectedRecordCount) {
        warnings.push(
          `record_count mismatch: manifest ${expectedRecordCount} vs streamed ${count}`,
        );
      }
    } finally {
      // Close the file stream eagerly — readline normally does this,
      // but if the consumer breaks out we want to release the fd.
      if (stream && !stream.destroyed) stream.destroy();
      if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
    }
  }

  return {
    manifest,
    anchors,
    records: iterate(),
    warnings,
  };
}
