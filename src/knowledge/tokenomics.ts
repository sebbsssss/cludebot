/**
 * Clude Token ($CLUDE) Vesting & Tokenomics
 * 
 * This file contains factual information about the token
 * that the bot can reference when answering questions.
 */

export const TOKENOMICS = {
  // Total supply
  totalSupply: '1,000,000,000 CLUDE',
  
  // Vesting breakdown
  vesting: {
    totalVested: '20%',  // 200M tokens total vested
    
    // Hackathon allocation (10%)
    hackathon: {
      amount: '100,000,000 CLUDE (10%)',
      purpose: 'pump.fun hackathon',
      cliff: '3 months',
      unlockRate: 'Daily linear unlock after cliff',
      dailyUnlock: '~10M CLUDE per day',
      startDate: 'Feb 25, 2026',
    },
    
    // Community allocation (10%)  
    community: {
      amount: '100,000,000 CLUDE (10%)',
      purpose: 'Community rewards and development',
      lockPeriod: '10 days',
      unlockRate: '1% per day (10M CLUDE)',
      dailyUnlock: '~1.1M CLUDE per day',
      startDate: 'Feb 25, 2026',
    },
  },
  
  // Contract details
  contracts: {
    token: 'AWGCD...Upump',
    vestingSender: 'CA1HY...9oQZb',
    vestingRecipient: '81MVT...XiqFu',
    vestingPlatform: 'Streamflow (audited by 4 major auditors)',
    cancelable: false,
    transferable: 'Only by recipient',
  },
};

/**
 * Generate a response about vesting when asked
 */
export function getVestingInfo(): string {
  return `Token Vesting Summary:

Total vested: 20% of supply (200M CLUDE)

1. Hackathon Allocation (10% / 100M):
   - 3-month cliff, then daily linear unlock
   - ~10M CLUDE unlocks per day
   - Purpose: pump.fun hackathon commitment

2. Community Allocation (10% / 100M):
   - 10-day lock period
   - 1% (10M) unlocks per day after
   - Purpose: Community rewards

Both vesting contracts are on Streamflow (audited). Non-cancelable. Next unlock: Feb 25, 2026.

80% of supply is fully circulating.`;
}

/**
 * Check if a message is asking about vesting/tokenomics
 */
export function isVestingQuestion(text: string): boolean {
  const keywords = [
    'vesting', 'vest', 'locked', 'unlock', 'tokenomics',
    'supply', 'allocation', 'cliff', 'linear', 'circulating',
    'how much locked', 'team tokens', 'dev tokens'
  ];
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export default TOKENOMICS;
