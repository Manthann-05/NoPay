import mongoose, { Schema, type Document } from 'mongoose';

export interface MerchantVerificationDocument {
  documentId: string;
  documentType: string;
  fileName: string;
  contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  storageKey: string;
  status: 'UPLOADING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  uploadedAt?: Date;
}

export interface IMerchantProfile extends Document {
  userId: mongoose.Types.ObjectId;
  shopName: string;
  address: string;
  area: string;
  staticQrPayload: string;
  verificationLegalName?: string;
  verificationBusinessType?: string;
  verificationGstin?: string;
  verificationAddress?: string;
  verificationStatus: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'NEEDS_CHANGES' | 'VERIFIED';
  verificationSubmittedAt?: Date;
  verificationDocuments: MerchantVerificationDocument[];
  razorpayLinkedAccountId?: string;
  razorpayLinkedAccountStatus?: string;
  razorpaySettlementStatus?: string;
  version: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MerchantVerificationDocumentSchema = new Schema(
  {
    documentId: { type: String, required: true },
    documentType: {
      type: String,
      required: true,
      enum: [
        'GST_CERTIFICATE',
        'PAN',
        'SHOP_LICENSE',
        'BUSINESS_ADDRESS_PROOF',
        'BUSINESS_REGISTRATION',
        'OWNER_ID',
        'OTHER',
      ],
    },
    fileName: { type: String, required: true, maxlength: 180 },
    contentType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
    sizeBytes: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    storageKey: { type: String, required: true, select: false },
    status: {
      type: String,
      required: true,
      enum: ['UPLOADING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'UPLOADING',
    },
    uploadedAt: { type: Date },
  },
  { _id: false }
);

const MerchantProfileSchema = new Schema<IMerchantProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    shopName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    staticQrPayload: { type: String, required: true },
    verificationLegalName: { type: String, trim: true, maxlength: 200 },
    verificationBusinessType: {
      type: String,
      enum: ['individual', 'proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp', 'other'],
    },
    verificationGstin: { type: String, trim: true, uppercase: true, maxlength: 15 },
    verificationAddress: { type: String, trim: true, maxlength: 500 },
    verificationStatus: {
      type: String,
      enum: ['NOT_SUBMITTED', 'PENDING_REVIEW', 'NEEDS_CHANGES', 'VERIFIED'],
      default: 'NOT_SUBMITTED',
    },
    verificationSubmittedAt: { type: Date },
    verificationDocuments: { type: [MerchantVerificationDocumentSchema], default: [] },
    razorpayLinkedAccountId: { type: String, select: false },
    razorpayLinkedAccountStatus: { type: String, default: 'NOT_STARTED' },
    razorpaySettlementStatus: { type: String, default: 'NOT_STARTED' },
    version: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const MerchantProfile =
  mongoose.models.MerchantProfile ||
  mongoose.model<IMerchantProfile>('MerchantProfile', MerchantProfileSchema);
