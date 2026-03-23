import authService from './auth.service.js';

class AuthController {
  async register(req, res) {
    try {
      const { email, password, full_name } = req.body;

      if (!email || !password || !full_name) {
        return res.status(400).json({ error: 'Email, password, and full_name are required' });
      }

      const result = await authService.register({ email, password, full_name });
      res.status(201).json({ data: result });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await authService.login({ email, password });
      res.json({ data: result });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async verify(req, res) {
    res.json({ data: { valid: true, user: req.user } });
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const result = await authService.refreshToken(refreshToken);
      res.json({ data: result });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default new AuthController();
