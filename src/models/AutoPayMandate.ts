import mongoose, { Schema, type Document } from 'mongoose';

export type AutoPayMandateStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'CANCELLATION_PENDING'
  | 'REVOKED'
  | 'FAILED';

export interface IAutoPayMandate extends Document {
  customerId: mongoose.Types.ObjectId;
  merchantId: mongoose.Types.ObjectId;
  razorpayCustomerId: string;
  razorpayOrderId: string;
  razorpayTokenId?: string;
  maxAmount: number;
  status: AutoPayMandateStatus;
  consentVersion: string;
  consentAt: Date;
  expiresAt: Date;
  activatedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AutoPayMandateSchema = new Schema<IAutoPayMandate>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'MerchantProfile', required: true, index: true },
    razorpayCustomerId: { type: String, required: true, select: false },
    razorpayOrderId: { type: String, required: true, select: false, unique: true },
    razorpayTokenId: { type: String, select: false },
    maxAmount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'CANCELLATION_PENDING', 'REVOKED', 'FAILED'],
      required: true,
      default: 'PENDING',
      index: true,
    },
    consentVersion: { type: String, required: true },
    consentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    activatedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

AutoPayMandateSchema.index(
  { customerId: 1, merchantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['PENDING', 'ACTIVE', 'CANCELLATION_PENDING'] },
    },
  }
);

export const AutoPayMandate =
  mongoose.models.AutoPayMandate ||
  mongoose.model<IAutoPayMandate>('AutoPayMandate', AutoPayMandateSchema);
