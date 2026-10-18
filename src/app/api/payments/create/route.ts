import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getRequiredSession, authErrorResponse } from '@/lib/auth/apiGuards';
import { connectToDatabase } from '@/lib/db/mongodb';
import { AutoPayAttempt } from '@/models/AutoPayAttempt';
import { Bill } from '@/models/Bill';
import { MerchantProfile } from '@/models/MerchantProfile';
import { Transaction } from '@/models/Transaction';
import { isRazorpayRouteEnabled, razorpayRequest } from '@/lib/payments/razorpay';
import { isBillExpired } from '@/lib/status/labels';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

const CreatePaymentSchema = z.object({ transactionId: z.string().trim().min(1) });

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    const parsed = CreatePaymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'A transaction ID is required.' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Online payment is not configured. Transactions can still be saved and synced.' },
        { status: 503 }
      );
    }

    await connectToDatabase();
    const transaction = await Transaction.findOne({
      transactionId: parsed.data.transactionId,
      customerId: session.userId,
    });
    if (!transaction) {
      return NextResponse.json({ error: 'Synced customer transaction not found.' }, { status: 404 });
    }
    if (transaction.status !== 'CONFIRMED' && transaction.status !== 'SYNCED') {
      return NextResponse.json({ error: 'Sync this transaction before paying online.' }, { status: 409 });
    }
    if (transaction.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'This transaction is already paid.' }, { status: 409 });
    }

    if (!isRazorpayRouteEnabled()) {
      return NextResponse.json(
        { error: 'Online merchant payments are not enabled for this NoPay environment.' },
        { status: 503 }
      );
    }
    const merchant = await MerchantProfile.findById(transaction.merchantId).select(
      '+razorpayLinkedAccountId razorpayLinkedAccountStatus razorpaySettlementStatus shopName'
    );
    if (
      !merchant?.razorpayLinkedAccountId ||
      merchant.active === false ||
      !['CREATED', 'ACTIVATED', 'ACTIVE'].includes(merchant.razorpayLinkedAccountStatus || '') ||
      merchant.razorpaySettlementStatus !== 'VERIFIED'
    ) {
      return NextResponse.json(
        { error: 'This merchant has not completed verified online payout setup.' },
        { status: 409 }
      );
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
        return NextResponse.json(
          { error: 'AutoPay collection is already in progress. Do not make a second payment.' },
          { status: 409 }
        );
      }
    }

    const amount = Math.round(Number(transaction.amount) * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) {
      return NextResponse.json({ error: 'This transaction amount cannot be paid online.' }, { status: 400 });
    }

    let order: RazorpayOrder;
    if (transaction.razorpayOrderId) {
      order = await razorpayRequest<RazorpayOrder>(`/orders/${encodeURIComponent(transaction.razorpayOrderId)}`, 'GET');
      if (order.status === 'paid') {
        return NextResponse.json({ error: 'A payment is already being verified. Refresh your transaction history.' }, { status: 409 });
      }
      if (order.amount !== amount || order.currency !== 'INR') {
        return NextResponse.json({ error: 'The existing payment order does not match this transaction.' }, { status: 409 });
      }
    } else {
      const createdOrder = await razorpayRequest<RazorpayOrder>('/orders', 'POST', {
        amount,
        currency: 'INR',
        payment_capture: true,
        receipt: `np_${randomUUID().replace(/-/g, '')}`,
        notes: {
          nopay_transaction_id: transaction.transactionId,
          nopay_customer_id: String(transaction.customerId),
        },
      });
      const claimedTransaction = await Transaction.findOneAndUpdate(
        {
          transactionId: transaction.transactionId,
          customerId: session.userId,
          $or: [{ razorpayOrderId: { $exists: false } }, { razorpayOrderId: null }],
        },
        { $set: { razorpayOrderId: createdOrder.id } },
        { new: true }
      );
      if (claimedTransaction) {
        order = createdOrder;
      } else {
        const latestTransaction = await Transaction.findOne({
          transactionId: transaction.transactionId,
          customerId: session.userId,
        });
        if (!latestTransaction?.razorpayOrderId) {
          throw new Error('Could not associate the payment order with this transaction.');
        }
        order = await razorpayRequest<RazorpayOrder>(
          `/orders/${encodeURIComponent(latestTransaction.razorpayOrderId)}`,
          'GET'
        );
      }
    }

    if (order.amount !== amount || order.currency !== 'INR') {
      return NextResponse.json({ error: 'The payment order does not match this transaction.' }, { status: 409 });
    }
    if (order.status === 'paid') {
      return NextResponse.json(
        { error: 'A payment is already being verified. Refresh your transaction history.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      keyId,
      order,
      merchantName: merchant.shopName,
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'statusCode' in err) {
      return authErrorResponse(err);
    }
    console.error('Razorpay Create Order Error:', err);
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
  }
}
