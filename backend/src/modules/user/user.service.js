import userModel from './user.model.js';

class UserService {
  async getAllUsers() {
    return userModel.findAllSafe();
  }

  async getUserById(id) {
    const user = await userModel.findByIdSafe(id);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }
    return user;
  }

  async updateUser(id, data) {
    // Only allow updating safe fields
    const allowedFields = ['full_name', 'email'];
    const updateData = {};

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw { status: 400, message: 'No valid fields to update' };
    }

    updateData.updated_at = new Date();

    const user = await userModel.update(id, updateData);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async deleteUser(id) {
    const user = await userModel.delete(id);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }
    return { message: 'User deleted successfully' };
  }
}

export default new UserService();
