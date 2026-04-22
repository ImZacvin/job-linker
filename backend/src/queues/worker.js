import '../config/env.js';
import { Worker } from 'bullmq';
import connection from '../config/redis.js';
import { ensureSchema } from '../config/weaviate.js';
import { QUEUE_NAMES } from './index.js';
import embedCv from './processors/embedCv.js';
import embedJob from './processors/embedJob.js';
import matchJob from './processors/matchJob.js';
import enrichJob from './processors/enrichJob.js';

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);

function attachLifecycleLogs(worker) {
  worker.on('completed', (job) => {
    console.log(`[${worker.name}] ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    const attempts = job?.opts?.attempts ?? 1;
    const made = job?.attemptsMade ?? 0;
    const terminal = made >= attempts;
    const label = terminal ? 'FINAL' : `attempt ${made}/${attempts}`;
    console.error(`[${worker.name}] ${job?.id} failed (${label}): ${err.message}`);
    if (terminal && err.stack) {
      console.error(err.stack);
    }
  });

  worker.on('error', (err) => {
    console.error(`[${worker.name}] worker error: ${err.message}`);
  });
}

async function main() {
  await ensureSchema();

  const workers = [
    new Worker(QUEUE_NAMES.EMBED_CV, embedCv, { connection, concurrency: WORKER_CONCURRENCY }),
    new Worker(QUEUE_NAMES.EMBED_JOB, embedJob, { connection, concurrency: WORKER_CONCURRENCY }),
    new Worker(QUEUE_NAMES.MATCH_JOB, matchJob, { connection, concurrency: WORKER_CONCURRENCY }),
    // Enrichment is IO-bound (HTTP fetch); lower concurrency keeps us polite.
    new Worker(QUEUE_NAMES.ENRICH_JOB, enrichJob, { connection, concurrency: 2 }),
  ];

  for (const w of workers) attachLifecycleLogs(w);

  console.log(`Worker running (concurrency=${WORKER_CONCURRENCY})`);

  const shutdown = async (sig) => {
    console.log(`Received ${sig}, shutting down workers...`);
    try {
      await Promise.all(workers.map((w) => w.close()));
      await connection.quit();
    } catch (err) {
      console.error('Shutdown error:', err.message);
    }
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    console.error('[worker] uncaughtException:', err);
  });
  process.on('unhandledRejection', (err) => {
    console.error('[worker] unhandledRejection:', err);
  });
}

main().catch((err) => {
  console.error('Worker bootstrap failed:', err);
  process.exit(1);
});
