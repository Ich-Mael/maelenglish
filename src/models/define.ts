import mongoose, { model, models, type Model } from "mongoose";

/**
 * Registers a model. In production the process starts fresh, so the first registration wins.
 * In development, Next.js hot reload re-runs the model files while Mongoose keeps the old model
 * (old enums and fields: « `activity` is not a valid enum value… »), so it is rebuilt each time.
 */
export function defineModel<T>(name: string, schema: Parameters<typeof model>[1]): Model<T> {
  if (models[name]) {
    if (process.env.NODE_ENV === "production") return models[name] as Model<T>;
    mongoose.deleteModel(name);
  }
  return model(name, schema) as unknown as Model<T>;
}
