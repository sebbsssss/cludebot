/**
 * Tests for the Clude Maison auction API.
 *
 * Routes tested:
 *   GET   /api/maison/lot/:lotNumber
 *   GET   /api/maison/lot/:lotNumber/bids
 *   POST  /api/maison/lot/:lotNumber/bid
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';

// ── Mocks (hoisted before imports) ──
vi.mock('@clude/shared/core/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { maisonRoutes } from '../maison.routes';

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/maison', maisonRoutes());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as any).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function get(path: string) {
  const res = await fetch(`${baseUrl}${path}`);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json } as any;
}

async function post(path: string, body: any) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json } as any;
}

describe('GET /api/maison/lot/:lotNumber', () => {
  it('returns the canonical lot 0047', async () => {
    const { status, json } = await get('/api/maison/lot/0047');
    expect(status).toBe(200);
    expect(json.lot.number).toBe('LOT 0047');
    expect(json.lot.title).toBe('truth_terminal');
    expect(json.lot.recentBids.length).toBeGreaterThan(0);
  });

  it('404s for an unknown lot', async () => {
    const { status, json } = await get('/api/maison/lot/9999');
    expect(status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });
});

describe('GET /api/maison/lot/:lotNumber/bids', () => {
  it('returns just the live state', async () => {
    const { status, json } = await get('/api/maison/lot/0047/bids');
    expect(status).toBe(200);
    expect(typeof json.currentBid).toBe('number');
    expect(typeof json.bidCount).toBe('number');
    expect(Array.isArray(json.recentBids)).toBe(true);
  });
});

describe('POST /api/maison/lot/:lotNumber/bid', () => {
  it('rejects bids below current + increment', async () => {
    const lot = (await get('/api/maison/lot/0047')).json.lot;
    const tooLow = lot.currentBid; // exactly current — under increment
    const { status, json } = await post('/api/maison/lot/0047/bid', {
      amount: tooLow,
      paddle: '0817',
    });
    expect(status).toBe(409);
    expect(json.error).toMatch(/too low/i);
    expect(json.minRequired).toBe(lot.currentBid + lot.bidIncrement);
  });

  it('rejects malformed payload', async () => {
    const { status } = await post('/api/maison/lot/0047/bid', {
      amount: 'not-a-number',
      paddle: '0817',
    });
    expect(status).toBe(400);
  });

  it('records a valid bid and updates currentBid + recentBids + topBidder', async () => {
    const before = (await get('/api/maison/lot/0047/bids')).json;
    const newAmount = before.currentBid + 50_000;
    const { status, json } = await post('/api/maison/lot/0047/bid', {
      amount: newAmount,
      paddle: '0817 (you)',
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.currentBid).toBe(newAmount);
    expect(json.bidCount).toBe(before.bidCount + 1);
    expect(json.recentBids[0].amount).toBe(newAmount);
    expect(json.recentBids[0].paddle).toContain('0817');
    expect(json.topBidder).toContain('0817');

    // Read-back via /bids endpoint reflects the new state.
    const after = (await get('/api/maison/lot/0047/bids')).json;
    expect(after.currentBid).toBe(newAmount);
  });

  it('rejects paddle with disallowed characters', async () => {
    const before = (await get('/api/maison/lot/0047/bids')).json;
    const { status } = await post('/api/maison/lot/0047/bid', {
      amount: before.currentBid + 25_000,
      paddle: '<script>alert(1)</script>',
    });
    expect(status).toBe(400);
  });
});
