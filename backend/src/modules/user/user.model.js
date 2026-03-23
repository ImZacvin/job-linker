import BaseModel from '../../core/models/base.model.js';

class UserModel extends BaseModel {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    return this.findOne({ email });
  }

  async findByIdSafe(id) {
    return this.findOne(
      { id },
      'id, email, full_name, role, created_at, updated_at'
    );
  }

  async findAllSafe() {
    return this.findAll(
      {},
      'id, email, full_name, role, created_at, updated_at'
    );
  }
}

export default new UserModel();
