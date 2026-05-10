import BaseModel from '../../core/models/base.model.js';

// Columns returned by list/get queries — excludes `file_bytes` (up to 5MB)
// to keep polling responses cheap. Fetch bytes explicitly via `findFileById`.
const PUBLIC_COLUMNS =
  'id, user_id, filename, mime_type, parsed_text, weaviate_id, is_active, embedding_status, sections, uploaded_at';

class CvModel extends BaseModel {
  constructor() {
    super('cvs');
  }

  async findActiveByUser(userId) {
    return this.findOne({ user_id: userId, is_active: true }, PUBLIC_COLUMNS);
  }

  async findById(id) {
    return super.findById(id, PUBLIC_COLUMNS);
  }

  async findFileById(id) {
    const result = await this.db.query(
      'SELECT id, user_id, filename, mime_type, file_bytes FROM cvs WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0] || null;
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
