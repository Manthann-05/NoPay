import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import { AutoPayMandate } from '@/models/AutoPayMandate';
import { MerchantProfile } from '@/models/MerchantProfile';
import { User } from '@/models/User';
import {
  isRazorpayAutoPayEnabled,
  isRazorpayRouteEnabled,
  razorpayRequest,
} from '@/lib/payments/razorpay';

const CreateMandateSchema = z.object({
  merchantId: z.string().min(1),
  maxAmount: z.number().finite().min(1).max(99999),
  contact: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
  consentAccepted: z.literal(true),
});

const CONSENT_VERSION = 'merchant-autopay-v1';
const MANDATE_VALIDITY_DAYS = 365;

export async function GET() {
  try {
    const session = await getRequiredSession();
    if (!session.roles.includes('CUSTOMER')) {
      return NextResponse.json({ error: 'Customer access is required.' }, { status: 403 });
    }

    await connectToDatabase();
    const merchants = await MerchantProfile.find({
      active: true,
      razorpayLinkedAccountStatus: { $in: ['CREATED', 'ACTIVATED', 'ACTIVE'] },
      razorpaySettlementStatus: 'VERIFIED',
    })
      .select('shopName area')
      .sort({ shopName: 1 })
      .lean();
    const mandates = await AutoPayMandate.find({ customerId: session.userId })
      .select('merchantId maxAmount status consentAt expiresAt activatedAt revokedAt')
      .lean();
    const mandateMerchants = await MerchantProfile.find({
      _id: { $in: mandates.map((mandate) => mandate.merchantId) },
    })
      .select('shopName')
      .lean();
    const merchantNames = new Map(
      mandateMerchants.map((merchant) => [String(merchant._id), merchant.shopName])
    );

    return NextResponse.json({
      enabled: isRazorpayAutoPayEnabled() && isRazorpayRouteEnabled(),
      merchants: merchants.map((merchant) => ({
        merchantId: String(merchant._id),
        shopName: merchant.shopName,
        area: merchant.area,
      })),
      mandates: mandates.map((mandate) => ({
        id: String(mandate._id),
        merchantId: String(mandate.merchantId),
        merchantName: merchantNames.get(String(mandate.merchantId)) || 'Merchant',
        maxAmount: mandate.maxAmount,
        status: mandate.status,
        consentAt: mandate.consentAt,
        expiresAt: mandate.expiresAt,
        activatedAt: mandate.activatedAt,
        revokedAt: mandate.revokedAt,
      })),
    });
  } catch (err: unknown) {
    return authErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    if (!session.roles.includes('CUSTOMER')) {
      return NextResponse.json({ error: 'Customer access is required.' }, { status: 403 });
    }
    if (!isRazorpayAutoPayEnabled() || !isRazorpayRouteEnabled()) {
      return NextResponse.json(
        { error: 'Merchant AutoPay is not enabled for this Razorpay account.' },
        { status: 503 }
      );
    }

    const parsed = CreateMandateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid mandate details.' }, { status: 400 });
    }

    await connectToDatabase();
    const [customer, merchant] = await Promise.all([
      User.findById(session.userId).select('name email'),
      MerchantProfile.findOne({
        _id: parsed.data.merchantId,
        active: true,
        razorpayLinkedAccountStatus: { $in: ['CREATED', 'ACTIVATED', 'ACTIVE'] },
        razorpaySettlementStatus: 'VERIFIED',
      }).select('shopName'),
    ]);

    if (!customer) {
      return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
    }
    if (!merchant) {
      return NextResponse.json({ error: 'This merchant is not enabled for provider-verified payouts.' }, { status: 409 });
    }

    const existingMandate = await AutoPayMandate.findOne({
      customerId: customer._id,
      merchantId: merchant._id,
      status: { $in: ['PENDING', 'ACTIVE', 'CANCELLATION_PENDING'] },
    }).select('_id');
    if (existingMandate) {
      return NextResponse.json(
        { error: 'An active or pending mandate already exists for this merchant.' },
        { status: 409 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
    }

    const providerCustomer = await razorpayRequest<{ id: string }>('/customers', 'POST', {
      name: customer.name,
      email: customer.email,
      contact: parsed.data.contact,
      fail_existing: 0,
      notes: {
        nopay_user_id: String(customer._id),
        nopay_merchant_id: String(merchant._id),
      },
    });

    const expiresAt = new Date(Date.now() + MANDATE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    const order = await razorpayRequest<{ id: string; amount: number; currency: string }>(
      '/orders',
      'POST',
      {
      amount: 100,
      currency: 'INR',
      method: 'upi',
      customer_id: providerCustomer.id,
      receipt: `np_${randomUUID().replace(/-/g, '')}`,
      description: `NoPay ${merchant.shopName}`.slice(0, 49),
      token: {
        max_amount: Math.round(parsed.data.maxAmount * 100),
        expire_at: Math.floor(expiresAt.getTime() / 1000),
        frequency: 'as_presented',
      },
      notes: {
        nopay_user_id: String(customer._id),
        nopay_merchant_id: String(merchant._id),
        consent_version: CONSENT_VERSION,
      },
      }
    );

    const mandate = await AutoPayMandate.create({
      customerId: customer._id,
      merchantId: merchant._id,
      razorpayCustomerId: providerCustomer.id,
      razorpayOrderId: order.id,
      maxAmount: parsed.data.maxAmount,
      status: 'PENDING',
      consentVersion: CONSENT_VERSION,
      consentAt: new Date(),
      expiresAt,
    });

    return NextResponse.json({
      mandateId: String(mandate._id),
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      merchantName: merchant.shopName,
      customerName: customer.name,
      customerEmail: customer.email,
      customerContact: parsed.data.contact,
      expiresAt,
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('AutoPay mandate creation failed:', err);
    return NextResponse.json({ error: 'Could not start mandate authorization.' }, { status: 500 });
  }
}
