import jobModel from './job.model.js';

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

    return jobModel.create({
      user_id: userId,
      platform: data.platform,
      external_id: data.external_id || null,
      title: data.title,
      company_name: data.company_name || null,
      location: data.location || null,
      description: data.description || null,
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
