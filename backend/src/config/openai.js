import OpenAI from 'openai';
import env from './env.js';

if (!env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not set — embedding and matching will fail');
}

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export default openai;
