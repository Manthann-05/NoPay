import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import { AutoPayMandate } from '@/models/AutoPayMandate';
import { getRazorpay, isRazorpayAutoPayEnabled } from '@/lib/payments/razorpay';

const VerifySchema = z.object({
  mandateId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return (
    expectedBuffer.length === receivedBuffer.length &&
    expectedBuffer.length > 0 &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    if (!session.roles.includes('CUSTOMER')) {
      return NextResponse.json({ error: 'Customer access is required.' }, { status: 403 });
    }
    if (!isRazorpayAutoPayEnabled()) {
      return NextResponse.json({ error: 'Merchant AutoPay is not enabled.' }, { status: 503 });
    }

    const parsed = VerifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing mandate verification details.' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
    }

    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${parsed.data.razorpay_order_id}|${parsed.data.razorpay_payment_id}`)
      .digest('hex');
    if (!signaturesMatch(expectedSignature, parsed.data.razorpay_signature)) {
      return NextResponse.json({ error: 'Mandate authorization could not be verified.' }, { status: 400 });
    }

    await connectToDatabase();
    const mandate = await AutoPayMandate.findOne({
      _id: parsed.data.mandateId,
      customerId: session.userId,
      razorpayOrderId: parsed.data.razorpay_order_id,
      status: 'PENDING',
    }).select('+razorpayCustomerId +razorpayOrderId');
    if (!mandate) {
      return NextResponse.json({ error: 'Pending mandate not found.' }, { status: 404 });
    }

    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(parsed.data.razorpay_payment_id);
    if (
      payment.order_id !== mandate.razorpayOrderId ||
      payment.customer_id !== mandate.razorpayCustomerId ||
      payment.method !== 'upi'
    ) {
      return NextResponse.json({ error: 'Provider payment does not match this mandate.' }, { status: 400 });
    }
    if (payment.status === 'failed') {
      mandate.status = 'FAILED';
      await mandate.save();
      return NextResponse.json({ status: mandate.status, error: 'UPI mandate authorization failed.' }, { status: 409 });
    }
    if (!payment.captured || !payment.token_id) {
      return NextResponse.json({ status: 'PENDING', message: 'Waiting for Razorpay to confirm the UPI mandate.' }, { status: 202 });
    }

    const token = await razorpay.tokens.fetch({ id: payment.token_id });
    if (
      token.customer_id !== mandate.razorpayCustomerId ||
      token.recurring_details?.status === 'rejected' ||
      token.recurring_details?.status === 'cancelled'
    ) {
      mandate.status = 'FAILED';
      await mandate.save();
      return NextResponse.json({ status: mandate.status, error: 'Razorpay did not activate this UPI mandate.' }, { status: 409 });
    }

    if (token.recurring_details?.status !== 'confirmed' && token.status !== 'active') {
      return NextResponse.json({ status: 'PENDING', message: 'Waiting for the bank to activate the UPI mandate.' }, { status: 202 });
    }

    mandate.razorpayTokenId = token.id;
    mandate.status = 'ACTIVE';
    mandate.activatedAt = new Date();
    await mandate.save();

    return NextResponse.json({ status: mandate.status, expiresAt: mandate.expiresAt });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('AutoPay mandate verification failed:', err);
    return NextResponse.json({ error: 'Could not verify mandate authorization.' }, { status: 500 });
  }
}
