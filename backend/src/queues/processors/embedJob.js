import openai from '../../config/openai.js';
import env from '../../config/env.js';
import jobModel from '../../modules/job/job.model.js';
import cvModel from '../../modules/cv/cv.model.js';
import matchModel from '../../modules/matching/match.model.js';
import pool from '../../config/postgres.js';
import { getJobCollection } from '../../config/weaviate.js';
import { enqueueMatchJob } from '../index.js';
import { extractSectionsAndSkills, embedSections } from '../../lib/sections.js';

function stripHtml(text) {
  if (!text) return '';
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function composeJobText(job) {
  const parts = [
    job.title,
    job.company_name,
    job.location,
    job.employment_type,
    stripHtml(job.description),
  ]
    .filter(Boolean)
    .join('\n');
  return parts.slice(0, 8000);
}

async function setEmbeddingStatus(jobId, status, error = null) {
  await pool.query(
    'UPDATE jobs SET embedding_status = $1, embedding_error = $2 WHERE id = $3',
    [status, error ? String(error).slice(0, 500) : null, jobId]
  );
}

export default async function embedJob(queueJob) {
  const { jobId, userId } = queueJob.data;

  try {
    const job = await jobModel.findById(jobId);
    if (!job || job.user_id !== userId) {
      throw new Error(`Job ${jobId} not found for user ${userId}`);
    }

    const text = composeJobText(job);
    if (!text) {
      await setEmbeddingStatus(jobId, 'done');
      return { jobId, skipped: 'empty job text' };
    }

    const embeddingResp = await openai.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text,
    });
    const vector = embeddingResp.data[0].embedding;

    const col = await getJobCollection();

    if (job.weaviate_id) {
      try {
        await col.data.deleteById(job.weaviate_id);
      } catch (err) {
        console.warn(`Failed to delete old job vector ${job.weaviate_id}: ${err.message}`);
      }
    }

    const weaviateId = await col.data.insert({
      properties: {
        userId: job.user_id,
        jobId: job.id,
        text,
      },
      vectors: vector,
    });

    await pool.query('UPDATE jobs SET weaviate_id = $1 WHERE id = $2', [weaviateId, jobId]);

    // Section decomposition + per-section embeddings.
    const { sections: sectionStrings } = await extractSectionsAndSkills(text, 'job');
    const sectionEmbeds = await embedSections(sectionStrings);
    await pool.query('UPDATE jobs SET sections = $1 WHERE id = $2', [
      JSON.stringify(sectionEmbeds),
      jobId,
    ]);

    await setEmbeddingStatus(jobId, 'done');

    // Only enqueue match-job if the CV is also done embedding.
    // If the CV is still embedding, its own completion will fan out to this job.
    const activeCv = await cvModel.findActiveByUser(userId);
    const cvReady = activeCv && activeCv.embedding_status === 'done' && activeCv.weaviate_id;
    if (cvReady) {
      await matchModel.upsert({ jobId, cvId: activeCv.id, status: 'pending' });
      await enqueueMatchJob({ jobId, cvId: activeCv.id, userId });
    }

    return { jobId, weaviateId, matched: Boolean(cvReady) };
  } catch (err) {
    console.error(`[embed-job] job=${jobId} failed: ${err.message}`);
    try {
      await setEmbeddingStatus(jobId, 'failed', err.message);
    } catch (persistErr) {
      console.error(`[embed-job] also failed to persist 'failed' status: ${persistErr.message}`);
    }
    throw err;
  }
}
