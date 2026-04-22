import { Queue } from 'bullmq';
import connection from '../config/redis.js';

export const QUEUE_NAMES = {
  EMBED_CV: 'embed-cv',
  EMBED_JOB: 'embed-job',
  MATCH_JOB: 'match-job',
  ENRICH_JOB: 'enrich-job',
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

export const embedCvQueue = new Queue(QUEUE_NAMES.EMBED_CV, {
  connection,
  defaultJobOptions,
});

export const embedJobQueue = new Queue(QUEUE_NAMES.EMBED_JOB, {
  connection,
  defaultJobOptions,
});

export const matchJobQueue = new Queue(QUEUE_NAMES.MATCH_JOB, {
  connection,
  defaultJobOptions,
});

export const enrichJobQueue = new Queue(QUEUE_NAMES.ENRICH_JOB, {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2, // enrichment is best-effort, don't hammer third-party endpoints
  },
});

export async function enqueueEmbedCv({ cvId, userId }) {
  return embedCvQueue.add('embed-cv', { cvId, userId });
}

export async function enqueueEmbedJob({ jobId, userId }) {
  return embedJobQueue.add('embed-job', { jobId, userId });
}

export async function enqueueMatchJob({ jobId, cvId, userId }) {
  return matchJobQueue.add('match-job', { jobId, cvId, userId });
}

export async function enqueueEnrichJob({ jobId, userId }) {
  return enrichJobQueue.add('enrich-job', { jobId, userId });
}
