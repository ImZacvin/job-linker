import '../src/config/env.js';
import { runEnricher } from '../src/queues/enrichers/index.js';

const [, , platform = 'linkedin', externalId = '4299322636', url] = process.argv;

const job = {
  external_id: externalId,
  url: url || `https://www.linkedin.com/jobs/view/${externalId}`,
};

console.log(`Running ${platform} enricher for id=${externalId}`);
console.log(`  url=${job.url}`);

const t0 = Date.now();
const result = await runEnricher(platform, job);
const ms = Date.now() - t0;

const desc = result?.description ?? null;
console.log(`\nElapsed: ${ms}ms`);
console.log(`Description length: ${desc?.length ?? 0}`);
console.log('\n----- preview (first 600 chars) -----');
console.log(desc ? desc.slice(0, 600) : '(null)');
console.log('\n----- preview (last 300 chars) -----');
console.log(desc ? desc.slice(-300) : '(null)');
