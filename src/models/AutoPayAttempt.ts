import mongoose, { Schema, type Document } from 'mongoose';

export type AutoPayAttemptStatus =
  | 'SCHEDULING'
  | 'SCHEDULED'
  | 'CAPTURED'
  | 'FAILED'
  | 'TRANSFER_PENDING'
  | 'TRANSFERRED'
  | 'TRANSFER_FAILED';

export interface IAutoPayAttempt extends Document {
  billId: string;
  transactionId: string;
  customerId: mongoose.Types.ObjectId;
  merchantId: mongoose.Types.ObjectId;
  mandateId: mongoose.Types.ObjectId;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayTransferId?: string;
  amountPaise: number;
  status: AutoPayAttemptStatus;
  paymentAfter: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AutoPayAttemptSchema = new Schema<IAutoPayAttempt>(
  {
    billId: { type: String, required: true, unique: true, index: true },
    transactionId: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'MerchantProfile', required: true, index: true },
    mandateId: { type: Schema.Types.ObjectId, ref: 'AutoPayMandate', required: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpayTransferId: { type: String },
    amountPaise: { type: Number, required: true, min: 100 },
    status: {
      type: String,
      enum: [
        'SCHEDULING',
        'SCHEDULED',
        'CAPTURED',
        'FAILED',
        'TRANSFER_PENDING',
        'TRANSFERRED',
        'TRANSFER_FAILED',
      ],
      required: true,
      default: 'SCHEDULING',
      index: true,
    },
    paymentAfter: { type: Date, required: true },
    failureReason: { type: String },
  },
  { timestamps: true }
);

export const AutoPayAttempt =
  mongoose.models.AutoPayAttempt ||
  mongoose.model<IAutoPayAttempt>('AutoPayAttempt', AutoPayAttemptSchema);
