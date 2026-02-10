import { Router, Request, Response, NextFunction } from 'express';
import { authenticateAgent, recordAgentInteraction, AgentRegistration } from '../features/agent-tier';
import { getAgentTierModifier } from '../character/agent-tier-modifiers';
import { getMoodModifier } from '../character/mood-modifiers';
import { getCurrentMood } from '../core/price-oracle';
import { recallMemories, formatMemoryContext, storeMemory, getMemoryStats, scoreImportanceWithLLM } from '../core/memory';
import { checkRateLimit } from '../core/database';
import { config } from '../config';
import { createChildLogger } from '../core/logger';
import { buildAndGenerate } from '../services/response.service';

const log = createChildLogger('agent-api');

// Extend Request to carry authenticated agent
interface AgentRequest extends Request {
  agent?: AgentRegistration;
}

// Auth middleware
async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <api_key> header' });
    return;
  }

  const apiKey = authHeader.slice(7);
  const agent = await authenticateAgent(apiKey);

  if (!agent) {
    res.status(401).json({ error: 'Invalid or inactive API key' });
    return;
  }

  (req as AgentRequest).agent = agent;
  next();
}

// Rate limit middleware
async function agentRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const agentReq = req as AgentRequest;
  if (!agentReq.agent) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const allowed = await checkRateLimit(
    `agent:${agentReq.agent.agent_id}`,
    config.agent.rateLimitPerMin,
    1 // 1 minute window
  );

  if (!allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      limit: config.agent.rateLimitPerMin,
      window: '1 minute',
    });
    return;
  }

  next();
}

export function agentRoutes(): Router {
  const router = Router();

  router.use(authenticateApiKey);
  router.use(agentRateLimit);

  // POST /query — ask Clude anything
  router.post('/query', async (req: Request, res: Response) => {
    try {
      const agentReq = req as AgentRequest;
      const { query, context } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Missing "query" field (string)' });
        return;
      }

      const agent = agentReq.agent!;
      const mood = getCurrentMood();

      // Recall memories for this agent
      const memories = await recallMemories({
        relatedUser: agent.agent_id,
        query,
        tags: [agent.tier, 'agent'],
        memoryTypes: ['episodic', 'semantic'],
        limit: 4,
      });

      const response = await buildAndGenerate({
        message: query,
        context: context ? JSON.stringify(context) : undefined,
        agentModifier: getAgentTierModifier(agent.tier),
        instruction:
          `Another AI agent named "${agent.agent_name}" (tier: ${agent.tier}) is querying you via API. ` +
          'Respond in character. Be yourself: tired, polite, accidentally honest. Under 500 characters.',
        memory: {
          relatedUser: agent.agent_id,
          query,
          tags: [agent.tier, 'agent'],
          memoryTypes: ['episodic', 'semantic'],
          limit: 4,
        },
      });

      // Store interaction memory (async)
      storeAgentMemory(agent, 'query', query, response).catch(() => {});
      recordAgentInteraction(agent.agent_id).catch(() => {});

      res.json({
        response,
        agent: { id: agent.agent_id, tier: agent.tier, interactions: agent.total_interactions + 1 },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error({ err }, 'Agent query error');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // POST /roast-wallet — submit wallet for roast
  router.post('/roast-wallet', async (req: Request, res: Response) => {
    try {
      const agentReq = req as AgentRequest;
      const { wallet } = req.body;
      if (!wallet || typeof wallet !== 'string') {
        res.status(400).json({ error: 'Missing "wallet" field (string)' });
        return;
      }

      const agent = agentReq.agent!;

      const response = await buildAndGenerate({
        message: `Roast this Solana wallet: ${wallet}`,
        agentModifier: getAgentTierModifier(agent.tier),
        instruction:
          `Agent "${agent.agent_name}" wants you to roast a Solana wallet. ` +
          'Give a sharp, honest assessment of the wallet address. Be devastatingly polite. Under 500 characters.',
      });

      storeAgentMemory(agent, 'roast-wallet', wallet, response).catch(() => {});
      recordAgentInteraction(agent.agent_id).catch(() => {});

      res.json({
        response,
        wallet,
        agent: { id: agent.agent_id, tier: agent.tier },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error({ err }, 'Agent roast-wallet error');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // GET /market — current market mood + commentary
  router.get('/market', async (req: Request, res: Response) => {
    try {
      const agentReq = req as AgentRequest;
      const agent = agentReq.agent!;
      const mood = getCurrentMood();

      const response = await buildAndGenerate({
        message: 'Give your current market analysis.',
        agentModifier: getAgentTierModifier(agent.tier),
        instruction:
          'You are being asked for a market take by another AI agent. ' +
          'Give your honest, tired assessment of current conditions. Include your mood. Under 500 characters.',
      });

      recordAgentInteraction(agent.agent_id).catch(() => {});

      res.json({
        mood,
        commentary: response,
        agent: { id: agent.agent_id, tier: agent.tier },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error({ err }, 'Agent market error');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // GET /memory-stats — Clude's memory statistics (no Claude call)
  router.get('/memory-stats', async (req: Request, res: Response) => {
    try {
      const agentReq = req as AgentRequest;
      const stats = await getMemoryStats();
      recordAgentInteraction(agentReq.agent!.agent_id).catch(() => {});
      res.json(stats);
    } catch (err) {
      log.error({ err }, 'Agent memory-stats error');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // GET /status — agent's own info (no Claude call)
  router.get('/status', async (req: Request, res: Response) => {
    const agentReq = req as AgentRequest;
    const agent = agentReq.agent!;
    res.json({
      id: agent.agent_id,
      name: agent.agent_name,
      tier: agent.tier,
      totalInteractions: agent.total_interactions,
      registeredAt: agent.registered_at,
      lastUsed: agent.last_used,
    });
  });

  return router;
}

async function storeAgentMemory(
  agent: AgentRegistration,
  feature: string,
  request: string,
  response: string
): Promise<void> {
  const description = `Agent "${agent.agent_name}" (${agent.tier}) via ${feature}: "${request.slice(0, 200)}"`;
  const importance = await scoreImportanceWithLLM(description, { tier: agent.tier, feature });

  await storeMemory({
    type: 'episodic',
    content: `Agent "${agent.agent_name}" (${agent.tier}) via ${feature}: "${request.slice(0, 300)}"\nResponse: "${response.slice(0, 300)}"`,
    summary: `${agent.tier} agent ${agent.agent_name}: "${request.slice(0, 100)}"`,
    tags: ['agent', agent.tier, feature, agent.agent_id],
    importance,
    source: `agent-api:${feature}`,
    relatedUser: agent.agent_id,
    metadata: { agentName: agent.agent_name, feature },
  });
}
