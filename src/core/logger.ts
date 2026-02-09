import pino from 'pino';

// MCP mode uses stdout for protocol messages — logs must go to stderr
const logDestination = process.env.MCP_MODE === '1' ? 2 : 1;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino/file', options: { destination: logDestination } }
    : undefined,
});

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}
