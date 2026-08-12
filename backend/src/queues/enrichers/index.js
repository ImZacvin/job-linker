import { enrichGlints } from './glints.js';
import { enrichSeek } from './seek.js';
import { enrichLinkedIn } from './linkedin.js';
import { enrichJobStreet } from './jobstreet.js';

const ENRICHERS = {
  glints: enrichGlints,
  seek: enrichSeek,
  linkedin: enrichLinkedIn,
  jobstreet: enrichJobStreet,
};

export async function runEnricher(platform, job) {
  const fn = ENRICHERS[platform];
  if (!fn) {
    throw new Error(`No enricher for platform: ${platform}`);
  }
  return fn(job);
}

export { ENRICHERS };
