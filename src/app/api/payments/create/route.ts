import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';

export async function POST(req: Request) {
  try {
    await getRequiredSession();
    const { amount, transactionId } = await req.json();

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Online payment is not configured. Transactions can still be saved and synced.' },
        { status: 503 }
      );
    }

    const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await instance.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: String(transactionId || `rcpt_${Date.now()}`),
    });

    return NextResponse.json({
      success: true,
      keyId,
      order,
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('Razorpay Create Order Error:', err);
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
  }
}
