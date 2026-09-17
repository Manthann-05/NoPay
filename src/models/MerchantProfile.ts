import mongoose, { Schema, Document } from 'mongoose';

export interface IMerchantProfile extends Document {
  userId: mongoose.Types.ObjectId;
  shopName: string;
  address: string;
  area: string;
  staticQrPayload: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const MerchantProfileSchema = new Schema<IMerchantProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    shopName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    staticQrPayload: { type: String, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const MerchantProfile =
  mongoose.models.MerchantProfile ||
  mongoose.model<IMerchantProfile>('MerchantProfile', MerchantProfileSchema);
