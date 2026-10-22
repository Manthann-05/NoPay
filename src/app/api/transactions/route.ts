import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Transaction } from '@/models/Transaction';
import { AutoPayAttempt } from '@/models/AutoPayAttempt';

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');

    await connectToDatabase();

    const query: any = {};

    if (session.activeRole === 'MERCHANT') {
      if (!session.merchantProfileId) {
        return NextResponse.json({ error: 'Merchant profile is unavailable.' }, { status: 403 });
      }
      query.merchantId = session.merchantProfileId;
    } else {
      query.customerId = session.userId;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const billIds = transactions.flatMap((transaction) =>
      transaction.billId ? [transaction.billId] : []
    );
    const attempts = billIds.length
      ? await AutoPayAttempt.find({ billId: { $in: billIds } })
          .select('billId status paymentAfter')
          .lean()
      : [];
    const attemptsByBill = new Map(attempts.map((attempt) => [attempt.billId, attempt]));

    return NextResponse.json({
      transactions: transactions.map((transaction) => {
        const attempt = transaction.billId ? attemptsByBill.get(transaction.billId) : undefined;
        return {
          ...transaction,
          autopayStatus: attempt?.status,
          autopayPaymentAfter: attempt?.paymentAfter,
        };
      }),
    });
  } catch (err) {
    console.error('Transactions GET Error:', err);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
