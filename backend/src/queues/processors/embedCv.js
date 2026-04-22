import openai from '../../config/openai.js';
import env from '../../config/env.js';
import pool from '../../config/postgres.js';
import cvModel from '../../modules/cv/cv.model.js';
import jobModel from '../../modules/job/job.model.js';
import matchModel from '../../modules/matching/match.model.js';
import { getCvCollection } from '../../config/weaviate.js';
import { enqueueMatchJob, enqueueEmbedJob } from '../index.js';
import { extractSectionsAndSkills, embedSections } from '../../lib/sections.js';

export default async function embedCv(job) {
  const { cvId, userId } = job.data;

  let cv;
  try {
    cv = await cvModel.findById(cvId);
    if (!cv || cv.user_id !== userId) {
      throw new Error(`CV ${cvId} not found for user ${userId}`);
    }

    const embeddingResp = await openai.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: cv.parsed_text.slice(0, 8000),
    });
    const vector = embeddingResp.data[0].embedding;

    const col = await getCvCollection();

    if (cv.weaviate_id) {
      try {
        await col.data.deleteById(cv.weaviate_id);
      } catch (err) {
        console.warn(`Failed to delete old CV vector ${cv.weaviate_id}: ${err.message}`);
      }
    }

    const weaviateId = await col.data.insert({
      properties: {
        userId: cv.user_id,
        cvId: cv.id,
        text: cv.parsed_text.slice(0, 8000),
      },
      vectors: vector,
    });

    // Section decomposition + per-section embeddings.
    const { sections: sectionStrings } = await extractSectionsAndSkills(cv.parsed_text, 'cv');
    const sectionEmbeds = await embedSections(sectionStrings);
    await pool.query('UPDATE cvs SET sections = $1 WHERE id = $2', [
      JSON.stringify(sectionEmbeds),
      cv.id,
    ]);

    await cvModel.setEmbeddingStatus(cv.id, 'done', weaviateId);

    // Fan out to existing jobs: a new CV means every match must be redone.
    // Also re-embed each job so its section vectors live in the same
    // embedding version/space as the CV's (any prompt or prefix change would
    // otherwise produce cross-version cosine mismatches). The re-embed will
    // enqueue its own match-job on completion.
    const jobs = await jobModel.findAll({ user_id: userId });
    let toReembed = 0;
    for (const j of jobs) {
      if (j.embedding_status !== 'done' || !j.weaviate_id) continue;
      await enqueueEmbedJob({ jobId: j.id, userId });
      toReembed++;
    }

    return { cvId, weaviateId, toReembed };
  } catch (err) {
    console.error(`[embed-cv] cv=${cvId} failed: ${err.message}`);
    try {
      await cvModel.setEmbeddingStatus(cvId, 'failed');
    } catch (persistErr) {
      console.error(`[embed-cv] also failed to persist 'failed' status: ${persistErr.message}`);
    }
    throw err;
  }
}
