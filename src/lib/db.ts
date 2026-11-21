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

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.APP_DB;
  if (!uri) {
    throw new Error("APP_DB is not set (MongoDB connection string).");
  }

  cache.promise ??= mongoose.connect(uri, { bufferCommands: false });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
