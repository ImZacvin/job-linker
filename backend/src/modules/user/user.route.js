import { Router } from 'express';
import userController from './user.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// ─── Private Routes (require authentication) ───────────────────
router.get('/me', authenticate, userController.getProfile);
router.put('/me', authenticate, userController.updateProfile);

// ─── Admin Routes (require authentication + admin role) ────────
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);
router.get('/:id', authenticate, authorize('admin'), userController.getUserById);
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);

export default router;
