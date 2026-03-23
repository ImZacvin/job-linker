import db from '../../config/postgres.js';

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  async findAll(conditions = {}, columns = '*') {
    const keys = Object.keys(conditions);
    if (keys.length === 0) {
      const result = await this.db.query(`SELECT ${columns} FROM ${this.tableName}`);
      return result.rows;
    }

    const where = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    const values = Object.values(conditions);
    const result = await this.db.query(
      `SELECT ${columns} FROM ${this.tableName} WHERE ${where}`,
      values
    );
    return result.rows;
  }

  async findOne(conditions, columns = '*') {
    const keys = Object.keys(conditions);
    const where = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    const values = Object.values(conditions);
    const result = await this.db.query(
      `SELECT ${columns} FROM ${this.tableName} WHERE ${where} LIMIT 1`,
      values
    );
    return result.rows[0] || null;
  }

  async findById(id, columns = '*') {
    return this.findOne({ id }, columns);
  }

  async create(data) {
    const keys = Object.keys(data);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(data);

    const result = await this.db.query(
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const set = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = [...Object.values(data), id];

    const result = await this.db.query(
      `UPDATE ${this.tableName} SET ${set} WHERE id = $${keys.length + 1} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }
}

export default BaseModel;
