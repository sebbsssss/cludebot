import { getDb } from '@clude/shared/core/database';
import { createChildLogger } from '@clude/shared/core/logger';
import { Role } from '../role';
import { storeRoleMemory } from '../memory';

const log = createChildLogger('growth-researcher');
const DAY_MS = 24 * 60 * 60 * 1000;
const RESEARCHER_INTERVAL_MS = parseInt(
  process.env.GROWTH_RESEARCHER_INTERVAL_MS || String(3.5 * DAY_MS),
  10
);

const SEED_CHANNELS: Array<{ name: string; kind: string; url: string; notes: string }> = [
  { name: 'mcp.so', kind: 'mcp_registry', url: 'https://mcp.so', notes: 'MCP server directory. Submission TBD.' },
  { name: 'Smithery', kind: 'mcp_registry', url: 'https://smithery.ai', notes: 'MCP installer + registry. GitHub-based submission.' },
  { name: 'Glama', kind: 'mcp_registry', url: 'https://glama.ai/mcp', notes: 'MCP server directory.' },
  { name: 'PulseMCP', kind: 'mcp_registry', url: 'https://www.pulsemcp.com', notes: 'MCP server directory.' },
  { name: 'Anthropic MCP Registry', kind: 'mcp_registry', url: 'https://github.com/modelcontextprotocol/servers', notes: 'Official MCP servers list; PR to add.' },
  { name: 'awesome-mcp-servers', kind: 'awesome_list', url: 'https://github.com/punkpeye/awesome-mcp-servers', notes: 'PR-based; community curation.' },
  { name: 'awesome-ai-agents', kind: 'awesome_list', url: 'https://github.com/e2b-dev/awesome-ai-agents', notes: 'PR-based.' },
  { name: 'Agent.ai', kind: 'agent_marketplace', url: 'https://agent.ai', notes: 'Dharmesh Shah agent marketplace.' },
  { name: 'llamahub', kind: 'integration_hub', url: 'https://llamahub.ai', notes: 'LlamaIndex integrations.' },
  { name: 'HuggingFace Spaces', kind: 'showcase', url: 'https://huggingface.co/spaces', notes: 'Demo showcase.' },
];

async function seedIfEmpty(): Promise<number> {
  const db = getDb();
  const { data: existing } = await db.from('growth_channels').select('name').limit(1);
  if (existing && existing.length > 0) return 0;

  const rows = SEED_CHANNELS.map(c => ({
    name: c.name,
    kind: c.kind,
    url: c.url,
    curation_notes: c.notes,
    status: 'discovered',
  }));

  const { error } = await db.from('growth_channels').insert(rows);
  if (error) {
    log.error({ err: error }, 'Failed to seed channels');
    return 0;
  }
  return rows.length;
}

async function tick(): Promise<void> {
  const seeded = await seedIfEmpty();
  if (seeded > 0) {
    await storeRoleMemory('researcher', {
      type: 'semantic',
      summary: `Seeded ${seeded} AI-agent-native distribution channels`,
      content: SEED_CHANNELS.map(c => `${c.name} (${c.kind}) — ${c.url}`).join('\n'),
      importance: 0.6,
      tags: ['channel-seed'],
    });
  }

  // v0 stub: discovery via LLM + web search is deferred to v0.2.
  // Flag for founder: "moltbook" — asked in office hours, not identified.
  await storeRoleMemory('researcher', {
    type: 'procedural',
    summary: 'Researcher placeholder — v0.2 will add LLM-driven discovery + moltbook resolution',
    content: [
      'Tick placeholder. When activated (v0.2):',
      '- WebSearch for new AI-agent-native directories bi-weekly',
      '- Resolve "moltbook" (founder reference from office hours) or flag unresolved',
      '- For each channel: extract submission format, curation criteria, contact',
      '- Update growth_channels rows in place; store findings as semantic memories',
    ].join('\n'),
    importance: 0.3,
    tags: ['researcher-placeholder'],
  });
}

const role = new (class extends Role {})({
  name: 'researcher',
  intervalMs: RESEARCHER_INTERVAL_MS,
  tick,
});

export function start(): void { role.start(); }
export function stop(): void { role.stop(); }
