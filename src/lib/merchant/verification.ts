import type { IMerchantProfile } from '@/models/MerchantProfile';

export const MERCHANT_VERIFICATION_BUSINESS_TYPES = [
  'individual',
  'proprietorship',
  'partnership',
  'private_limited',
  'public_limited',
  'llp',
  'other',
] as const;

export const MERCHANT_VERIFICATION_DOCUMENT_TYPES = [
  'GST_CERTIFICATE',
  'PAN',
  'SHOP_LICENSE',
  'BUSINESS_ADDRESS_PROOF',
  'BUSINESS_REGISTRATION',
  'OWNER_ID',
  'OTHER',
] as const;

export const MERCHANT_VERIFICATION_DOCUMENT_LABELS: Record<
  (typeof MERCHANT_VERIFICATION_DOCUMENT_TYPES)[number],
  string
> = {
  GST_CERTIFICATE: 'GST registration certificate',
  PAN: 'PAN document',
  SHOP_LICENSE: 'Shop and establishment / trade licence',
  BUSINESS_ADDRESS_PROOF: 'Business address proof',
  BUSINESS_REGISTRATION: 'Business registration / incorporation proof',
  OWNER_ID: 'Owner or authorised representative ID',
  OTHER: 'Other supporting document',
};

export const MERCHANT_VERIFICATION_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MERCHANT_VERIFICATION_MAX_DOCUMENTS = 20;

export function serializeMerchantVerification(merchant: IMerchantProfile) {
  return {
    shopName: merchant.shopName,
    legalBusinessName: merchant.verificationLegalName || '',
    businessType: merchant.verificationBusinessType || '',
    gstin: merchant.verificationGstin || '',
    businessAddress: merchant.verificationAddress || '',
    status: merchant.verificationStatus || 'NOT_SUBMITTED',
    submittedAt: merchant.verificationSubmittedAt?.toISOString() || null,
    documents: (merchant.verificationDocuments || []).map((document) => ({
      documentId: document.documentId,
      documentType: document.documentType,
      fileName: document.fileName,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      uploadedAt: document.uploadedAt?.toISOString() || null,
    })),
  };
}
