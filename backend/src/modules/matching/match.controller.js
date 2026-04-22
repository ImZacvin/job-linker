import matchService from './match.service.js';

function toPublic(match) {
  if (!match) return null;
  return {
    ...match,
    score: match.score === null ? null : Number(match.score),
  };
}

class MatchController {
  async getMatch(req, res) {
    try {
      const match = await matchService.getMatchForJob(req.user.id, parseInt(req.params.id));
      res.json({ data: toPublic(match) });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }

  async recompute(req, res) {
    try {
      const result = await matchService.recompute(req.user.id, parseInt(req.params.id));
      res.status(202).json({ data: result });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
}

export default new MatchController();
