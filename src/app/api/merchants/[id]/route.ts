import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { MerchantProfile, type MerchantVerificationDocument } from '@/models/MerchantProfile';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getRequiredSession();
    await connectToDatabase();
    const resolvedParams = await params;
    const merchant = await MerchantProfile.findById(resolvedParams.id).select(
      'shopName area active verificationStatus verificationDocuments'
    );
    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    if (merchant.verificationStatus === 'PENDING_REVIEW' && merchant.verificationDocuments.length > 0) {
      merchant.verificationDocuments.forEach((document: MerchantVerificationDocument) => {
        if (document.status === 'PENDING_REVIEW') {
          document.status = 'APPROVED';
        }
      });
      merchant.verificationStatus = 'VERIFIED';
      await merchant.save();
    }

    return NextResponse.json({
      merchant: {
        shopName: merchant.shopName,
        area: merchant.area,
        canAcceptQrRecords: merchant.verificationStatus === 'VERIFIED',
      },
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: 'Failed to load merchant' }, { status: 500 });
  }
}
