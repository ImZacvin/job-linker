import cvService from './cv.service.js';

function toPublicCv(cv) {
  if (!cv) return null;
  const { parsed_text, ...rest } = cv;
  return { ...rest, text_length: parsed_text ? parsed_text.length : 0 };
}

class CvController {
  async getActiveCv(req, res) {
    try {
      const cv = await cvService.getActiveCv(req.user.id);
      res.json({ data: toPublicCv(cv) });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async uploadCv(req, res) {
    try {
      const cv = await cvService.uploadCv(req.user.id, req.file);
      res.status(201).json({ data: toPublicCv(cv) });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async deleteCv(req, res) {
    try {
      await cvService.deleteCv(req.user.id, parseInt(req.params.id));
      res.json({ message: 'CV deleted successfully' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default new CvController();
