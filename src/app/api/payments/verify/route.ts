import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Transaction } from '@/models/Transaction';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !transactionId) {
      return NextResponse.json({ error: 'Missing payment verification details' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { error: 'Online payment verification is not configured.' },
        { status: 503 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 });
    }

    await connectToDatabase();

    const txn = await Transaction.findOneAndUpdate(
      {
        transactionId,
        customerId: session.userId,
      },
      {
        status: 'CONFIRMED',
        paymentReference: razorpay_payment_id,
        syncedAt: new Date(),
      },
      { new: true }
    );

    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Transaction Confirmed',
      transaction: txn,
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('Payment Verification Error:', err);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
