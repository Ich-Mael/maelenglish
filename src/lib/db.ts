import "server-only";
import mongoose from "mongoose";

/**
 * Cached Mongoose connection. In dev, Next.js reloads modules on every change,
 * so the connection promise is kept on `globalThis` to avoid opening a new
 * connection pool each time.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose._mongoose ??= {
  conn: null,
  promise: null,
});

/**
 * Indexes replaced by a new definition: Mongoose creates new indexes but never drops old ones.
 * - assignmentsubmissions: the unique index gained `unitId` (several unit challenges per module).
 */
const LEGACY_INDEXES: [collection: string, index: string][] = [["assignmentsubmissions", "userId_1_courseId_1_moduleId_1_assignmentType_1"]];

async function dropLegacyIndexes(m: typeof mongoose) {
  for (const [collection, index] of LEGACY_INDEXES) {
    await m.connection
      .collection(collection)
      .dropIndex(index)
      .catch(() => {}); // already gone (or the collection doesn't exist yet)
  }
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.APP_DB;
  if (!uri) {
    throw new Error("APP_DB is not set (MongoDB connection string).");
  }

  cache.promise ??= mongoose.connect(uri, { bufferCommands: false }).then(async (m) => {
    await dropLegacyIndexes(m);
    return m;
  });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
