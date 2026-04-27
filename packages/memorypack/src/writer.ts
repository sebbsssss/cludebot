import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  MEMORYPACK_VERSION,
  MemoryPackManifest,
  MemoryPackRecord,
  MemoryPackSignature,
  MemoryPackAnchor,
} from './types.js';
import { hashRecordLine, signHash } from './sign.js';

export interface WriterOptions {
  producer: {
    name: string;
    version: string;
    agent_id?: string;
    did?: string;
    public_key?: string;
  };
  record_schema: string;
  /** If provided, each record line is signed. Without it, pack is unsigned. */
  secretKey?: Uint8Array;
  anchor_chain?: string;
}

/**
 * Serialize one record to a JSONL line with stable key order. The
 * order matters because the line bytes are what gets hashed and
 * signed — two producers emitting the same record must produce the
 * same byte sequence for the signatures to verify.
 */
export function serializeRecord(record: MemoryPackRecord): string {
  const KNOWN_ORDER: (keyof MemoryPackRecord)[] = [
    'id', 'created_at', 'kind', 'content', 'tags', 'importance', 'source',
    'summary', 'embedding', 'embedding_model', 'metadata',
    'access_count', 'last_accessed_at', 'parent_ids', 'compacted_from', 'blob_ref',
  ];
  const out: Record<string, unknown> = {};
  for (const k of KNOWN_ORDER) {
    if (record[k] !== undefined) out[k] = record[k];
  }
  const recAsUnknown = record as unknown as Record<string, unknown>;
  const unknownKeys = Object.keys(recAsUnknown).filter(
    k => !KNOWN_ORDER.includes(k as keyof MemoryPackRecord),
  );
  for (const k of unknownKeys.sort()) {
    out[k] = recAsUnknown[k];
  }
  return JSON.stringify(out);
}

/**
 * Write a MemoryPack v0.1 directory: manifest.json + records.jsonl
 * + signatures.jsonl (when secretKey supplied) + anchors.jsonl (when
 * anchors[] supplied).
 */
export function writeMemoryPack(
  dir: string,
  records: MemoryPackRecord[],
  opts: WriterOptions,
  anchors?: MemoryPackAnchor[],
): void {
  mkdirSync(dir, { recursive: true });

  const manifest: MemoryPackManifest = {
    memorypack_version: MEMORYPACK_VERSION,
    producer: opts.producer,
    created_at: new Date().toISOString(),
    record_count: records.length,
    record_schema: opts.record_schema,
    signature_algorithm: opts.secretKey ? 'ed25519' : undefined,
    anchor_chain: opts.anchor_chain,
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const recordLines: string[] = [];
  const sigs: MemoryPackSignature[] = [];
  for (const record of records) {
    const line = serializeRecord(record);
    recordLines.push(line);
    if (opts.secretKey && opts.producer.public_key) {
      const hash = hashRecordLine(line);
      sigs.push({
        record_hash: hash,
        signature: signHash(hash, opts.secretKey),
        algorithm: 'ed25519',
        public_key: opts.producer.public_key,
      });
    }
  }
  writeFileSync(join(dir, 'records.jsonl'), recordLines.join('\n') + '\n');

  if (sigs.length > 0) {
    writeFileSync(
      join(dir, 'signatures.jsonl'),
      sigs.map(s => JSON.stringify(s)).join('\n') + '\n',
    );
  }
  if (anchors && anchors.length > 0) {
    writeFileSync(
      join(dir, 'anchors.jsonl'),
      anchors.map(a => JSON.stringify(a)).join('\n') + '\n',
    );
  }
}
