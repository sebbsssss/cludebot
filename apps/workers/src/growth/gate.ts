import { createChildLogger } from '@clude/shared/core/logger';
import { getDb } from '@clude/shared/core/database';
import { sendChannelMessage } from '@clude/shared/core/telegram-client';
import { config } from '@clude/shared/config';
import type { GateAction } from './types';

const log = createChildLogger('growth-gate');

export async function queueForApproval(action: GateAction): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from('growth_gate_inbox')
    .insert({
      role: action.role,
      kind: action.kind,
      channel: action.channel,
      target: action.target,
      subject: action.subject,
      body: action.body,
      suggested_identity: action.suggested_identity,
      rationale: action.rationale,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) {
    log.error({ err: error, role: action.role }, 'Failed to queue approval');
    return null;
  }

  const id = String(data.id);

  if (config.telegram.botToken && config.telegram.channelId) {
    const dashboardUrl = (process.env.DASHBOARD_URL || 'https://cludebot.up.railway.app') + `/growth/inbox?id=${id}`;
    const msg = [
      `Growth swarm needs approval`,
      `• Role: ${action.role}`,
      `• Channel: ${action.channel}`,
      `• Target: ${action.target}`,
      `• Identity: ${action.suggested_identity}`,
      ``,
      `Subject: ${action.subject}`,
      ``,
      action.body.length > 500 ? action.body.slice(0, 500) + '…' : action.body,
      ``,
      `Review: ${dashboardUrl}`,
    ].join('\n');

    await sendChannelMessage(msg).catch((err: unknown) => {
      log.error({ err }, 'Failed to send gate notification to Telegram');
    });
  }

  log.info({ id, role: action.role, kind: action.kind }, 'Action queued for approval');
  return id;
}

export async function pendingCount(): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from('growth_gate_inbox')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) {
    log.error({ err: error }, 'Failed to read pending count');
    return 0;
  }
  return count || 0;
}
