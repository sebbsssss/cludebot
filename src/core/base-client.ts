import { ethers } from 'ethers';
import { config } from '../config';
import { createChildLogger } from './logger';
import { BASESCAN_TX_BASE_URL, MEMO_MAX_LENGTH } from '../utils/constants';

const log = createChildLogger('base-client');

let provider: ethers.JsonRpcProvider;
let testnetProvider: ethers.JsonRpcProvider;
let botWallet: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.base.rpcUrl);
  }
  return provider;
}

function getTestnetProvider(): ethers.JsonRpcProvider {
  if (!testnetProvider) {
    testnetProvider = new ethers.JsonRpcProvider(config.base.testnetRpcUrl);
  }
  return testnetProvider;
}

export function getBotWallet(): ethers.Wallet | null {
  if (!botWallet && config.base.botWalletPrivateKey) {
    try {
      const raw = config.base.botWalletPrivateKey.trim();
      const key = raw.startsWith('0x') ? raw : `0x${raw}`;
      botWallet = new ethers.Wallet(key, getProvider());
      log.info({ address: botWallet.address }, 'Bot wallet loaded');
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

  const truncatedMemo = memo.slice(0, MEMO_MAX_LENGTH);

  try {
    const tx = await wallet.sendTransaction({
      to: wallet.address, // self-transfer
      value: 0n,
      data: ethers.hexlify(ethers.toUtf8Bytes(truncatedMemo)),
    });

    const receipt = await tx.wait();
    const hash = receipt?.hash || tx.hash;
    log.info({ hash, memoLength: truncatedMemo.length }, 'Memo written on-chain');
    return hash;
  } catch (err) {
    log.error({ err }, 'Failed to write memo');
    return null;
  }
}

export async function writeMemoTestnet(memo: string): Promise<string | null> {
  const pk = config.base.botWalletPrivateKey.trim();
  if (!pk) {
    log.error('No bot wallet configured, cannot write testnet memo');
    return null;
  }

  const key = pk.startsWith('0x') ? pk : `0x${pk}`;
  const wallet = new ethers.Wallet(key, getTestnetProvider());
  const truncatedMemo = memo.slice(0, MEMO_MAX_LENGTH);

  try {
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0n,
      data: ethers.hexlify(ethers.toUtf8Bytes(truncatedMemo)),
    });

    const receipt = await tx.wait();
    const hash = receipt?.hash || tx.hash;
    log.info({ hash, memoLength: truncatedMemo.length }, 'Memo written on testnet');
    return hash;
  } catch (err) {
    log.error({ err }, 'Failed to write testnet memo');
    return null;
  }
}

export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function basescanTxUrl(txHash: string): string {
  return `${BASESCAN_TX_BASE_URL}/${txHash}`;
}
