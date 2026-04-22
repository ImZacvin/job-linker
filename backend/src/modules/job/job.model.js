import BaseModel from '../../core/models/base.model.js';

class JobModel extends BaseModel {
  constructor() {
    super('jobs');
  }

  async findByUserId(userId, filters = {}) {
    const conditions = ['j.user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    if (filters.platform) {
      conditions.push(`j.platform = $${paramIndex++}`);
      values.push(filters.platform);
    }

    if (filters.status) {
      conditions.push(`j.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    const where = conditions.join(' AND ');
    const result = await this.db.query(
      `SELECT j.*,
              m.score::float AS match_score,
              m.status AS match_status,
              m.error AS match_error
         FROM ${this.tableName} j
         LEFT JOIN LATERAL (
           SELECT score, status, error
             FROM job_matches
            WHERE job_id = j.id
            ORDER BY matched_at DESC
            LIMIT 1
         ) m ON TRUE
        WHERE ${where}
        ORDER BY j.created_at DESC`,
      values
    );
    return result.rows;
  }

  async findByUserAndExternalId(userId, platform, externalId) {
    return this.findOne({
      user_id: userId,
      platform,
      external_id: externalId,
    });
  }
}

export default new JobModel();
