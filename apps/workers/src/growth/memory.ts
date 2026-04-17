import { createChildLogger } from '@clude/shared/core/logger';
import { storeMemory, recallMemories, type Memory, type MemoryType } from '@clude/brain/memory';
import type { RoleName } from './types';
import { memorySource } from './types';

const log = createChildLogger('growth-memory');

export async function storeRoleMemory(
  role: RoleName,
  opts: {
    content: string;
    summary: string;
    type?: MemoryType;
    importance?: number;
    tags?: string[];
  }
): Promise<number | null> {
  try {
    return await storeMemory({
      type: opts.type || 'episodic',
      content: opts.content,
      summary: opts.summary,
      importance: opts.importance ?? 0.5,
      tags: ['growth', `role:${role}`, ...(opts.tags || [])],
      source: memorySource(role),
    });
  } catch (err) {
    log.error({ err, role }, 'Failed to store role memory');
    return null;
  }
}

export async function recallRoleMemories(
  role: RoleName,
  query: string,
  opts: { limit?: number; includeOtherRoles?: boolean } = {}
): Promise<Memory[]> {
  const tags = opts.includeOtherRoles ? ['growth'] : ['growth', `role:${role}`];
  try {
    return await recallMemories({
      query,
      tags,
      limit: opts.limit ?? 10,
    });
  } catch (err) {
    log.error({ err, role }, 'Failed to recall role memories');
    return [];
  }
}
