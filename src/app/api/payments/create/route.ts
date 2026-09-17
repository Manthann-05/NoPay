import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/jwt';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  try {
    const { amount, transactionId } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_nopay_key_123';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'nopay_razorpay_secret_456';

    const orderId = `order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    // Try initializing actual Razorpay if keys are configured, otherwise provide clean test mock order
    let orderData = {
      id: orderId,
      entity: 'order',
      amount: Math.round(amount * 100), // amount in paise
      amount_paid: 0,
      amount_due: Math.round(amount * 100),
      currency: 'INR',
      receipt: transactionId || `rcpt_${Date.now()}`,
      status: 'created',
      attempts: 0,
      created_at: Math.floor(Date.now() / 1000),
    };

    if (keyId.startsWith('rzp_live') || keyId.startsWith('rzp_test_real')) {
      const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const order = await instance.orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: transactionId,
      });
      orderData = order as any;
    }

    return NextResponse.json({
      success: true,
      keyId,
      order: orderData,
    });
  } catch (err: any) {
    console.error('Razorpay Create Order Error:', err);
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
  }
}
