import openai from '../config/openai.js';
import env from '../config/env.js';

const SECTION_TYPES = ['skills', 'responsibilities', 'experience'];

// Prefix each phrase with its section type before embedding. Short phrases
// ("Kubernetes", "CI/CD") are noisy for text-embedding-3-small; adding a
// category token gives the encoder structure and lifts per-phrase cosines.
// The prefix is only used at embed time; the stored `text` keeps the bare phrase.
const PREFIX_BY_TYPE = {
  skills: 'Skill: ',
  responsibilities: 'Responsibility: ',
  experience: 'Experience: ',
};

const CV_SYSTEM = `You are an expert resume analyst. Given a candidate CV, extract a structured decomposition into short phrases.

- skills: concrete technical and soft skills the candidate demonstrably has (e.g. "Kubernetes", "Terraform", "CI/CD pipelines", "team leadership"). 1-4 words each.
- responsibilities: duties and actions the candidate performed in past roles, phrased as short sentences (e.g. "Designed AWS autoscaling groups", "Led migration to Docker").
- experience: roles, projects, industries, tenure phrases (e.g. "3 years at fintech startup", "Senior DevOps Engineer").
- summary: 1-2 sentences describing the candidate's profile.

Return ONLY JSON matching the schema. Phrases must be unique within each list. Aim for 5-15 items per list when the text supports it.`;

const JOB_SYSTEM = `You are an expert job description analyst. Given a job description, extract a structured decomposition into short phrases.

- skills: required TECHNICAL skills only (e.g. "PostgreSQL", "REST APIs", "Kubernetes"). 1-4 words each.
  * Hard cap at 12 items. If the JD mentions more, keep the 12 most core/differentiating and drop the rest.
  * DEDUPLICATE aggressively: "Python" + "Python 3" + "Python programming" → just "Python". Treat sibling tools (Chef/Puppet/Ansible) as one if the JD lists them as "or".
  * Use the canonical name users would search for ("AWS" not "Amazon Web Services", "K8s" → "Kubernetes").
  * SKIP pure soft skills (communication, teamwork, problem-solving, adaptability) unless the JD explicitly lists them as hard requirements with specifics.
- responsibilities: duties the role will perform, phrased as short sentences (e.g. "Maintain production Kubernetes clusters", "Review pull requests"). Cap at 8.
- experience: required background — years, industries, seniority, specific past roles. Cap at 6.
- summary: 1-2 sentences describing the role.

Return ONLY JSON matching the schema. Phrases must be unique within each list.`;

const SECTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sections: {
      type: 'object',
      additionalProperties: false,
      properties: {
        skills: { type: 'array', items: { type: 'string' } },
        responsibilities: { type: 'array', items: { type: 'string' } },
        experience: { type: 'array', items: { type: 'string' } },
      },
      required: ['skills', 'responsibilities', 'experience'],
    },
    summary: { type: 'string' },
  },
  required: ['sections', 'summary'],
};

/**
 * GPT call: decompose a CV or JD into skills/responsibilities/experience phrase arrays.
 * @param {string} text
 * @param {'cv'|'job'} kind
 * @returns {Promise<{ sections: { skills: string[], responsibilities: string[], experience: string[] }, summary: string }>}
 */
export async function extractSectionsAndSkills(text, kind) {
  const system = kind === 'cv' ? CV_SYSTEM : JOB_SYSTEM;
  const response = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: (text || '').slice(0, 8000) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'sections', schema: SECTIONS_SCHEMA, strict: true },
    },
  });
  const raw = response.choices[0].message.content;
  return JSON.parse(raw);
}

/**
 * Flatten sections object into a single ordered string array for batch embedding,
 * then fold the returned vectors back into the same shape.
 * @param {{ skills: string[], responsibilities: string[], experience: string[] }} sections
 * @returns {Promise<{ skills: Array<{text:string,vector:number[]}>, responsibilities: [...], experience: [...] }>}
 */
export async function embedSections(sections) {
  // Parallel arrays: `input` is what we send to the embedder (prefixed),
  // `bareByIndex` is what we store back as the phrase text.
  const input = [];
  const bareByIndex = [];
  const boundaries = {}; // { type: [startIdx, endIdx) }
  for (const type of SECTION_TYPES) {
    const items = (sections[type] || []).map((s) => (s || '').trim()).filter(Boolean);
    const prefix = PREFIX_BY_TYPE[type] || '';
    boundaries[type] = [input.length, input.length + items.length];
    for (const item of items) {
      input.push(prefix + item);
      bareByIndex.push(item);
    }
  }

  if (input.length === 0) {
    return { skills: [], responsibilities: [], experience: [] };
  }

  const resp = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input,
  });
  const vectors = resp.data.map((d) => d.embedding);

  const out = {};
  for (const type of SECTION_TYPES) {
    const [start, end] = boundaries[type];
    out[type] = [];
    for (let i = start; i < end; i++) {
      out[type].push({ text: bareByIndex[i], vector: vectors[i] });
    }
  }
  return out;
}

export { SECTION_TYPES };
