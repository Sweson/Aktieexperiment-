import { buildApp } from './app.js';
import { logger } from './logger.js';

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'shutdown initiated');
  try {
    await app.close();
    logger.info('shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'shutdown failed');
    process.exit(1);
  }
}

process.once('SIGTERM', (s) => void shutdown(s));
process.once('SIGINT', (s) => void shutdown(s));

await app.listen({ host, port });
logger.info({ host, port }, 'api listening');
