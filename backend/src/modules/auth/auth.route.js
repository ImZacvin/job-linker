import { Router } from 'express';
import authController from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// ─── Public Routes (no authentication required) ────────────────
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// ─── Token Verification (used by extension to check stored token) ──
router.get('/verify', authenticate, authController.verify);

export default router;
