import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequiredMerchantSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import { MerchantProfile } from '@/models/MerchantProfile';
import { isRazorpayRouteEnabled } from '@/lib/payments/razorpay';

const RouteAccountSchema = z.object({
  legalBusinessName: z.string().trim().min(4).max(200),
  businessType: z.enum([
    'individual',
    'proprietorship',
    'partnership',
    'private_limited',
    'public_limited',
    'llp',
    'ngo',
    'trust',
    'society',
    'other',
    'not_yet_registered',
  ]),
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/),
  gst: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9A-Z]{15}$/)
    .optional()
    .or(z.literal('')),
  category: z.enum([
    'education',
    'healthcare',
    'ecommerce',
    'food',
    'services',
    'housing',
    'others',
  ]),
  subcategory: z.string().trim().regex(/^[a-z_]{2,80}$/),
  street: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^[0-9]{6}$/),
  accountNumber: z.string().trim().regex(/^[0-9]{5,20}$/),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  beneficiaryName: z.string().trim().min(2).max(100),
  acceptedTerms: z.literal(true),
});

export async function GET() {
  try {
    const session = await getRequiredMerchantSession();
    await connectToDatabase();
    const merchant = await MerchantProfile.findOne({
      _id: session.merchantProfileId,
      userId: session.userId,
    }).select('razorpayLinkedAccountStatus razorpaySettlementStatus');

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant profile not found.' }, { status: 404 });
    }
    let status = merchant.razorpayLinkedAccountStatus || 'NOT_STARTED';
    let settlementStatus = merchant.razorpaySettlementStatus || 'NOT_STARTED';
    if (merchant.razorpayLinkedAccountId && isRazorpayRouteEnabled()) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
      }
      const providerResponse = await fetch(
        `https://api.razorpay.com/v2/accounts/${encodeURIComponent(merchant.razorpayLinkedAccountId)}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          },
          cache: 'no-store',
        }
      );
      const providerData = await providerResponse.json().catch(() => null);
      if (!providerResponse.ok) {
        return NextResponse.json(
          { error: 'Could not refresh Razorpay payout account status.' },
          { status: 502 }
        );
      }
      status =
        typeof providerData.status === 'string'
          ? providerData.status.toUpperCase()
          : status;
      const settlementAccount =
        providerData.product_config?.active_configuration?.settlement_accounts?.[0];
      if (settlementAccount?.verification_status === 'verified' && settlementAccount.active === true) {
        settlementStatus = 'VERIFIED';
      } else if (settlementAccount?.verification_status) {
        settlementStatus = String(settlementAccount.verification_status).toUpperCase();
      }
      await MerchantProfile.updateOne(
        { _id: merchant._id, userId: session.userId },
        {
          $set: {
            razorpayLinkedAccountStatus: status,
            razorpaySettlementStatus: settlementStatus,
          },
        }
      );
    }

    return NextResponse.json({
      enabled: isRazorpayRouteEnabled(),
      status,
      settlementStatus,
    });
  } catch (err: unknown) {
    return authErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredMerchantSession();
    if (!isRazorpayRouteEnabled()) {
      return NextResponse.json(
        { error: 'Merchant payouts are not enabled for this Razorpay account.' },
        { status: 503 }
      );
    }

    const parsed = RouteAccountSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid onboarding details.' }, { status: 400 });
    }

    await connectToDatabase();
    const merchant = await MerchantProfile.findOne({
      _id: session.merchantProfileId,
      userId: session.userId,
    }).select('+razorpayLinkedAccountId');

    if (!merchant || merchant.active === false) {
      return NextResponse.json({ error: 'Merchant profile not found or inactive.' }, { status: 404 });
    }
    if (merchant.razorpayLinkedAccountId) {
      return NextResponse.json({ error: 'A payout account has already been submitted.' }, { status: 409 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
    }

    const details = parsed.data;
    const providerResponse = await fetch('https://api.razorpay.com/v2/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        type: 'route',
        tnc_accepted: true,
        reference_id: merchant._id.toString(),
        legal_business_name: details.legalBusinessName,
        customer_facing_business_name: merchant.shopName,
        business_type: details.businessType,
        email: session.email,
        phone: details.phone,
        profile: {
          category: details.category,
          subcategory: details.subcategory,
          addresses: {
            registered: {
              street1: details.street,
              city: details.city,
              state: details.state,
              postal_code: details.postalCode,
              country: 'IN',
            },
          },
        },
        legal_info: {
          pan: details.pan,
          ...(details.gst ? { gst: details.gst } : {}),
        },
        settlement_accounts: [
          {
            method: 'bank_account',
            bank_account: {
              account_number: details.accountNumber,
              beneficiary_name: details.beneficiaryName,
              code_type: 'ifsc',
              code: details.ifsc,
              currency: 'INR',
              is_default: true,
            },
          },
        ],
      }),
      cache: 'no-store',
    });

    const providerData = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok || typeof providerData?.id !== 'string') {
      const errorCode =
        typeof providerData?.error?.code === 'string' ? providerData.error.code : 'ONBOARDING_FAILED';
      await MerchantProfile.updateOne(
        { _id: merchant._id, userId: session.userId },
        { $set: { razorpayLinkedAccountStatus: 'FAILED' } }
      );
      return NextResponse.json(
        { error: `Razorpay rejected the payout account details (${errorCode}). Please review the fields and retry.` },
        { status: 502 }
      );
    }

    const settlementAccount =
      providerData.product_config?.active_configuration?.settlement_accounts?.[0];
    await MerchantProfile.updateOne(
      { _id: merchant._id, userId: session.userId },
      {
        $set: {
          razorpayLinkedAccountId: providerData.id,
          razorpayLinkedAccountStatus: String(providerData.status || 'created').toUpperCase(),
          razorpaySettlementStatus: String(settlementAccount?.verification_status || 'PENDING').toUpperCase(),
        },
      }
    );

    return NextResponse.json({
      status: String(providerData.status || 'created').toUpperCase(),
      settlementStatus: String(settlementAccount?.verification_status || 'PENDING').toUpperCase(),
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('Route account onboarding failed:', err);
    return NextResponse.json({ error: 'Could not submit payout account details.' }, { status: 500 });
  }
}
