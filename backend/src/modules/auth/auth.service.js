import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import userModel from '../user/user.model.js';

class AuthService {
  generateAccessToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );
  }

  async register({ email, password, full_name }) {
    const existing = await userModel.findByEmail(email);
    if (existing) {
      throw { status: 409, message: 'Email already registered' };
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await userModel.create({
      email,
      password_hash,
      full_name,
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const { password_hash: _, ...safeUser } = user;

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { user: safeUser, accessToken, refreshToken };
  }

  async login({ email, password }) {
    const user = await userModel.findByEmail(email);
    if (!user) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    const { password_hash: _, ...safeUser } = user;

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { user: safeUser, accessToken, refreshToken };
  }

  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
      const user = await userModel.findById(decoded.id);

      if (!user) {
        throw { status: 401, message: 'User not found' };
      }

      const accessToken = this.generateAccessToken(user);

      return { accessToken };
    } catch (err) {
      if (err.status) throw err;
      throw { status: 401, message: 'Invalid refresh token' };
    }
  }
}

export default new AuthService();
