import cvModel from './cv.model.js';
import { parseCvBuffer } from './cv.parser.js';
import { enqueueEmbedCv } from '../../queues/index.js';

class CvService {
  async getActiveCv(userId) {
    return cvModel.findActiveByUser(userId);
  }

  async uploadCv(userId, file) {
    if (!file) {
      throw { status: 400, message: 'CV file is required' };
    }

    const text = await parseCvBuffer(file.buffer, file.mimetype);
    if (!text) {
      throw { status: 400, message: 'Could not extract text from CV' };
    }

    await cvModel.deactivateAllForUser(userId);

    const cv = await cvModel.create({
      user_id: userId,
      filename: file.originalname,
      mime_type: file.mimetype,
      parsed_text: text,
      file_bytes: file.buffer,
      is_active: true,
      embedding_status: 'pending',
    });

    await enqueueEmbedCv({ cvId: cv.id, userId });

    return cv;
  }

  async deleteCv(userId, cvId) {
    const cv = await cvModel.findById(cvId);
    if (!cv || cv.user_id !== userId) {
      throw { status: 404, message: 'CV not found' };
    }
    return cvModel.delete(cvId);
  }

  async getCvFile(userId, cvId) {
    const cv = await cvModel.findFileById(cvId);
    if (!cv || cv.user_id !== userId) {
      throw { status: 404, message: 'CV not found' };
    }
    if (!cv.file_bytes) {
      throw { status: 404, message: 'File bytes not stored — re-upload this CV to enable preview' };
    }
    return cv;
  }
}

export default new CvService();
