import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequiredMerchantSession } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import {
  MERCHANT_VERIFICATION_DOCUMENT_TYPES,
  MERCHANT_VERIFICATION_MAX_DOCUMENTS,
  MERCHANT_VERIFICATION_MAX_FILE_BYTES,
} from '@/lib/merchant/verification';
import { createPrivateDocumentUpload } from '@/lib/storage/privateS3';
import { merchantVerificationApiError } from '@/lib/merchant/verificationApiErrors';
import { MerchantProfile } from '@/models/MerchantProfile';

export const runtime = 'nodejs';

const UploadRequestSchema = z.object({
  documentType: z.enum(MERCHANT_VERIFICATION_DOCUMENT_TYPES),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  sizeBytes: z.number().int().min(1).max(MERCHANT_VERIFICATION_MAX_FILE_BYTES),
});

export async function POST(request: Request) {
  try {
    const session = await getRequiredMerchantSession();
    const parsed = UploadRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid document upload.' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const merchant = await MerchantProfile.findOne({
      _id: session.merchantProfileId,
      userId: session.userId,
    });

    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant profile not found or inactive.' }, { status: 404 });
    }
    if (
      !merchant.verificationLegalName ||
      !merchant.verificationBusinessType ||
      !merchant.verificationAddress
    ) {
      return NextResponse.json(
        { error: 'Save the legal business name, structure, and registered address before uploading documents.' },
        { status: 409 }
      );
    }
    if (merchant.verificationDocuments.length >= MERCHANT_VERIFICATION_MAX_DOCUMENTS) {
      return NextResponse.json(
        { error: 'This shop has reached the document limit. Contact support to replace an existing submission.' },
        { status: 409 }
      );
    }

    const documentId = randomUUID();
    const safeFileName = parsed.data.fileName.replace(/[\\/:\r\n]/g, '_');
    const storageKey = `merchant-verification/${merchant._id.toString()}/${documentId}`;
    const upload = await createPrivateDocumentUpload(storageKey, parsed.data.contentType);

    merchant.verificationDocuments.push({
      documentId,
      documentType: parsed.data.documentType,
      fileName: safeFileName,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      storageKey,
      status: 'UPLOADING',
    });
    await merchant.save();

    return NextResponse.json({
      documentId,
      uploadUrl: upload.url,
      fields: upload.fields,
    });
  } catch (error: unknown) {
    return merchantVerificationApiError(error, 'Could not prepare the private document upload.');
  }
}
