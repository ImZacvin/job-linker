import openai from '../config/openai.js';
import env from '../config/env.js';

const MAX_ITEMS_PER_SECTION = 15;
const TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = `You are an expert technical recruiter making a final judgement on a CV vs job match.
You will be given:
  - Cosine-based scores (doc_score, section_score) computed from embeddings
  - The CV's and job's extracted skills, responsibilities, and experience phrases
  - Which required skills cosine marked matched vs missing
Your job: produce a FINAL score (0-100) that corrects for nuance cosine misses:
  - version/seniority mismatch (e.g. "Python 2" vs "Python 3.11 + async")
  - domain pivot (fintech infra != gaming infra even if stacks overlap)
  - depth (one bullet mention != years of demonstrated use)
  - transferable experience cosine under-weighted
Calibration: section_score around 0.70 typically corresponds to a strong match.
Keep final_score close to section_score*100 unless you have a concrete reason to adjust.
Deviate by more than 15 points only when nuance clearly warrants it.
strengths: up to 3 short bullets of what this CV does well for this role.
concerns: up to 3 concrete gaps beyond the already-listed missing skills (seniority, domain, depth).
reasoning: 2-3 sentences, plain English, no fluff.
Return ONLY JSON matching the schema.`;

const RERANK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    final_score: { type: 'integer', minimum: 0, maximum: 100 },
    reasoning: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    concerns: { type: 'array', items: { type: 'string' }, maxItems: 3 },
  },
  required: ['final_score', 'reasoning', 'strengths', 'concerns'],
};

function truncate(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_ITEMS_PER_SECTION);
}

/**
 * LLM re-rank pass. Takes structured CV/JD fields + cosine scores, returns
 * an LLM-adjusted final score + reasoning + strengths + concerns.
 * Returns null on timeout / API error — caller falls back to cosine-only.
 */
export async function rerankMatch({
  cvSections,
  jobSections,
  docScore,
  sectionScore,
  matchedSkills,
  missingSkills,
  jobTitle,
}) {
  const payload = {
    job_title: jobTitle || null,
    doc_score: Number(docScore?.toFixed?.(3) ?? docScore ?? 0),
    section_score: Number(sectionScore?.toFixed?.(3) ?? sectionScore ?? 0),
    matched_skills: matchedSkills || [],
    missing_skills: missingSkills || [],
    cv: {
      skills: truncate(cvSections?.skills),
      responsibilities: truncate(cvSections?.responsibilities),
      experience: truncate(cvSections?.experience),
    },
    job: {
      skills: truncate(jobSections?.skills),
      responsibilities: truncate(jobSections?.responsibilities),
      experience: truncate(jobSections?.experience),
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await openai.chat.completions.create(
      {
        model: env.OPENAI_CHAT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'rerank', schema: RERANK_SCHEMA, strict: true },
        },
      },
      { signal: controller.signal }
    );
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[rerank] call failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
