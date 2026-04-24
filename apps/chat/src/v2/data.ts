import type { ChatModel } from '../lib/types';
import type { V2Memory, V2Model, V2Thread } from './types';

/**
 * Convert a server `ChatModel` into the shape the v2 picker consumes.
 * The design bundle shipped with invented IDs (e.g. "clude-cortex-7b");
 * we only surface what the server actually accepts on /api/chat/messages.
 */
export function toV2Model(m: ChatModel): V2Model {
  const ctxLabel =
    m.context >= 1_000_000
      ? `${Math.round(m.context / 1_000_000)}M ctx`
      : m.context >= 1_000
      ? `${Math.round(m.context / 1_000)}k ctx`
      : `${m.context} ctx`;
  const privacyLabel = m.privacy === 'private' ? 'Private' : 'Anonymized';
  const tierLabel = m.tier === 'free' ? 'Free' : 'Pro';
  return {
    id: m.id,
    name: m.name,
    sub: `${tierLabel} · ${privacyLabel} · ${ctxLabel}`,
    tag: m.tier.toUpperCase(),
    free: m.tier === 'free',
    default: m.default,
  };
}

// Fallback demo memories shown when the live recall feed is empty or loading.
export const V2_FALLBACK_MEMORIES: V2Memory[] = [
  { id: 'm001', type: 'self_model', content: 'Prefers Rust for systems code; TypeScript for product',     importance: 0.92, decay: 0.98, timestamp: '14d ago', accessed: 23 },
  { id: 'm002', type: 'self_model', content: 'Engineer at Acme Robotics, working on perception stack',     importance: 0.88, decay: 0.96, timestamp: '28d ago', accessed: 41 },
  { id: 'm003', type: 'procedural', content: 'Ships on Fridays; code review Wed afternoons',               importance: 0.71, decay: 0.89, timestamp: '6d ago',  accessed: 12 },
  { id: 'm004', type: 'semantic',   content: 'Current project uses ROS 2 Humble + Zenoh for DDS',          importance: 0.78, decay: 0.94, timestamp: '9d ago',  accessed: 8  },
  { id: 'm005', type: 'episodic',   content: 'Debugged a race condition in the lidar driver last Tuesday', importance: 0.66, decay: 0.82, timestamp: '3d ago',  accessed: 4  },
];

// Onboarding interest pills — seed semantic memories (kept for when/if we
// wire the post-register flow; unused today).
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
