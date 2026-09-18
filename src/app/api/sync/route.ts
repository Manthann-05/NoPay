import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSessionUser } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Transaction } from '@/models/Transaction';
import { SyncLog } from '@/models/SyncLog';
import { Bill } from '@/models/Bill';
import { MerchantProfile } from '@/models/MerchantProfile';
import { TransactionSyncSchema } from '@/lib/validation/schemas';

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to sync transactions' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validated = TransactionSyncSchema.parse(body);

    await connectToDatabase();

    // 1. IDEMPOTENCY CHECK: Find if transaction with idempotencyKey already exists
    const existingTxn = await Transaction.findOne({ idempotencyKey: validated.idempotencyKey });

    if (existingTxn) {
      console.log(`⚡ Idempotency key match found for ${validated.idempotencyKey}. Returning existing record.`);

      // Log sync attempt
      await SyncLog.create({
        transactionId: existingTxn.transactionId,
        idempotencyKey: validated.idempotencyKey,
        attempts: 1,
        state: 'CONFIRMED',
        error: 'Duplicate request intercepted by idempotency guard',
      });

      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Transaction already processed previously (Idempotency Key match)',
        transaction: existingTxn,
      });
    }

    // 2. Fetch authoritative Merchant Profile
    let merchantName = validated.merchantName || 'NoPay Merchant';
    if (mongoose.Types.ObjectId.isValid(validated.merchantId)) {
      const profile = await MerchantProfile.findOne({
        $or: [
          { _id: validated.merchantId },
          { userId: validated.merchantId }
        ]
      });
      if (profile?.shopName) {
        merchantName = profile.shopName;
      }
    }

    // 3. If it's a Bill QR, verify bill existence & server total
    let validatedAmount = validated.amount;
    let billSummary;

    if (validated.billId) {
      const bill = await Bill.findOne({ billId: validated.billId });
      if (bill) {
        validatedAmount = bill.total; // Enforce authoritative server bill total
        billSummary = {
          itemsCount: bill.items.length,
          total: bill.total,
        };
        bill.status = 'PAID';
        await bill.save();
      }
    }

    // 4. Create new synchronized Transaction record using session user identity
    const customerId = session.userId;
    const customerName = session.name;

    const newTxn = await Transaction.create({
      transactionId: validated.transactionId,
      merchantId: validated.merchantId,
      merchantName,
      customerId,
      customerName,
      billId: validated.billId,
      billSummary,
      amount: validatedAmount,
      type: validated.type,
      status: 'CONFIRMED', // Mark confirmed upon successful server sync & validation
      idempotencyKey: validated.idempotencyKey,
      offlineCreated: validated.offlineCreated,
      syncedAt: new Date(),
    });

    // 5. Record Sync Log
    await SyncLog.create({
      transactionId: newTxn.transactionId,
      idempotencyKey: validated.idempotencyKey,
      attempts: 1,
      state: 'CONFIRMED',
    });

    return NextResponse.json({
      success: true,
      idempotent: false,
      message: 'Transaction synchronized & verified successfully',
      transaction: newTxn,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ success: false, error: err.errors[0].message }, { status: 400 });
    }

    // Handle Mongo Duplicate Key Error fallback
    if (err.code === 11000) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Duplicate key intercepted by database index',
      });
    }

    console.error('Sync API Error:', err);
    return NextResponse.json({ success: false, error: 'Server failed to process sync' }, { status: 500 });
  }
}

