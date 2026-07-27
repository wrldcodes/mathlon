import { MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? 'mathlon';

declare global {
  // Reused across warm serverless invocations + Next.js HMR in dev.
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('Missing MONGODB_URI. Add it to .env.local to enable sessions.');
  }
  const client = new MongoClient(uri, {
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
    heartbeatFrequencyMS: 30_000,
  });
  return client.connect();
}

async function getClientPromise(): Promise<MongoClient> {
  if (global._mongoClientPromise) {
    try {
      return await global._mongoClientPromise;
    } catch {
      // Stale or broken — clear the cache and create a new one.
      global._mongoClientPromise = undefined;
    }
  }

  global._mongoClientPromise = createClientPromise();
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}
