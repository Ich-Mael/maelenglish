import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/**
 * One row per scheduled email run (`key` e.g. « coach-digest:2026-11-21 »): the unique key makes
 * sure a run happens once per day even with several server instances or restarts.
 */
const digestLogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    sentAt: { type: Date, default: Date.now },
    emails: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
  },
  { timestamps: false },
);
export type DigestLogDoc = InferSchemaType<typeof digestLogSchema> & { _id: Types.ObjectId };
export const DigestLog: Model<DigestLogDoc> = defineModel<DigestLogDoc>("DigestLog", digestLogSchema);
