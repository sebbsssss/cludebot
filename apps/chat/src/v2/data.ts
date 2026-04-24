import type { V2Memory, V2Model, V2Thread } from './types';

// Catalog shown in the model picker. Mirrors the design prototype until the
// server /models list is wired into the v2 surface.
export const V2_MODELS: V2Model[] = [
  { id: 'clude-cortex-7b',  name: 'clude-cortex-7b',  sub: 'Clude · Memory-augmented · 7B',       tag: 'CLUDE', oss: true,  default: true },
  { id: 'claude-opus-4.5',  name: 'claude-opus-4.5',  sub: 'Anthropic · Frontier · 200k ctx',     tag: 'FRONT', oss: false },
  { id: 'gpt-5',            name: 'gpt-5',            sub: 'OpenAI · Frontier · 256k ctx',        tag: 'FRONT', oss: false },
  { id: 'gemini-2.5-pro',   name: 'gemini-2.5-pro',   sub: 'Google · Frontier · 2M ctx',          tag: 'FRONT', oss: false },
  { id: 'llama-4-maverick', name: 'llama-4-maverick', sub: 'Meta · Open weights · 400B-MoE',      tag: 'OSS',   oss: true  },
  { id: 'qwen3-72b',        name: 'qwen3-72b',        sub: 'Alibaba · Open weights · 72B',        tag: 'OSS',   oss: true  },
  { id: 'deepseek-r2',      name: 'deepseek-r2',      sub: 'DeepSeek · Open weights · Reasoning', tag: 'OSS',   oss: true  },
  { id: 'mistral-large-3',  name: 'mistral-large-3',  sub: 'Mistral · Open weights · 123B',       tag: 'OSS',   oss: true  },
];

// Fallback demo memories shown when the live recall feed is empty or loading.
export const V2_FALLBACK_MEMORIES: V2Memory[] = [
  { id: 'm001', type: 'self_model', content: 'Prefers Rust for systems code; TypeScript for product',     importance: 0.92, decay: 0.98, timestamp: '14d ago', accessed: 23 },
  { id: 'm002', type: 'self_model', content: 'Engineer at Acme Robotics, working on perception stack',     importance: 0.88, decay: 0.96, timestamp: '28d ago', accessed: 41 },
  { id: 'm003', type: 'procedural', content: 'Ships on Fridays; code review Wed afternoons',               importance: 0.71, decay: 0.89, timestamp: '6d ago',  accessed: 12 },
  { id: 'm004', type: 'semantic',   content: 'Current project uses ROS 2 Humble + Zenoh for DDS',          importance: 0.78, decay: 0.94, timestamp: '9d ago',  accessed: 8  },
  { id: 'm005', type: 'episodic',   content: 'Debugged a race condition in the lidar driver last Tuesday', importance: 0.66, decay: 0.82, timestamp: '3d ago',  accessed: 4  },
];

// Onboarding interest pills — seed semantic memories.
export const V2_INTERESTS = [
  'Rust', 'TypeScript', 'ROS 2', 'robotics', 'Zenoh/DDS', 'embedded',
  'React', 'agents/MCP', 'Solana', 'systems programming', 'ML research', 'product eng',
];

export const V2_THREAD_GROUPS: Array<{ id: V2Thread['group']; label: string }> = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'older',     label: 'Older' },
];
