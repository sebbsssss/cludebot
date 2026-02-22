/**
 * Solana client — MEMO WRITES ONLY.
 *
 * SECURITY: This module can only write memo data to Solana.
 * It has NO fund transfer, token transfer, or swap capability.
 * The bot wallet is used exclusively for signing memo transactions.
 * Any attempt to add transfer functionality should be rejected in code review.
 */

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
import { MEMO_PROGRAM_ID as MEMO_PROGRAM_ID_STRING, MEMO_MAX_LENGTH, SOLSCAN_TX_BASE_URL } from '../utils/constants';

const log = createChildLogger('solana-client');

let connection: Connection;
let botWallet: Keypair | null = null;

const MEMO_PROGRAM_ID = new PublicKey(MEMO_PROGRAM_ID_STRING);

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.solana.rpcUrl, 'confirmed');
  }
  return connection;
}

/** @internal SDK escape hatch — allows Cortex to inject Solana config. */
export function _configureSolana(rpcUrl: string, privateKey?: string): void {
  connection = new Connection(rpcUrl, 'confirmed');
  if (privateKey) {
    try {
      const raw = privateKey.trim();
      let secretKey: Uint8Array;
      if (raw.startsWith('[')) {
        secretKey = Uint8Array.from(JSON.parse(raw));
      } else {
        secretKey = bs58.decode(raw);
      }
      botWallet = Keypair.fromSecretKey(secretKey);
    } catch (err) {
      log.error({ err }, 'SDK: Failed to load bot wallet');
    }
  }
}

export function getBotWallet(): Keypair | null {
  if (!botWallet && config.solana.botWalletPrivateKey) {
    try {
      let secretKey: Uint8Array;
      const raw = config.solana.botWalletPrivateKey.trim();
      if (raw.startsWith('[')) {
        // JSON array format: [1,2,3,...]
        secretKey = Uint8Array.from(JSON.parse(raw));
      } else {
        // Base58 encoded format
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
    programId: MEMO_PROGRAM_ID,
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

let devnetConnection: Connection;

function getDevnetConnection(): Connection {
  if (!devnetConnection) {
    devnetConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
  }
  return devnetConnection;
}

export async function writeMemoDevnet(memo: string): Promise<string | null> {
  const wallet = getBotWallet();
  if (!wallet) {
    log.error('No bot wallet configured, cannot write devnet memo');
    return null;
  }

  const conn = getDevnetConnection();
  const truncatedMemo = memo.slice(0, MEMO_MAX_LENGTH);

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(truncatedMemo, 'utf-8'),
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(conn, transaction, [wallet]);
    log.info({ signature, memoLength: truncatedMemo.length }, 'Memo written on devnet');
    return signature;
  } catch (err) {
    log.error({ err }, 'Failed to write devnet memo');
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
  return `${SOLSCAN_TX_BASE_URL}/${signature}`;
}
