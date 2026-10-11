import mongoose, { Schema, type Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionId: string;
  merchantId: mongoose.Types.ObjectId;
  merchantName: string;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  billId?: string;
  billSummary?: {
    itemsCount: number;
    total: number;
  };
  amount: number;
  type: 'STATIC_QR' | 'BILL_QR';
  status: 'LOCAL_CREATED' | 'PENDING_SYNC' | 'SYNCING' | 'CONFIRMED' | 'FAILED' | 'REJECTED';
  idempotencyKey: string;
  paymentReference?: string;
  paymentStatus: 'UNVERIFIED' | 'PENDING' | 'AUTOPAY_SCHEDULED' | 'PAID' | 'FAILED';
  failureReason?: string;
  offlineCreated: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'MerchantProfile', required: true, index: true },
    merchantName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    customerName: { type: String },
    billId: { type: String, index: true },
    billSummary: {
      itemsCount: Number,
      total: Number,
    },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['STATIC_QR', 'BILL_QR'], required: true },
    status: {
      type: String,
      enum: ['LOCAL_CREATED', 'PENDING_SYNC', 'SYNCING', 'CONFIRMED', 'FAILED', 'REJECTED'],
      default: 'PENDING_SYNC',
    },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    paymentReference: { type: String },
    paymentStatus: {
      type: String,
      enum: ['UNVERIFIED', 'PENDING', 'AUTOPAY_SCHEDULED', 'PAID', 'FAILED'],
      default: 'UNVERIFIED',
      index: true,
    },
    failureReason: { type: String },
    offlineCreated: { type: Boolean, default: false },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

TransactionSchema.index({ merchantId: 1, createdAt: -1 });
TransactionSchema.index({ customerId: 1, createdAt: -1 });

export const Transaction =
  mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);
