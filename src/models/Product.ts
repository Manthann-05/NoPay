import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  merchantId: mongoose.Types.ObjectId;
  name: string;
  barcode?: string;
  price: number;
  stock: number;
  category?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'MerchantProfile', required: true, index: true },
    name: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    category: { type: String, default: 'General', trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ merchantId: 1, barcode: 1 });
ProductSchema.index({ merchantId: 1, name: 'text' });

export const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
