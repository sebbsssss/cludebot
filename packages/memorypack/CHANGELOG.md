# Changelog

All notable changes to `@clude/memorypack` are documented here. The package follows [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-04-28

Streaming reader for packs that don't fit in memory.

### Added

- `streamMemoryPack(path, opts)` — returns `{ manifest, anchors, records: AsyncIterable<StreamedRecord>, warnings }`.
- `StreamReaderOptions`, `StreamedRecord`, `StreamMemoryPackResult` — exported types.

### Behaviour

- Manifest, signatures, and anchors are loaded eagerly (small files). Signatures are verified up front so the call to `streamMemoryPack` can throw on tampering before the iterator yields a single record.
- Records are streamed line-by-line via Node `readline` from `records.jsonl`. Per-record cost is one `JSON.parse` + one sha256 + one signature lookup + (optionally) one xsalsa20-poly1305 decrypt.
- Tarballs (`.tar.zst`) are extracted to a temp directory first; the temp dir is cleaned up after iteration completes (success or throw).
- Memory footprint is bounded — the only state retained across the iteration is the signature map (typically < 1% of pack size) and the manifest. The 5000-record bounded-heap test caps peak heap delta under 10 MB.

### Limitations (deferred to v0.4)

- True streaming through tar (no temp-dir extraction). Today's tarball flow extracts the whole pack first.
- Lazy blob resolution. The streaming reader does not load `blobs/`. Callers that need blobs alongside records should use `readMemoryPack` instead.
- Resource leak on abandoned iterators. If a consumer breaks out of the `for await` loop without exhausting it, the temp dir for tarballs is not cleaned up until process exit. Acceptable for v0.3; v0.4 should expose a `Symbol.asyncDispose` handle.

## [0.2.0] — 2026-04-28

First standalone release. Mirrors the v0.2 reference implementation merged into the main Clude repo via PRs #103–#108.

### Added

- `writeMemoryPack` — writer with `format: 'directory' | 'tarball'`, `encryption.{key, scope}`, `blobs`, deterministic `clock` injection for test vectors.
- `readMemoryPack` — reader with auto-extract for `.tar.zst` tarballs, in-place decryption when `decryptionKey` supplied, blob-bytes-vs-index hash verification, minimal-shape projection for unknown record schemas.
- `verifyChainAnchors` — out-of-band Solana RPC helper that fetches each anchor's transaction, parses its SPL Memo, and confirms the payload matches `clude:v1:sha256:<record_hash_hex>`. Supports optional `expectedSigner` binding so a tx without the producer's wallet doesn't pass.
- `serializeRecord` — stable JSONL serialization with deterministic key order. Treat as a contract: external implementers MUST produce byte-identical output for the canonical fixture.
- `hashRecordLine`, `hashBuffer`, `signHash`, `verifyHash` — primitive surface re-exported for vendors that want to operate below the writer.
- `encryptString` / `decryptString` / `encryptBuffer` / `decryptBuffer` — xsalsa20-poly1305 helpers using NaCl secretbox.
- `randomNonce`, `ENCRYPTION_KEY_BYTES`, `ENCRYPTION_NONCE_BYTES` — constants for callers managing keys themselves.
- Reference test vectors in `src/__tests__/fixtures.ts` — deterministic seed + records + clock + `EXPECTED_RECORD_HASHES`. Use as contract tests for third-party readers.

### Notes

- This is the v0.2 spec. `0.1` packs (no `pack_format`, no encryption, no blobs index) are accepted by this reader on a best-effort basis; the file layout is forward-compatible.
- `@solana/web3.js` is an **optional** peer dependency. Install it only if you need `verifyChainAnchors()`.
- Distributed under MIT. Vendors are explicitly invited to implement this format.

### Roadmap (post-0.2)

Tracked in the main Clude repo:

- Production IPFS / Arweave content anchoring
- Multi-chain anchors (Ethereum L2 attestation, Bitcoin OP_RETURN)
- Streaming reader for packs > 100MB
- Revocations format
- Source-of-truth migration: `@clude/brain` will eventually depend on this package rather than ship its own copy.
