import BaseModel from '../../core/models/base.model.js';

class MatchModel extends BaseModel {
  constructor() {
    super('job_matches');
  }

  async findByJobAndCv(jobId, cvId) {
    return this.findOne({ job_id: jobId, cv_id: cvId });
  }

  async upsert({ jobId, cvId, status = 'pending' }) {
    const result = await this.db.query(
      `INSERT INTO job_matches (job_id, cv_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (job_id, cv_id)
       DO UPDATE SET status = EXCLUDED.status, matched_at = NOW()
       RETURNING *`,
      [jobId, cvId, status]
    );
    return result.rows[0];
  }

  async saveResult({
    jobId,
    cvId,
    docScore,
    sectionScore,
    requiredSkills,
    matchedSkills,
    missingSkills,
    summary,
    llmScore = null,
    llmReasoning = null,
    llmStrengths = [],
    llmConcerns = [],
    llmStatus = 'skipped',
  }) {
    // `score` is the UI-facing value: prefers llm_score, falls back to section_score.
    // doc_score, section_score, llm_score are stored separately so the thesis
    // evaluation harness can compare cosine-only vs cosine+LLM head-to-head.
    const finalScore = llmScore ?? sectionScore;
    const result = await this.db.query(
      `UPDATE job_matches
         SET score = $3,
             doc_score = $4,
             section_score = $5,
             required_skills = $6,
             matched_skills = $7,
             missing_skills = $8,
             summary = $9,
             llm_score = $10,
             llm_reasoning = $11,
             llm_strengths = $12,
             llm_concerns = $13,
             llm_status = $14,
             status = 'done',
             error = NULL,
             matched_at = NOW()
       WHERE job_id = $1 AND cv_id = $2
       RETURNING *`,
      [
        jobId,
        cvId,
        finalScore,
        docScore,
        sectionScore,
        JSON.stringify(requiredSkills ?? []),
        JSON.stringify(matchedSkills ?? []),
        JSON.stringify(missingSkills ?? []),
        summary || null,
        llmScore,
        llmReasoning,
        JSON.stringify(llmStrengths ?? []),
        JSON.stringify(llmConcerns ?? []),
        llmStatus,
      ]
    );
    return result.rows[0] || null;
  }

  async markFailed(jobId, cvId, error) {
    const result = await this.db.query(
      `UPDATE job_matches
         SET status = 'failed', error = $3, matched_at = NOW()
       WHERE job_id = $1 AND cv_id = $2
       RETURNING *`,
      [jobId, cvId, (error || '').slice(0, 500)]
    );
    return result.rows[0] || null;
  }

  async findByJobForUser(userId, jobId) {
    const result = await this.db.query(
      `SELECT m.*
         FROM job_matches m
         JOIN jobs j ON j.id = m.job_id
        WHERE j.user_id = $1 AND m.job_id = $2
        ORDER BY m.matched_at DESC
        LIMIT 1`,
      [userId, jobId]
    );
    return result.rows[0] || null;
  }
}

export default new MatchModel();
