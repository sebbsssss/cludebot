import { ethers } from 'ethers';
import { config } from '../config';
import { createChildLogger } from './logger';
import { getProvider } from './base-client';
import { BASESCAN_API_BASE_URL, ERC20_BALANCE_ABI } from '../utils/constants';
import type { BasescanTxResponse } from '../types/api';

const log = createChildLogger('base-rpc-client');

export interface WalletTransaction {
  hash: string;
  timestamp: number;
  type: string;
  from: string;
  to: string;
  value: string;
  gasUsed: number;
}

export interface TokenBalance {
  contractAddress: string;
  amount: number;
  decimals: number;
}

export async function getWalletHistory(address: string, limit = 50): Promise<WalletTransaction[]> {
  log.debug({ address, limit }, 'Fetching wallet history');
  try {
    if (!config.base.basescanApiKey) {
      log.warn('No Basescan API key configured, cannot fetch wallet history');
      return [];
    }

    const url = `${BASESCAN_API_BASE_URL}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=${limit}&apikey=${config.base.basescanApiKey}`;
    const res = await fetch(url);
    const data = await res.json() as BasescanTxResponse;

    if (data.status !== '1' || !Array.isArray(data.result)) {
      log.debug({ message: data.message }, 'No transactions found');
      return [];
    }

    return data.result.map(tx => ({
      hash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      type: inferTxType(tx.methodId, tx.input),
      from: tx.from,
      to: tx.to,
      value: tx.value,
      gasUsed: parseInt(tx.gasUsed),
    }));
  } catch (err) {
    log.error({ address, err }, 'Failed to fetch wallet history');
    return [];
  }
}

function inferTxType(methodId: string, input: string): string {
  if (input === '0x' || input === '0x00') return 'TRANSFER';
  // Common DEX router method IDs
  if (methodId === '0x38ed1739' || methodId === '0x7ff36ab5' || methodId === '0x18cbafe5') return 'SWAP';
  if (methodId === '0xa9059cbb') return 'TOKEN_TRANSFER';
  return 'CONTRACT_CALL';
}

export async function getTokenBalances(address: string): Promise<TokenBalance[]> {
  log.debug({ address }, 'Fetching token balances');
  try {
    if (!config.base.basescanApiKey) return [];

    // Use Basescan token transfer list to discover held tokens, then query balances
    const url = `${BASESCAN_API_BASE_URL}?module=account&action=tokentx&address=${address}&sort=desc&page=1&offset=100&apikey=${config.base.basescanApiKey}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string; result: Array<{ contractAddress: string; tokenDecimal: string }> };

    if (data.status !== '1' || !Array.isArray(data.result)) return [];

    // Deduplicate token contracts
    const contracts = [...new Set(data.result.map(tx => tx.contractAddress))];
    const provider = getProvider();
    const balances: TokenBalance[] = [];

    for (const contractAddr of contracts.slice(0, 20)) { // limit to 20 tokens
      try {
        const contract = new ethers.Contract(contractAddr, ERC20_BALANCE_ABI, provider);
        const [rawBalance, decimals] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals(),
        ]);
        const amount = Number(ethers.formatUnits(rawBalance, decimals));
        if (amount > 0) {
          balances.push({ contractAddress: contractAddr, amount, decimals: Number(decimals) });
        }
      } catch {
        // Skip tokens that fail (burned contracts, etc.)
      }
    }

    return balances;
  } catch (err) {
    log.error({ address, err }, 'Failed to fetch token balances');
    return [];
  }
}

export async function getCludeBalance(address: string): Promise<number> {
  if (!config.base.cludeTokenAddress) return 0;
  try {
    const provider = getProvider();
    const contract = new ethers.Contract(config.base.cludeTokenAddress, ERC20_BALANCE_ABI, provider);
    const [rawBalance, decimals] = await Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
    ]);
    return Number(ethers.formatUnits(rawBalance, decimals));
  } catch (err) {
    log.error({ address, err }, 'Failed to fetch CLUDE balance');
    return 0;
  }
}
