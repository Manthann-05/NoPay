import mongoose, { Schema, Document } from 'mongoose';

export interface IBillItem {
  productId?: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
}

export interface IBill extends Document {
  billId: string;
  merchantId: mongoose.Types.ObjectId;
  merchantName: string;
  customerId?: mongoose.Types.ObjectId;
  items: IBillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'CREATED' | 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BillItemSchema = new Schema<IBillItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
});

const BillSchema = new Schema<IBill>(
  {
    billId: { type: String, required: true, unique: true, index: true },
    merchantId: { type: Schema.Types.ObjectId, ref: 'MerchantProfile', required: true, index: true },
    merchantName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    items: [BillItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'PAID', 'EXPIRED', 'CANCELLED'],
      default: 'CREATED',
    },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

export const Bill = mongoose.models.Bill || mongoose.model<IBill>('Bill', BillSchema);
