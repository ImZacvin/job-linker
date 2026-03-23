import BaseModel from '../../core/models/base.model.js';

class JobModel extends BaseModel {
  constructor() {
    super('jobs');
  }

  async findByUserId(userId, filters = {}) {
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramIndex = 2;

    if (filters.platform) {
      conditions.push(`platform = $${paramIndex++}`);
      values.push(filters.platform);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    const where = conditions.join(' AND ');
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE ${where} ORDER BY created_at DESC`,
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
