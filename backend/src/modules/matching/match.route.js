import { Router } from 'express';
import matchController from './match.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/:id/match', matchController.getMatch);
router.post('/:id/match/recompute', matchController.recompute);

export default router;
