import jobService from './job.service.js';

class JobController {
  async getJobs(req, res) {
    try {
      const { platform, status } = req.query;
      const jobs = await jobService.getJobsByUser(req.user.id, { platform, status });
      res.json({ data: jobs });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getJob(req, res) {
    try {
      const job = await jobService.getJobById(req.user.id, parseInt(req.params.id));
      res.json({ data: job });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async saveJob(req, res) {
    try {
      const { platform, title } = req.body;

      if (!platform || !title) {
        return res.status(400).json({ error: 'Platform and title are required' });
      }

      const job = await jobService.saveJob(req.user.id, req.body);
      res.status(201).json({ data: job });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async saveBulkJobs(req, res) {
    try {
      const { jobs } = req.body;

      if (!Array.isArray(jobs) || jobs.length === 0) {
        return res.status(400).json({ error: 'Jobs array is required' });
      }

      const results = await jobService.saveBulkJobs(req.user.id, jobs);
      res.status(201).json({ data: results });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const job = await jobService.updateJobStatus(req.user.id, parseInt(req.params.id), status);
      res.json({ data: job });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async deleteJob(req, res) {
    try {
      await jobService.deleteJob(req.user.id, parseInt(req.params.id));
      res.json({ message: 'Job deleted successfully' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default new JobController();
