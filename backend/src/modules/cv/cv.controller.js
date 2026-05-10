import cvService from './cv.service.js';

function toPublicCv(cv) {
  if (!cv) return null;
  // Strip both the parsed text (large) and raw bytes (huge) from API responses.
  // text_length is what the UI actually needs.
  const { parsed_text, file_bytes: _bytes, ...rest } = cv;
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

  async getCvFile(req, res) {
    try {
      const cv = await cvService.getCvFile(req.user.id, parseInt(req.params.id));
      res.setHeader('Content-Type', cv.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', cv.file_bytes.length);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(cv.filename || 'cv')}"`
      );
      res.send(cv.file_bytes);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default new CvController();
