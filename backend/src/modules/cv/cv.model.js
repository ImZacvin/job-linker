import BaseModel from '../../core/models/base.model.js';

class CvModel extends BaseModel {
  constructor() {
    super('cvs');
  }

  async findActiveByUser(userId) {
    return this.findOne({ user_id: userId, is_active: true });
  }

  async deactivateAllForUser(userId) {
    await this.db.query(
      'UPDATE cvs SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE',
      [userId]
    );
  }

  async setEmbeddingStatus(id, status, weaviateId = null) {
    const result = await this.db.query(
      `UPDATE cvs SET embedding_status = $1, weaviate_id = COALESCE($2, weaviate_id) WHERE id = $3 RETURNING *`,
      [status, weaviateId, id]
    );
    return result.rows[0] || null;
  }
}

export default new CvModel();
