import { NextResponse } from 'next/server';
import { getRequiredMerchantSession } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import {
  createPrivateDocumentReadStream,
  deletePrivateDocument,
} from '@/lib/storage/privateMongoDocuments';
import { merchantVerificationApiError } from '@/lib/merchant/verificationApiErrors';
import { MerchantProfile, type MerchantVerificationDocument } from '@/models/MerchantProfile';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getRequiredMerchantSession();
    const { documentId } = await params;
    await connectToDatabase();

    const merchant = await MerchantProfile.findOne({
      _id: session.merchantProfileId,
      userId: session.userId,
    }).select('+verificationDocuments.storageKey');

    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant profile not found or inactive.' }, { status: 404 });
    }

    const document = merchant.verificationDocuments.find(
      (entry: MerchantVerificationDocument) => entry.documentId === documentId
    );
    if (!document || document.status === 'UPLOADING') {
      return NextResponse.json({ error: 'Uploaded document not found.' }, { status: 404 });
    }

    const safeFileName = document.fileName.replace(/[\r\n"\\]/g, '_').slice(0, 180) || 'document';
    return new Response(createPrivateDocumentReadStream(document.storageKey), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    return merchantVerificationApiError(error, 'Could not download the private document.');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getRequiredMerchantSession();
    const { documentId } = await params;
    await connectToDatabase();

    const merchant = await MerchantProfile.findOne({
      _id: session.merchantProfileId,
      userId: session.userId,
    }).select('+verificationDocuments.storageKey');

    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant profile not found or inactive.' }, { status: 404 });
    }

    const document = merchant.verificationDocuments.find(
      (entry: MerchantVerificationDocument) => entry.documentId === documentId
    );
    if (!document) {
      return NextResponse.json({ error: 'Uploaded document not found.' }, { status: 404 });
    }

    await deletePrivateDocument(document.storageKey);
    merchant.verificationDocuments = merchant.verificationDocuments.filter(
      (entry: MerchantVerificationDocument) => entry.documentId !== documentId
    );

    if (merchant.verificationDocuments.length === 0) {
      merchant.verificationStatus = 'NOT_SUBMITTED';
      merchant.verificationSubmittedAt = undefined;
    } else if (merchant.verificationStatus === 'VERIFIED' || merchant.verificationStatus === 'NEEDS_CHANGES') {
      merchant.verificationStatus = 'PENDING_REVIEW';
      merchant.verificationSubmittedAt = new Date();
    }

    await merchant.save();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return merchantVerificationApiError(error, 'Could not remove the private document.');
  }
}
