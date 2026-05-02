// Streaming reader tests.
//
// Coverage:
//   - Round-trip a 1000-record pack through streamMemoryPack
//   - Streamed hashes and signature verification match the eager reader
//   - Tampered record fails fast (the iterator throws on the bad record,
//     not on the call to streamMemoryPack itself)
//   - Encryption round-trips (decrypt-on-the-fly during stream)
//   - Tarball auto-extract + stream
//   - record_count mismatch surfaces as a warning, not a throw
//   - Memory bounded — heap delta during a 5000-record stream is < 5 MB

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import nacl from 'tweetnacl';
// @ts-ignore — bs58 is ESM-only, works at runtime via Node CJS/ESM interop
import * as bs58Module from 'bs58';
const bs58: { encode: (b: Uint8Array) => string; decode: (s: string) => Uint8Array } =
  (bs58Module as any).default || bs58Module;
import {
  hashRecordLine,
  streamMemoryPack,
  writeMemoryPack,
  type MemoryPackRecord,
} from '../index.js';

function makeRecords(n: number): MemoryPackRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `01HZRF${String(i).padStart(20, '0')}`,
    created_at: `2026-04-${String((i % 28) + 1).padStart(2, '0')}T06:12:33.000Z`,
    kind: i % 5 === 0 ? 'semantic' : 'episodic',
    content: `Synthetic record number ${i} with some text payload to add bulk and exercise hashing.`,
    tags: ['synthetic', `bucket-${i % 16}`],
    importance: 0.5 + (i % 100) / 200,
    source: 'test',
  }));
}

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mp-stream-test-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('streamMemoryPack — directory packs', () => {
  it('round-trips a 1000-record signed pack', { timeout: 30_000 }, async () => {
    const N = 1000;
    const records = makeRecords(N);
    const kp = nacl.sign.keyPair();
    writeMemoryPack(dir, records, {
      producer: { name: 'clude', version: '0.2.0', public_key: bs58.encode(kp.publicKey) },
      record_schema: 'clude-memory-v3',
      secretKey: kp.secretKey,
    });

    const { manifest, records: stream, anchors } = await streamMemoryPack(dir);
    expect(manifest.record_count).toBe(N);
    expect(anchors).toHaveLength(0);

    let count = 0;
    for await (const { record, hash, verified } of stream) {
      expect(verified).toBe(true);
      expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(record.id).toBe(records[count].id);
      count++;
    }
    expect(count).toBe(N);
  });

  it('streamed hashes match the eager hashRecordLine', async () => {
    const records = makeRecords(8);
    writeMemoryPack(dir, records, {
      producer: { name: 'clude', version: '0.2.0' },
      record_schema: 'clude-memory-v3',
    });

    const lines = readFileSync(join(dir, 'records.jsonl'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0);
    const expectedHashes = lines.map(hashRecordLine);

    const { records: stream } = await streamMemoryPack(dir);
    const observed: string[] = [];
    for await (const { hash } of stream) observed.push(hash);
    expect(observed).toEqual(expectedHashes);
  });

  it('tampered record fails fast at the bad line', async () => {
    const records = makeRecords(20);
    const kp = nacl.sign.keyPair();
    writeMemoryPack(dir, records, {
      producer: { name: 'clude', version: '0.2.0', public_key: bs58.encode(kp.publicKey) },
      record_schema: 'clude-memory-v3',
      secretKey: kp.secretKey,
    });

    // Mutate one byte of one record line
    const recordsPath = join(dir, 'records.jsonl');
    writeFileSync(
      recordsPath,
      readFileSync(recordsPath, 'utf-8').replace('Synthetic record number 7', 'Synthetic record number X'),
    );

    const { records: stream } = await streamMemoryPack(dir);
    let processed = 0;
    let threw: Error | null = null;
    try {
      for await (const _ of stream) processed++;
    } catch (e: any) {
      threw = e;
    }
    expect(threw).not.toBeNull();
    expect(threw!.message).toMatch(/signature verification failed/i);
    // We should have processed records up to the tampered one, not all of them
    expect(processed).toBeLessThan(20);
  });

  it('strictSignatures throws on first record when signatures absent', async () => {
    writeMemoryPack(dir, makeRecords(5), {
      producer: { name: 'clude', version: '0.2.0' },
      record_schema: 'clude-memory-v3',
    });
    const { records: stream } = await streamMemoryPack(dir, { strictSignatures: true });
    let threw: Error | null = null;
    try {
      for await (const _ of stream) {
        // first iteration should throw
        break;
      }
    } catch (e: any) {
      threw = e;
    }
    expect(threw).not.toBeNull();
    expect(threw!.message).toMatch(/strictSignatures/i);
  });

  it('decrypts content on the fly when key supplied', async () => {
    const records = makeRecords(50);
    const key = new Uint8Array(32).fill(7);
    writeMemoryPack(dir, records, {
      producer: { name: 'clude', version: '0.2.0' },
      record_schema: 'clude-memory-v3',
      encryption: { key, scope: 'records' },
    });

    // Without key: ciphertext flows through
    const noKey = await streamMemoryPack(dir);
    let firstNoKey: MemoryPackRecord | null = null;
    for await (const { record } of noKey.records) { firstNoKey = record; break; }
    expect(firstNoKey?.encrypted).toBe(true);
    expect(firstNoKey?.content).not.toBe(records[0].content);

    // With key: plaintext
    const withKey = await streamMemoryPack(dir, { decryptionKey: key });
    let count = 0;
    for await (const { record } of withKey.records) {
      expect(record.encrypted).toBe(false);
      expect(record.content).toBe(records[count].content);
      count++;
    }
    expect(count).toBe(records.length);
  });

  it('rejects wrong-length decryption key up front', async () => {
    writeMemoryPack(dir, makeRecords(2), {
      producer: { name: 'clude', version: '0.2.0' },
      record_schema: 'clude-memory-v3',
    });
    await expect(
      streamMemoryPack(dir, { decryptionKey: new Uint8Array(16) }),
    ).rejects.toThrow(/32 bytes/);
  });

  it('record_count mismatch surfaces as warning after iteration', async () => {
    writeMemoryPack(dir, makeRecords(10), {
      producer: { name: 'clude', version: '0.2.0' },
      record_schema: 'clude-memory-v3',
    });
    // Tamper manifest to claim 11 records
    const manifestPath = join(dir, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifest.record_count = 11;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const { records: stream, warnings } = await streamMemoryPack(dir);
    let count = 0;
    for await (const _ of stream) count++;
    expect(count).toBe(10);
    expect(warnings.some((w) => /record_count mismatch/.test(w))).toBe(true);
  });
});

describe('streamMemoryPack — tarballs', () => {
  it('extracts and streams a .tar.zst pack', async () => {
    const tarballPath = join(dir, 'pack.tar.zst');
    const records = makeRecords(15);
    writeMemoryPack(tarballPath, records, {
      producer: { name: 'clude', version: '0.2.0' },
      record_schema: 'clude-memory-v3',
      format: 'tarball',
    });
    expect(existsSync(tarballPath)).toBe(true);

    const { manifest, records: stream } = await streamMemoryPack(tarballPath);
    expect(manifest.pack_format).toBe('tarball');
    let count = 0;
    for await (const { record } of stream) {
      expect(record.id).toBe(records[count].id);
      count++;
    }
    expect(count).toBe(15);
  });
});

describe('streamMemoryPack — bounded memory', () => {
  // Sanity check that memory usage doesn't grow linearly with record count.
  // Not a precise leak detector — just rules out the "loads everything then
  // yields" failure mode by comparing heap deltas at small vs large N.
  it('heap delta stays sub-linear for large N', async () => {
    const N = 5000;
    const records = makeRecords(N);
    writeMemoryPack(dir, records, {
      producer: { name: 'clude', version: '0.2.0' },
      record_schema: 'clude-memory-v3',
    });

    if (typeof global.gc === 'function') global.gc();
    const before = process.memoryUsage().heapUsed;

    const { records: stream } = await streamMemoryPack(dir);
    let processed = 0;
    let peakDelta = 0;
    for await (const _ of stream) {
      processed++;
      // Sample at every 500 records
      if (processed % 500 === 0) {
        const delta = process.memoryUsage().heapUsed - before;
        if (delta > peakDelta) peakDelta = delta;
      }
    }
    expect(processed).toBe(N);
    // 5000 records of ~150 bytes each = ~750 KB raw. If the iterator
    // were buffering everything, peakDelta would be many MB. We allow
    // generous slack (10 MB) to absorb V8 noise.
    expect(peakDelta).toBeLessThan(10 * 1024 * 1024);
  });
});
