import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import nacl from 'tweetnacl';
// @ts-ignore — bs58 ESM-only
import * as bs58Module from 'bs58';
const bs58: { encode: (b: Uint8Array) => string; decode: (s: string) => Uint8Array } =
  (bs58Module as any).default || bs58Module;
import {
  writeMemoryPack,
  readMemoryPack,
  serializeRecord,
  hashRecordLine,
  signHash,
  verifyHash,
  MemoryPackRecord,
} from '../index.js';

function makeRecords(): MemoryPackRecord[] {
  return [
    {
      id: '01HZRF000000000000000001',
      created_at: '2026-04-16T06:12:33Z',
      kind: 'episodic',
      content: 'User confirmed weekly newsletter cadence.',
      tags: ['preferences', 'newsletter'],
      importance: 0.72,
      source: 'chat',
    },
    {
      id: '01HZRF000000000000000002',
      created_at: '2026-04-16T06:13:00Z',
      kind: 'semantic',
      content: 'Clude signs each record with ed25519.',
      tags: ['spec'],
      importance: 0.8,
      source: 'doc',
      summary: 'ed25519 signing is mandatory for signed packs.',
    },
  ];
}

describe('@clude/memorypack round-trip', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mp-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('unsigned pack round-trips', () => {
    const records = makeRecords();
    writeMemoryPack(dir, records, { producer: { name: 'test', version: '0.1.0' }, record_schema: 'test-v1' });
    const r = readMemoryPack(dir);
    expect(r.records).toHaveLength(records.length);
    expect(r.verifiedRecords.size).toBe(0);
    expect(r.unsignedRecords.size).toBe(records.length);
  });

  it('signed pack round-trips and verifies', () => {
    const records = makeRecords();
    const kp = nacl.sign.keyPair();
    const pub = bs58.encode(kp.publicKey);
    writeMemoryPack(dir, records, {
      producer: { name: 'test', version: '0.1.0', public_key: pub },
      record_schema: 'test-v1',
      secretKey: kp.secretKey,
    });
    const r = readMemoryPack(dir);
    expect(r.verifiedRecords.size).toBe(records.length);
    expect(r.unsignedRecords.size).toBe(0);
  });

  it('tampered record rejected', () => {
    const records = makeRecords();
    const kp = nacl.sign.keyPair();
    const pub = bs58.encode(kp.publicKey);
    writeMemoryPack(dir, records, {
      producer: { name: 'test', version: '0.1.0', public_key: pub },
      record_schema: 'test-v1',
      secretKey: kp.secretKey,
    });
    const path = join(dir, 'records.jsonl');
    writeFileSync(path, readFileSync(path, 'utf-8').replace('weekly', 'daily'));
    expect(() => readMemoryPack(dir)).toThrow(/signature verification failed/i);
  });

  it('wrong public key rejected', () => {
    const records = makeRecords();
    const kp = nacl.sign.keyPair();
    writeMemoryPack(dir, records, {
      producer: { name: 'test', version: '0.1.0', public_key: bs58.encode(kp.publicKey) },
      record_schema: 'test-v1',
      secretKey: kp.secretKey,
    });
    const wrong = nacl.sign.keyPair();
    expect(() => readMemoryPack(dir, { publicKey: bs58.encode(wrong.publicKey) }))
      .toThrow(/signature verification failed/i);
  });

  it('strictSignatures rejects unsigned pack', () => {
    writeMemoryPack(dir, makeRecords(), { producer: { name: 'test', version: '0.1.0' }, record_schema: 'test-v1' });
    expect(() => readMemoryPack(dir, { strictSignatures: true })).toThrow(/unsigned/i);
  });

  it('rejects memorypack_version outside 0.x', () => {
    writeMemoryPack(dir, makeRecords(), { producer: { name: 'test', version: '0.1.0' }, record_schema: 'test-v1' });
    const path = join(dir, 'manifest.json');
    const m = JSON.parse(readFileSync(path, 'utf-8'));
    m.memorypack_version = '1.0';
    writeFileSync(path, JSON.stringify(m));
    expect(() => readMemoryPack(dir)).toThrow(/unsupported memorypack_version/i);
  });

  it('stable serialization order', () => {
    const a: MemoryPackRecord = {
      id: '1', created_at: '2026-04-16T00:00:00Z', kind: 'episodic',
      content: 'x', tags: ['t'], importance: 0.5, source: 'test', summary: 'y',
    };
    const b: MemoryPackRecord = {
      summary: 'y', source: 'test', importance: 0.5, tags: ['t'],
      content: 'x', kind: 'episodic', created_at: '2026-04-16T00:00:00Z', id: '1',
    };
    expect(serializeRecord(a)).toBe(serializeRecord(b));
  });
});

describe('sign/verify primitives', () => {
  it('hashRecordLine ignores trailing newline', () => {
    expect(hashRecordLine('x')).toBe(hashRecordLine('x\n'));
    expect(hashRecordLine('x')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('sign + verify round-trips', () => {
    const kp = nacl.sign.keyPair();
    const sig = signHash('sha256:abc', kp.secretKey);
    expect(verifyHash('sha256:abc', sig, bs58.encode(kp.publicKey))).toBe(true);
  });

  it('verify fails for wrong key', () => {
    const kp = nacl.sign.keyPair();
    const other = nacl.sign.keyPair();
    const sig = signHash('sha256:abc', kp.secretKey);
    expect(verifyHash('sha256:abc', sig, bs58.encode(other.publicKey))).toBe(false);
  });
});
