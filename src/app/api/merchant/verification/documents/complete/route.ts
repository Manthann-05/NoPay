import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequiredMerchantSession } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import {
  InvalidPrivateDocumentUploadError,
  verifyPrivateDocumentUpload,
} from '@/lib/storage/privateS3';
import { merchantVerificationApiError } from '@/lib/merchant/verificationApiErrors';
import { MerchantProfile, type MerchantVerificationDocument } from '@/models/MerchantProfile';

export const runtime = 'nodejs';

const CompleteUploadSchema = z.object({
  documentId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const session = await getRequiredMerchantSession();
    const parsed = CompleteUploadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid document upload reference.' }, { status: 400 });
    }

    await connectToDatabase();
    const merchant = await MerchantProfile.findOne({
      _id: session.merchantProfileId,
      userId: session.userId,
    }).select('+verificationDocuments.storageKey');

    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant profile not found or inactive.' }, { status: 404 });
    }

    const document = merchant.verificationDocuments.find(
      (entry: MerchantVerificationDocument) => entry.documentId === parsed.data.documentId
    );
    if (!document || document.status !== 'UPLOADING') {
      return NextResponse.json({ error: 'Upload not found or already completed.' }, { status: 404 });
    }

    try {
      await verifyPrivateDocumentUpload(
        document.storageKey,
        document.contentType,
        document.sizeBytes
      );
    } catch (error: unknown) {
      if (error instanceof InvalidPrivateDocumentUploadError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    document.status = 'PENDING_REVIEW';
    document.uploadedAt = new Date();
    merchant.verificationStatus = 'PENDING_REVIEW';
    merchant.verificationSubmittedAt = new Date();
    await merchant.save();

    return NextResponse.json({
      documentId: document.documentId,
      status: document.status,
      verificationStatus: merchant.verificationStatus,
    });
  } catch (error: unknown) {
    return merchantVerificationApiError(error, 'Could not complete the private document upload.');
  }
}
