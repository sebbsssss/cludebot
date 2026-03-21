export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'self_model';
export type ModelTier = 'free' | 'pro';
export type ModelPrivacy = 'private' | 'anonymized';

export interface ChatModel {
  id: string;
  name: string;
  privacy: ModelPrivacy;
  context: number;
  default?: boolean;
  tier: ModelTier;
  cost: { input: number; output: number };
}

export interface Conversation {
  id: string;
  owner_wallet: string;
  title: string | null;
  model: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  memory_ids?: number[];
  created_at: string;
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  avgDecay: number;
  topTags: Array<{ tag: string; count: number }>;
}

export interface MemorySummary {
  id: number;
  memory_type: MemoryType;
  summary: string;
  importance: number;
  created_at: string;
}

// Compound prediction market types
export type MarketSource = 'polymarket' | 'manifold';
export type MarketCategory = 'politics' | 'crypto' | 'sports' | 'tech' | 'science' | 'entertainment' | 'other';
export type MarketSortKey = 'edge' | 'confidence' | 'closeDate' | 'volume';

/** Market with Compound analysis (source=memory) */
export interface CompoundPrediction {
  memoryId: number;
  question: string;
  source: MarketSource;
  sourceId: string;
  marketOdds: number;
  estimatedProbability: number;
  confidence: number;
  edge: number;
  isValue: boolean;
  category: MarketCategory;
  marketUrl: string;
  closeDate: string;
  analyzedAt: string;
}

/** Raw live market without analysis (source=live) */
export interface LiveMarket {
  sourceId: string;
  source: MarketSource;
  question: string;
  currentOdds: number;
  volume: number;
  liquidity: number;
  closeDate: string;
  category: MarketCategory;
  active: boolean;
  url: string;
}

export type CompoundMarket = CompoundPrediction | LiveMarket;

export function isPrediction(m: CompoundMarket): m is CompoundPrediction {
  return 'estimatedProbability' in m;
}

export interface CompoundMarketsResponse {
  markets: CompoundMarket[];
  count: number;
  source: 'memory' | 'live';
  timestamp: string;
}

export interface AccuracyByCategory {
  count: number;
  correct: number;
  avgBrier: number;
}

export interface CompoundAccuracy {
  totalPredictions: number;
  totalResolved: number;
  correctCount: number;
  accuracy: number;
  avgBrierScore: number;
  byCategory: Record<string, AccuracyByCategory>;
  engineRunning: boolean;
  timestamp: string;
}

export interface TimelinePeriod {
  period: string;
  predictions: number;
  resolved: number;
  correct: number;
  accuracy: number | null;
  avgBrierScore: number | null;
  cumulativeAccuracy: number | null;
  cumulativeAvgBrier: number | null;
}

export interface CompoundTimeline {
  timeline: TimelinePeriod[];
  interval: string;
  totalPredictions: number;
  totalResolved: number;
  from: string | null;
  to: string | null;
  timestamp: string;
}

export interface GuestResponse {
  content: string;
  done: boolean;
  model: string;
  guest: boolean;
  remaining?: number;
}

export interface AuthDoneEvent {
  done: true;
  message_id: string;
  model: string;
  memories_used: number;
  memory_ids: number[];
}
