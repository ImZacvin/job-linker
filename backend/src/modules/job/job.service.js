import jobModel from './job.model.js';
import { enqueueEmbedJob, enqueueEnrichJob } from '../../queues/index.js';

const MIN_DESCRIPTION_LENGTH_FOR_EMBED = 200;

function shouldEnrich(platform, description, url) {
  if (!url) return false;
  const len = (description || '').trim().length;
  return len < MIN_DESCRIPTION_LENGTH_FOR_EMBED;
}

class JobService {
  async getJobsByUser(userId, filters) {
    return jobModel.findByUserId(userId, filters);
  }

  async getJobById(userId, jobId) {
    const job = await jobModel.findById(jobId);
    if (!job || job.user_id !== userId) {
      throw { status: 404, message: 'Job not found' };
    }
    return job;
  }

  async saveJob(userId, data) {
    // Check for duplicate
    if (data.external_id && data.platform) {
      const existing = await jobModel.findByUserAndExternalId(
        userId,
        data.platform,
        data.external_id
      );
      if (existing) {
        throw { status: 409, message: 'Job already saved' };
      }
    }

    const created = await jobModel.create({
      user_id: userId,
      platform: data.platform,
      external_id: data.external_id || null,
      title: data.title,
      company_name: data.company_name || null,
      location: data.location || null,
      description: data.description || null,
      description_source: 'extension',
      salary_min: data.salary_min || null,
      salary_max: data.salary_max || null,
      salary_currency: data.salary_currency || null,
      employment_type: data.employment_type || null,
      url: data.url || null,
      posted_at: data.posted_at || null,
      status: data.status || 'saved',
      raw_data: data.raw_data ? JSON.stringify(data.raw_data) : null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Decide: if description is missing/short and we have a URL, try server-side
    // enrichment first; enrichJob will enqueue embedJob when it finishes either way.
    // Otherwise, go straight to embedding.
    const needsEnrichment = shouldEnrich(created.platform, created.description, created.url);
    const enqueue = needsEnrichment
      ? enqueueEnrichJob({ jobId: created.id, userId })
      : enqueueEmbedJob({ jobId: created.id, userId });

    enqueue.catch((err) => {
      console.error(
        `Failed to enqueue ${needsEnrichment ? 'enrich-job' : 'embed-job'}:`,
        err.message
      );
    });

    return created;
  }

  async saveBulkJobs(userId, jobs) {
    const results = [];
    for (const job of jobs) {
      try {
        const saved = await this.saveJob(userId, job);
        results.push({ success: true, job: saved });
      } catch (err) {
        results.push({ success: false, title: job.title, error: err.message });
      }
    }
    return results;
  }

  async updateJobStatus(userId, jobId, status) {
    const job = await jobModel.findById(jobId);
    if (!job || job.user_id !== userId) {
      throw { status: 404, message: 'Job not found' };
    }

    return jobModel.update(jobId, { status, updated_at: new Date() });
  }

  async deleteJob(userId, jobId) {
    const job = await jobModel.findById(jobId);
    if (!job || job.user_id !== userId) {
      throw { status: 404, message: 'Job not found' };
    }

    return jobModel.delete(jobId);
  }
}

export default new JobService();
