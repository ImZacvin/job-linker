import { Router } from 'express';
import jobController from './job.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// ─── All routes are private (require authentication) ───────────
router.use(authenticate);

router.get('/', jobController.getJobs);              // GET /api/jobs?platform=linkedin&status=saved
router.get('/:id', jobController.getJob);             // GET /api/jobs/:id
router.post('/', jobController.saveJob);              // POST /api/jobs        (single job from extension)
router.post('/bulk', jobController.saveBulkJobs);     // POST /api/jobs/bulk   (batch save from extension)
router.patch('/:id/status', jobController.updateStatus); // PATCH /api/jobs/:id/status
router.delete('/:id', jobController.deleteJob);       // DELETE /api/jobs/:id

export default router;
