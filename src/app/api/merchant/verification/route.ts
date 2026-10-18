import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequiredMerchantSession } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import {
  MERCHANT_VERIFICATION_BUSINESS_TYPES,
  serializeMerchantVerification,
} from '@/lib/merchant/verification';
import { merchantVerificationApiError } from '@/lib/merchant/verificationApiErrors';
import { MerchantProfile } from '@/models/MerchantProfile';

const VerificationDetailsSchema = z.object({
  legalBusinessName: z.string().trim().min(2).max(200),
  businessType: z.enum(MERCHANT_VERIFICATION_BUSINESS_TYPES),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
    .or(z.literal('')),
  businessAddress: z.string().trim().min(5).max(500),
});

export async function GET() {
  try {
    const session = await getRequiredMerchantSession();
    await connectToDatabase();
    const merchant = await MerchantProfile.findOne({
      _id: session.merchantProfileId,
      userId: session.userId,
    });

    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant profile not found or inactive.' }, { status: 404 });
    }

    return NextResponse.json({ verification: serializeMerchantVerification(merchant) });
  } catch (error: unknown) {
    return merchantVerificationApiError(error, 'Could not load shop verification details.');
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getRequiredMerchantSession();
    const parsed = VerificationDetailsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid merchant verification details.' },
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

    const detailsChanged =
      merchant.verificationLegalName !== parsed.data.legalBusinessName ||
      merchant.verificationBusinessType !== parsed.data.businessType ||
      merchant.verificationGstin !== parsed.data.gstin ||
      merchant.verificationAddress !== parsed.data.businessAddress;

    merchant.verificationLegalName = parsed.data.legalBusinessName;
    merchant.verificationBusinessType = parsed.data.businessType;
    merchant.verificationGstin = parsed.data.gstin;
    merchant.verificationAddress = parsed.data.businessAddress;

    if (
      detailsChanged &&
      (merchant.verificationStatus === 'VERIFIED' || merchant.verificationStatus === 'NEEDS_CHANGES')
    ) {
      merchant.verificationStatus = 'PENDING_REVIEW';
    }

    await merchant.save();
    return NextResponse.json({ verification: serializeMerchantVerification(merchant) });
  } catch (error: unknown) {
    return merchantVerificationApiError(error, 'Could not save shop verification details.');
  }
}
