import { Router } from 'express';
import multer from 'multer';
import cvController from './cv.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(Object.assign(new Error('Only PDF/DOCX files are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate);

router.get('/', cvController.getActiveCv);
router.post('/', upload.single('cv'), cvController.uploadCv);
router.delete('/:id', cvController.deleteCv);

export default router;
