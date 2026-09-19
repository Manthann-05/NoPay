import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  try {
    const { amount, transactionId } = await req.json();

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Online payment processing is not configured. Payment verification requires Razorpay credentials.' },
        { status: 503 }
      );
    }

    const orderId = `order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

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
  } catch (err: any) {
    console.error('Razorpay Create Order Error:', err);
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
  }
}
