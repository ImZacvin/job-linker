import cvModel from '../../modules/cv/cv.model.js';
import jobModel from '../../modules/job/job.model.js';
import matchModel from '../../modules/matching/match.model.js';
import { getCvCollection, getJobCollection } from '../../config/weaviate.js';
import { rerankMatch } from '../../lib/rerank.js';

// Threshold above which a JD skill is considered "matched" by some CV skill.
// With type-prefixed embeddings, exact matches cosine ~0.95, clear synonyms ~0.60-0.75.
// 0.55 captures synonyms without letting noise through.
const SKILL_MATCH_THRESHOLD = 0.55;

// Weights for pooling section similarities into a final section_score.
const W_SKILLS = 0.6;
const W_RESP = 0.4;

// Top-K pooling: average only the top-K best matched JD items per section when
// computing the aggregate similarity. Rewards real coverage; downweights
// phrasing-noise outliers. Tune during thesis evaluation.
const TOP_K_SKILLS = 5;
const TOP_K_RESP = 3;

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function fetchVector(col, uuid) {
  const obj = await col.query.fetchObjectById(uuid, { includeVector: true });
  if (!obj) return null;
  if (Array.isArray(obj.vectors)) return obj.vectors;
  return obj.vectors?.default || obj.vector || null;
}

/**
 * For each JD item, find the max cosine against any CV item.
 * Aggregate with top-K pooling: average only the top-K best per-item matches
 * (so outlier misses don't dominate the mean).
 * Returns { mean: topKAvg, perItem: [{ text, bestSim }] } — perItem is the
 * full list, used for the matched/missing skill breakdown.
 */
function pairwiseMaxSims(jdItems, cvItems, topK) {
  if (!jdItems || jdItems.length === 0) return { mean: 0, perItem: [] };
  if (!cvItems || cvItems.length === 0) {
    return { mean: 0, perItem: jdItems.map((j) => ({ text: j.text, bestSim: 0 })) };
  }
  const perItem = jdItems.map((j) => {
    let best = 0;
    for (const c of cvItems) {
      const s = cosine(j.vector, c.vector);
      if (s > best) best = s;
    }
    return { text: j.text, bestSim: best };
  });
  const sorted = [...perItem].sort((a, b) => b.bestSim - a.bestSim);
  const k = Math.max(1, Math.min(topK, sorted.length));
  const mean = sorted.slice(0, k).reduce((acc, x) => acc + x.bestSim, 0) / k;
  return { mean, perItem };
}

function computeSectionScore(cvSections, jobSections) {
  const skills = pairwiseMaxSims(jobSections?.skills, cvSections?.skills, TOP_K_SKILLS);
  const resp = pairwiseMaxSims(
    jobSections?.responsibilities,
    cvSections?.responsibilities,
    TOP_K_RESP
  );
  const score = W_SKILLS * skills.mean + W_RESP * resp.mean;
  return {
    score: Math.max(0, Math.min(1, score)),
    skillsSim: skills.mean,
    respSim: resp.mean,
    perSkill: skills.perItem,
  };
}

function deriveSkillGaps(perSkill) {
  const required = perSkill.map((p) => p.text);
  const matched = perSkill.filter((p) => p.bestSim >= SKILL_MATCH_THRESHOLD).map((p) => p.text);
  const missing = perSkill.filter((p) => p.bestSim < SKILL_MATCH_THRESHOLD).map((p) => p.text);
  return { required, matched, missing };
}

function buildSummary({ sectionScore, required, matched, missing }) {
  const pct = Math.round(sectionScore * 100);
  const total = required.length || 0;
  const matches = matched.length || 0;
  if (total === 0) {
    return `Overall fit ~${pct}%. Not enough structured skills extracted from the job to compute a skill-by-skill breakdown.`;
  }
  const parts = [`Overall fit ~${pct}%.`, `You match ${matches} of ${total} required skills.`];
  if (missing.length > 0) {
    const preview = missing.slice(0, 3).join(', ');
    parts.push(`Missing: ${preview}${missing.length > 3 ? `, +${missing.length - 3} more` : ''}.`);
  }
  return parts.join(' ');
}

export default async function matchJob(queueJob) {
  const { jobId, cvId, userId } = queueJob.data;

  try {
    const job = await jobModel.findById(jobId);
    const cv = await cvModel.findById(cvId);

    if (!job || !cv || job.user_id !== userId || cv.user_id !== userId) {
      throw new Error('Job or CV not accessible for this user');
    }
    if (!job.weaviate_id || !cv.weaviate_id) {
      throw new Error('Embedding not ready yet for job or CV');
    }

    // Doc-level cosine (baseline, kept for thesis evaluation alongside section_score).
    const cvCol = await getCvCollection();
    const jobCol = await getJobCollection();
    const [cvVec, jobVec] = await Promise.all([
      fetchVector(cvCol, cv.weaviate_id),
      fetchVector(jobCol, job.weaviate_id),
    ]);
    if (!cvVec || !jobVec) {
      throw new Error('Could not fetch vectors from Weaviate');
    }
    const docScore = Math.max(0, Math.min(1, cosine(cvVec, jobVec)));

    // Section-level pooled similarity (new primary score).
    const cvSections = cv.sections || null;
    const jobSections = job.sections || null;
    if (!cvSections || !jobSections) {
      throw new Error('Section decomposition missing; re-run embed-cv / embed-job');
    }
    const sect = computeSectionScore(cvSections, jobSections);
    const { required, matched, missing } = deriveSkillGaps(sect.perSkill);
    const summary = buildSummary({
      sectionScore: sect.score,
      required,
      matched,
      missing,
    });

    // LLM re-rank pass: refines the cosine score and produces reasoning.
    // Fails-soft — any error leaves cosine result intact and sets llm_status='failed'.
    const textOnly = (s) => ({
      skills: (s?.skills || []).map((x) => x.text),
      responsibilities: (s?.responsibilities || []).map((x) => x.text),
      experience: (s?.experience || []).map((x) => x.text),
    });
    let llmScore = null;
    let llmReasoning = null;
    let llmStrengths = [];
    let llmConcerns = [];
    let llmStatus = 'skipped';
    try {
      const rr = await rerankMatch({
        cvSections: textOnly(cvSections),
        jobSections: textOnly(jobSections),
        docScore,
        sectionScore: sect.score,
        matchedSkills: matched,
        missingSkills: missing,
        jobTitle: job.title,
      });
      if (rr) {
        llmScore = Math.max(0, Math.min(1, rr.final_score / 100));
        llmReasoning = rr.reasoning;
        llmStrengths = Array.isArray(rr.strengths) ? rr.strengths.slice(0, 3) : [];
        llmConcerns = Array.isArray(rr.concerns) ? rr.concerns.slice(0, 3) : [];
        llmStatus = 'ok';
      } else {
        llmStatus = 'failed';
      }
    } catch (e) {
      console.warn(`[rerank] failed job=${jobId} cv=${cvId}: ${e.message}`);
      llmStatus = 'failed';
    }

    await matchModel.saveResult({
      jobId,
      cvId,
      docScore,
      sectionScore: sect.score,
      requiredSkills: required,
      matchedSkills: matched,
      missingSkills: missing,
      summary,
      llmScore,
      llmReasoning,
      llmStrengths,
      llmConcerns,
      llmStatus,
    });

    console.log(
      `[match-job] job=${jobId} cv=${cvId} doc_score=${docScore.toFixed(3)} section_score=${sect.score.toFixed(3)} llm_score=${llmScore === null ? 'null' : llmScore.toFixed(3)} llm_status=${llmStatus} (skills=${sect.skillsSim.toFixed(3)}, resp=${sect.respSim.toFixed(3)}) matched=${matched.length}/${required.length}`
    );

    return { jobId, cvId, docScore, sectionScore: sect.score, llmScore, llmStatus };
  } catch (err) {
    await matchModel.markFailed(jobId, cvId, err.message);
    throw err;
  }
}
