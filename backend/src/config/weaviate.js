import weaviate from 'weaviate-client';
import env from './env.js';

const CV_CLASS = 'CV';
const JOB_CLASS = 'Job';

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    const [host, portStr] = env.WEAVIATE_HOST.split(':');
    const port = parseInt(portStr, 10) || 8080;
    clientPromise = weaviate.connectToLocal({
      host,
      port,
      grpcPort: 50051,
    });
  }
  return clientPromise;
}

async function ensureCollection(client, name, properties) {
  const exists = await client.collections.exists(name);
  if (exists) return client.collections.get(name);
  return client.collections.create({
    name,
    vectorizers: weaviate.configure.vectorizer.none(),
    properties,
  });
}

export async function ensureSchema() {
  const client = await getClient();

  await ensureCollection(client, CV_CLASS, [
    { name: 'userId', dataType: 'int' },
    { name: 'cvId', dataType: 'int' },
    { name: 'text', dataType: 'text' },
  ]);

  await ensureCollection(client, JOB_CLASS, [
    { name: 'userId', dataType: 'int' },
    { name: 'jobId', dataType: 'int' },
    { name: 'text', dataType: 'text' },
  ]);

  console.log('Weaviate schema ready');
}

export async function getCvCollection() {
  const client = await getClient();
  return client.collections.get(CV_CLASS);
}

export async function getJobCollection() {
  const client = await getClient();
  return client.collections.get(JOB_CLASS);
}

export { CV_CLASS, JOB_CLASS };
