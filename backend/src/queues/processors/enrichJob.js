import jobModel from '../../modules/job/job.model.js';
import pool from '../../config/postgres.js';
import { runEnricher } from '../enrichers/index.js';
import { enqueueEmbedJob } from '../index.js';

const MIN_USABLE_LENGTH = 200;

export default async function enrichJob(queueJob) {
  const { jobId, userId } = queueJob.data;

  const job = await jobModel.findById(jobId);
  if (!job || job.user_id !== userId) {
    throw new Error(`Job ${jobId} not accessible for user ${userId}`);
  }

  let nextDescription = null;
  let nextSource = 'none';

  try {
    const result = await runEnricher(job.platform, {
      url: job.url,
      external_id: job.external_id,
    });
    if (result?.description && result.description.length >= MIN_USABLE_LENGTH) {
      nextDescription = result.description;
      nextSource = 'server';
    }
  } catch (err) {
    console.error(
      `[enrich-job] job=${jobId} platform=${job.platform} failed: ${err.message}`
    );
  }

  if (nextDescription) {
    await pool.query(
      'UPDATE jobs SET description = $1, description_source = $2 WHERE id = $3',
      [nextDescription, nextSource, jobId]
    );
    console.log(
      `[enrich-job] job=${jobId} enriched (${nextDescription.length} chars from ${job.platform})`
    );
  } else {
    await pool.query('UPDATE jobs SET description_source = $1 WHERE id = $2', [
      nextSource,
      jobId,
    ]);
    console.log(`[enrich-job] job=${jobId} no enrichment (source='none')`);
  }

  // Always proceed to embed — even with the original/empty description.
  await enqueueEmbedJob({ jobId, userId });

  return { jobId, source: nextSource, length: nextDescription?.length ?? 0 };
}
