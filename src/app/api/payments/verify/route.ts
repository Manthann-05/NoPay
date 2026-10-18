import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/mongodb';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { AutoPayAttempt } from '@/models/AutoPayAttempt';
import { Bill } from '@/models/Bill';
import { Transaction } from '@/models/Transaction';
import { markTransactionPaymentCaptured } from '@/lib/payments/transactionPayment';
import { razorpayRequest } from '@/lib/payments/razorpay';
import { isBillExpired } from '@/lib/status/labels';

const VerifyPaymentSchema = z.object({
  transactionId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

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
    const parsed = VerifyPaymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing payment verification details.' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Online payment verification is not configured.' }, { status: 503 });
    }
    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${parsed.data.razorpay_order_id}|${parsed.data.razorpay_payment_id}`)
      .digest('hex');
    if (!signaturesMatch(expectedSignature, parsed.data.razorpay_signature)) {
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 });
    }

    await connectToDatabase();
    const transaction = await Transaction.findOne({
      transactionId: parsed.data.transactionId,
      customerId: session.userId,
    });
    if (!transaction) {
      return NextResponse.json({ error: 'Synced customer transaction not found.' }, { status: 404 });
    }
    if (
      transaction.razorpayOrderId !== parsed.data.razorpay_order_id ||
      (transaction.paymentReference && transaction.paymentReference !== parsed.data.razorpay_payment_id)
    ) {
      return NextResponse.json({ error: 'Payment does not match this transaction.' }, { status: 409 });
    }
    if (transaction.paymentStatus === 'PAID' && transaction.paymentReference === parsed.data.razorpay_payment_id) {
      return NextResponse.json({ success: true, transaction });
    }

    if (transaction.type === 'BILL_QR') {
      if (!transaction.billId) {
        return NextResponse.json({ error: 'This merchant bill is no longer payable.' }, { status: 409 });
      }
      const [bill, activeAttempt] = await Promise.all([
        Bill.findOne({ billId: transaction.billId }),
        AutoPayAttempt.findOne({
          billId: transaction.billId,
          status: { $in: ['SCHEDULING', 'SCHEDULED', 'CAPTURED', 'TRANSFER_PENDING', 'TRANSFERRED'] },
        }),
      ]);
      if (
        !bill ||
        bill.status === 'PAID' ||
        bill.status === 'CANCELLED' ||
        bill.status === 'EXPIRED' ||
        isBillExpired(bill.expiresAt) ||
        String(bill.merchantId) !== String(transaction.merchantId) ||
        String(bill.customerId) !== String(transaction.customerId) ||
        bill.transactionId !== transaction.transactionId ||
        Math.abs(Number(bill.total) - Number(transaction.amount)) >= 0.005
      ) {
        return NextResponse.json({ error: 'This merchant bill is no longer payable.' }, { status: 409 });
      }
      if (activeAttempt) {
        return NextResponse.json({ error: 'AutoPay collection is already in progress.' }, { status: 409 });
      }
    }

    const [order, payment] = await Promise.all([
      razorpayRequest<RazorpayOrder>(
        `/orders/${encodeURIComponent(parsed.data.razorpay_order_id)}`,
        'GET'
      ),
      razorpayRequest<RazorpayPayment>(
        `/payments/${encodeURIComponent(parsed.data.razorpay_payment_id)}`,
        'GET'
      ),
    ]);
    const amountPaise = Math.round(Number(transaction.amount) * 100);
    if (
      order.id !== parsed.data.razorpay_order_id ||
      order.id !== transaction.razorpayOrderId ||
      order.amount !== amountPaise ||
      order.currency !== 'INR' ||
      payment.id !== parsed.data.razorpay_payment_id ||
      payment.order_id !== order.id ||
      payment.amount !== amountPaise ||
      payment.currency !== 'INR'
    ) {
      return NextResponse.json({ error: 'Provider payment amount does not match this record.' }, { status: 409 });
    }
    if (payment.status !== 'captured' || payment.captured !== true) {
      return NextResponse.json(
        { error: 'The provider has not confirmed payment capture yet. Refresh and check again.' },
        { status: 409 }
      );
    }

    await markTransactionPaymentCaptured(transaction.transactionId, payment.id);
    if (transaction.type === 'BILL_QR' && transaction.billId) {
      await Bill.updateOne(
        { billId: transaction.billId, status: { $ne: 'PAID' } },
        { $set: { status: 'PAID', paymentReference: payment.id } }
      );
    }

    const updatedTransaction = await Transaction.findOne({ transactionId: transaction.transactionId });
    return NextResponse.json({
      success: true,
      transaction: updatedTransaction,
      message: 'Provider capture confirmed. Merchant payout status is shown separately.',
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('Payment Verification Error:', err);
    return NextResponse.json({ error: 'Payment verification failed.' }, { status: 500 });
  }
}
