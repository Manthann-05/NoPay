import mongoose from 'mongoose';
import dns from 'node:dns';
import { getEnv } from '@/lib/env';

/**
 * Global is used here to maintain a cached connection across hot reloads in development.
 * This prevents connections growing exponentially during API Route execution.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const { MONGODB_URI } = getEnv();

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).catch(async (error: unknown) => {
      // Some Windows/network DNS configurations reject SRV lookups through
      // Node's default resolver even though the Atlas host is reachable.
      // Retry once with public resolvers; non-SRV URIs are never affected.
      const code = error && typeof error === 'object' && 'code' in error
        ? (error as { code?: string }).code
        : undefined;
      if (!MONGODB_URI.startsWith('mongodb+srv://') || code !== 'ECONNREFUSED') {
        throw error;
      }

      dns.setServers(['1.1.1.1', '8.8.8.8']);
      return mongoose.connect(MONGODB_URI, opts);
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
