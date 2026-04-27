# @clude/memorypack

Reference implementation of the [MemoryPack v0.1](https://github.com/sebbsssss/clude/blob/main/docs/memorypack.md) format — portable, signed, on-chain-anchorable agent memory.

Zero Clude dependencies. Use this if you're building a memory product
and want it to be interoperable with Clude (and any other vendor that
implements the spec).

## Install

```
npm install @clude/memorypack
```

## Quickstart

### Write a pack

```ts
import { writeMemoryPack } from '@clude/memorypack';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const kp = nacl.sign.keyPair();              // any ed25519 keypair
const records = [
  {
    id: '01HZRF...',
    created_at: new Date().toISOString(),
    kind: 'episodic',
    content: 'User prefers weekly newsletter cadence.',
    tags: ['preferences'],
    importance: 0.72,
    source: 'chat',
  },
];

writeMemoryPack('./mypack', records, {
  producer: {
    name: 'my-agent',
    version: '1.0.0',
    public_key: bs58.encode(kp.publicKey),
  },
  record_schema: 'my-agent-v1',
  secretKey: kp.secretKey,
});
```

This produces a directory:

```
./mypack/
├── manifest.json
├── records.jsonl
└── signatures.jsonl
```

### Read a pack

```ts
import { readMemoryPack } from '@clude/memorypack';

const { manifest, records, verifiedRecords } = readMemoryPack('./mypack');
console.log(`Loaded ${records.length} records from ${manifest.producer.name}`);
console.log(`Verified ${verifiedRecords.size} signatures`);
```

The reader will throw if any signature is invalid or any record is
missing one (when signatures.jsonl is present). Unsigned packs are
accepted; pass `strictSignatures: true` to reject them.

## Why a separate package?

`@clude/sdk` ships the same code, but it's bundled inside a much
larger memory product. If you're building a competing memory tool or
an auditor's verifier, you want the spec implementation in 100 KB,
not 5 MB. This package's only runtime deps are `tweetnacl` and `bs58`.

## API

| Export | Purpose |
|---|---|
| `writeMemoryPack(dir, records, opts, anchors?)` | Emit a MemoryPack v0.1 directory |
| `readMemoryPack(dir, opts?)` | Parse + validate + verify signatures |
| `serializeRecord(record)` | Stable JSONL serialization (used by writer) |
| `hashRecordLine(line)` | sha256 of a JSONL line, returns `sha256:<hex>` |
| `signHash(hash, secretKey)` | ed25519 sign a record hash |
| `verifyHash(hash, signature, publicKey)` | ed25519 verify |

## On-chain anchoring

The spec defines `anchor_format: memo-v1` for Solana memo anchors:

```
clude:v1:sha256:<hex>
```

This package writes/reads the metadata. To actually post the memo
on-chain, use `@solana/web3.js`'s memo program. The spec is
chain-agnostic at the metadata level; vendor-specific chains can use
custom `anchor_format` values.

## Spec

Full spec at https://github.com/sebbsssss/clude/blob/main/docs/memorypack.md.

PRs and issues welcome — especially from non-Clude memory systems.

## License

MIT
