import matchModel from './match.model.js';
import cvModel from '../cv/cv.model.js';
import jobModel from '../job/job.model.js';
import {
  enqueueMatchJob,
  enqueueEmbedJob,
  enqueueEmbedCv,
  enqueueEnrichJob,
} from '../../queues/index.js';

const MIN_DESCRIPTION_LENGTH = 200;

class MatchService {
  async getMatchForJob(userId, jobId) {
    const job = await jobModel.findById(jobId);
    if (!job || job.user_id !== userId) {
      throw { status: 404, message: 'Job not found' };
    }
    return matchModel.findByJobForUser(userId, jobId);
  }

  async recompute(userId, jobId) {
    const job = await jobModel.findById(jobId);
    if (!job || job.user_id !== userId) {
      throw { status: 404, message: 'Job not found' };
    }

    const cv = await cvModel.findActiveByUser(userId);
    if (!cv) {
      throw { status: 400, message: 'Upload a CV before computing a match' };
    }

    await matchModel.upsert({ jobId, cvId: cv.id, status: 'pending' });

    // Walk back the pipeline: if something upstream is missing, re-run from
    // there. Whichever processor finishes last will enqueue the next step.
    const jobHasEmbed = Boolean(job.weaviate_id);
    const cvHasEmbed = Boolean(cv.weaviate_id);
    const cvHasSections = Boolean(cv.sections);
    const jobHasSections = Boolean(job.sections);
    const descTooShort = !job.description || job.description.length < MIN_DESCRIPTION_LENGTH;

    let entered;
    if (!cvHasEmbed || !cvHasSections) {
      await enqueueEmbedCv({ cvId: cv.id, userId });
      entered = 'embed-cv';
    } else if (!jobHasEmbed && descTooShort && job.description_source !== 'none') {
      await enqueueEnrichJob({ jobId, userId });
      entered = 'enrich-job';
    } else if (!jobHasEmbed || !jobHasSections) {
      await enqueueEmbedJob({ jobId, userId });
      entered = 'embed-job';
    } else {
      await enqueueMatchJob({ jobId, cvId: cv.id, userId });
      entered = 'match-job';
    }

    return { status: 'pending', jobId, cvId: cv.id, entered };
  }
}

export default new MatchService();
