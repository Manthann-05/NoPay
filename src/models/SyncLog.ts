import mongoose, { Schema, type Document } from 'mongoose';

export interface ISyncLog extends Document {
  transactionId: string;
  idempotencyKey: string;
  attempts: number;
  lastAttemptAt: Date;
  state: 'PENDING_SYNC' | 'SYNCING' | 'CONFIRMED' | 'FAILED';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SyncLogSchema = new Schema<ISyncLog>(
  {
    transactionId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, index: true },
    attempts: { type: Number, default: 1 },
    lastAttemptAt: { type: Date, default: Date.now },
    state: { type: String, enum: ['PENDING_SYNC', 'SYNCING', 'CONFIRMED', 'FAILED'], required: true },
    error: { type: String },
  },
  { timestamps: true }
);

export const SyncLog = mongoose.models.SyncLog || mongoose.model<ISyncLog>('SyncLog', SyncLogSchema);
