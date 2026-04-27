// MemoryPack v0.1 — Portable Agent Memory Format
//
// On-disk shapes defined in the spec. Forward-compatible: readers
// MUST ignore unknown fields. Producers MAY add x-vendor-name kinds
// and metadata keys prefixed `mp:` for vendor extensions.

export const MEMORYPACK_VERSION = '0.1';

/**
 * The on-chain memo format the spec defines for `anchor_format: memo-v1`.
 * Readers seeing this prefix on a Solana memo can interpret the rest
 * as a sha256-prefixed record hash.
 */
export const MEMO_V1_PREFIX = 'clude:v1:';

/**
 * manifest.json — top-level descriptor for a pack.
 */
export interface MemoryPackManifest {
  memorypack_version: string;
  producer: {
    name: string;
    version: string;
    agent_id?: string;
    did?: string;
    public_key?: string; // base58
  };
  created_at: string; // RFC3339
  record_count: number;
  record_schema: string;
  signature_algorithm?: 'ed25519';
  anchor_chain?: string;
}

/**
 * One record in records.jsonl. Required keys: id, created_at, kind,
 * content, tags, importance, source. Everything else is optional.
 */
export interface MemoryPackRecord {
  id: string;
  created_at: string;
  kind: 'episodic' | 'semantic' | 'procedural' | 'relational' | string;
  content: string;
  tags: string[];
  importance: number;
  source: string;

  summary?: string;
  embedding?: number[];
  embedding_model?: string;
  metadata?: Record<string, unknown>;
  access_count?: number;
  last_accessed_at?: string;
  parent_ids?: string[];
  compacted_from?: string[];
  blob_ref?: string;
}

/**
 * One detached signature in signatures.jsonl, keyed by record hash.
 */
export interface MemoryPackSignature {
  record_hash: string;          // sha256:<hex>
  signature: string;            // base58 ed25519
  algorithm: 'ed25519';
  public_key: string;           // base58
}

/**
 * One on-chain proof in anchors.jsonl.
 */
export interface MemoryPackAnchor {
  record_hash: string;
  chain: string;                // e.g. "solana-mainnet"
  tx: string;                   // tx signature
  slot?: number;
  anchor_format: 'memo-v1';
}
