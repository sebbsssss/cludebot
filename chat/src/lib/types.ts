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
