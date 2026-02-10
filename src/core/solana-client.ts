import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as bs58Module from 'bs58';
const bs58 = bs58Module.default || bs58Module;
import { config } from '../config';
import { createChildLogger } from './logger';
import nacl from 'tweetnacl';
import { MEMO_PROGRAM_ID, MEMO_MAX_LENGTH } from '../utils/constants';

const log = createChildLogger('solana-client');

let connection: Connection;
let botWallet: Keypair | null = null;

const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.solana.rpcUrl, 'confirmed');
  }
  return connection;
}

export function getBotWallet(): Keypair | null {
  if (!botWallet && config.solana.botWalletPrivateKey) {
    try {
      let secretKey: Uint8Array;
      const raw = config.solana.botWalletPrivateKey.trim();
      if (raw.startsWith('[')) {
        secretKey = Uint8Array.from(JSON.parse(raw));
      } else {
        secretKey = bs58.decode(raw);
      }
      botWallet = Keypair.fromSecretKey(secretKey);
      log.info({ publicKey: botWallet.publicKey.toBase58() }, 'Bot wallet loaded');
    } catch (err) {
      log.error({ err }, 'Failed to load bot wallet');
    }
  }
  return botWallet;
}

export async function writeMemo(memo: string): Promise<string | null> {
  const wallet = getBotWallet();
  if (!wallet) {
    log.error('No bot wallet configured, cannot write memo');
    return null;
  }

  const conn = getConnection();
  const truncatedMemo = memo.slice(0, MEMO_MAX_LENGTH);

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
    programId: memoProgramId,
    data: Buffer.from(truncatedMemo, 'utf-8'),
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(conn, transaction, [wallet]);
    log.info({ signature, memoLength: truncatedMemo.length }, 'Memo written on-chain');
    return signature;
  } catch (err) {
    log.error({ err }, 'Failed to write memo');
    return null;
  }
}

export function verifySignature(
  message: string,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  const messageBytes = new TextEncoder().encode(message);
  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}
