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
import {
  deletePrivateDocument,
  savePrivateDocument,
  verifyPrivateDocumentContent,
} from '@/lib/storage/privateMongoDocuments';
import { merchantVerificationApiError } from '@/lib/merchant/verificationApiErrors';
import { MerchantProfile } from '@/models/MerchantProfile';

export const runtime = 'nodejs';

const UploadRequestSchema = z.object({
  documentType: z.enum(MERCHANT_VERIFICATION_DOCUMENT_TYPES),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
});

export async function POST(request: Request) {
  try {
    const session = await getRequiredMerchantSession();
    const contentLength = request.headers.get('content-length');
    if (
      contentLength &&
      Number.isFinite(Number(contentLength)) &&
      Number(contentLength) > MERCHANT_VERIFICATION_MAX_FILE_BYTES + 64 * 1024
    ) {
      return NextResponse.json({ error: 'Choose a file no larger than 10 MB.' }, { status: 413 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Could not read the uploaded document form.' }, { status: 400 });
    }
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a PDF, JPEG, or PNG document to upload.' }, { status: 400 });
    }

    const parsed = UploadRequestSchema.safeParse({
      documentType: formData.get('documentType'),
      contentType: file.type,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid document upload.' },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MERCHANT_VERIFICATION_MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Choose a non-empty file no larger than 10 MB.' }, { status: 400 });
    }

    const fileName = file.name.trim().replace(/[\\/:\r\n]/g, '_').slice(0, 180);
    if (!fileName) {
      return NextResponse.json({ error: 'The uploaded file must have a valid name.' }, { status: 400 });
    }

    const fileBytes = Buffer.from(await file.arrayBuffer());
    if (!verifyPrivateDocumentContent(parsed.data.contentType, fileBytes)) {
      return NextResponse.json(
        { error: 'Uploaded file content is not a supported PDF, JPEG, or PNG document.' },
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
    const storageKey = await savePrivateDocument(fileName, parsed.data.contentType, fileBytes);

    merchant.verificationDocuments.push({
      documentId,
      documentType: parsed.data.documentType,
      fileName,
      contentType: parsed.data.contentType,
      sizeBytes: fileBytes.length,
      storageKey,
      status: 'PENDING_REVIEW',
      uploadedAt: new Date(),
    });
    merchant.verificationStatus = 'PENDING_REVIEW';
    merchant.verificationSubmittedAt = new Date();

    try {
      await merchant.save();
    } catch (error: unknown) {
      try {
        await deletePrivateDocument(storageKey);
      } catch (cleanupError: unknown) {
        console.error('Could not clean up a document after its metadata failed to save:', cleanupError);
      }
      throw error;
    }

    return NextResponse.json({ documentId, status: 'PENDING_REVIEW' });
  } catch (error: unknown) {
    return merchantVerificationApiError(error, 'Could not prepare the private document upload.');
  }
}
