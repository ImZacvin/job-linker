import userService from './user.service.js';

class UserController {
  async getProfile(req, res) {
    try {
      const user = await userService.getUserById(req.user.id);
      res.json({ data: user });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await userService.getAllUsers();
      res.json({ data: users });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async getUserById(req, res) {
    try {
      const user = await userService.getUserById(req.params.id);
      res.json({ data: user });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const user = await userService.updateUser(req.user.id, req.body);
      res.json({ data: user });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async deleteUser(req, res) {
    try {
      const result = await userService.deleteUser(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default new UserController();
