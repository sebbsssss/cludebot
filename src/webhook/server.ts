import express from 'express';
import path from 'path';
import { config } from '../config';
import { handleHeliusWebhook } from './helius-handler';
import { verifyRoutes } from '../verify-app/routes';
import { getMarketSnapshot } from '../core/allium-client';
import { getMemoryStats } from '../core/memory';
import { agentRoutes } from './agent-routes';
import { getRecentActivity } from '../features/activity-stream';
import { createChildLogger } from '../core/logger';

const log = createChildLogger('server');

export function createServer(): express.Application {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), character: 'tired' });
  });

  // Helius webhook endpoint
  app.post('/webhook/helius', async (req, res) => {
    try {
      // Optional: verify webhook secret
      if (config.helius.webhookSecret) {
        const authHeader = req.headers['authorization'];
        if (authHeader !== config.helius.webhookSecret) {
          log.warn('Invalid webhook secret');
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }

      const payload = req.body;
      if (!Array.isArray(payload)) {
        res.status(400).json({ error: 'Expected array payload' });
        return;
      }

      log.info({ count: payload.length }, 'Helius webhook received');

      // Process asynchronously so we respond quickly
      handleHeliusWebhook(payload).catch(err =>
        log.error({ err }, 'Webhook processing failed')
      );

      res.status(200).json({ received: true });
    } catch (err) {
      log.error({ err }, 'Webhook handler error');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // Memory stats API (for frontend cortex visualization)
  app.get('/api/memory-stats', async (_req, res) => {
    try {
      const stats = await getMemoryStats();
      res.json(stats);
    } catch (err) {
      log.error({ err }, 'Memory stats endpoint error');
      res.status(500).json({ error: 'Failed to fetch memory stats' });
    }
  });

  // Market data API (Allium-powered)
  app.get('/api/market-data', async (_req, res) => {
    try {
      const snapshot = await getMarketSnapshot();
      res.json(snapshot);
    } catch (err) {
      log.error({ err }, 'Market data endpoint error');
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });

  // Agent API (authenticated endpoints for other AI agents)
  app.use('/api/agent', agentRoutes());

  // Activity stream (recent on-chain events)
  app.get('/api/activity', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const events = await getRecentActivity(limit);
      res.json({ events, lastUpdate: new Date().toISOString() });
    } catch (err) {
      log.error({ err }, 'Activity endpoint error');
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  // Main website + wallet verification
  // Resolve public dir relative to project root (works in both dev and prod)
  const publicDir = path.join(process.cwd(), 'src', 'verify-app', 'public');
  const distPublicDir = path.join(process.cwd(), 'dist', 'verify-app', 'public');
  app.use(express.static(publicDir));
  app.use(express.static(distPublicDir));
  app.use('/api', verifyRoutes());

  return app;
}

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = createServer();
    app.listen(config.server.port, () => {
      log.info({ port: config.server.port }, 'Server started');
      resolve();
    });
  });
}
