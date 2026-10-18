import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getSessionUser } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/mongodb';
import { Transaction } from '@/models/Transaction';
import { SyncLog } from '@/models/SyncLog';
import { Bill } from '@/models/Bill';
import { MerchantProfile } from '@/models/MerchantProfile';
import { TransactionSyncSchema } from '@/lib/validation/schemas';
import { isBillExpired } from '@/lib/status/labels';
import { scheduleBillAutoPay, type AutoPayScheduleResult } from '@/lib/payments/autopay';

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Your session has expired. Please sign in again.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validated = TransactionSyncSchema.parse(body);

    await connectToDatabase();

    const existingTxn = await Transaction.findOne({
      $or: [{ idempotencyKey: validated.idempotencyKey }, { transactionId: validated.transactionId }],
    });

    if (existingTxn) {
      if (existingTxn.idempotencyKey === validated.idempotencyKey) {
        if (String(existingTxn.customerId) !== String(session.userId)) {
          return NextResponse.json(
            { success: false, error: 'This idempotency key belongs to another customer.' },
            { status: 409 }
          );
        }
        let autoPay: AutoPayScheduleResult = { status: 'SKIPPED', reason: 'not_eligible' };
        if (existingTxn.type === 'BILL_QR' && existingTxn.billId) {
          const existingBill = await Bill.findOne({ billId: existingTxn.billId });
          if (existingBill && existingBill.status !== 'PAID') {
            autoPay = await scheduleBillAutoPay(existingBill, existingTxn);
          }
        }
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
          message: 'Transaction already processed',
          transaction: existingTxn,
          autoPay,
        });
      }

      return NextResponse.json(
        { success: false, error: 'A different transaction already uses this ID.' },
        { status: 409 }
      );
    }

    let merchant = null;
    if (mongoose.Types.ObjectId.isValid(validated.merchantId)) {
      merchant = await MerchantProfile.findById(validated.merchantId);
      if (!merchant) {
        merchant = await MerchantProfile.findOne({ userId: validated.merchantId });
      }
    } else {
      merchant = await MerchantProfile.findOne({ userId: validated.merchantId });
    }

    if (!merchant) {
      return NextResponse.json(
        { success: false, error: 'The transaction merchant ID does not match a registered merchant.' },
        { status: 400 }
      );
    }

    const merchantName = merchant.shopName;
    let amount = validated.amount;
    let billSummary;
    let billForAutoPay = null;
    let paymentStatus: 'UNVERIFIED' | 'PENDING' = 'UNVERIFIED';

    if (validated.type === 'STATIC_QR') {
      if (!(amount > 0)) {
        return NextResponse.json(
          { success: false, error: 'Enter an amount greater than zero.' },
          { status: 400 }
        );
      }
    }

    if (validated.type === 'BILL_QR') {
      if (!validated.billId) {
        return NextResponse.json({ success: false, error: 'Bill QR is missing bill details.' }, { status: 400 });
      }

      const bill = await Bill.findOne({ billId: validated.billId });
      if (!bill) {
        return NextResponse.json(
          { success: false, error: 'This bill is not registered with NoPay and cannot be collected.' },
          { status: 400 }
        );
      }
      if (String(bill.merchantId) !== String(merchant._id)) {
        return NextResponse.json(
          { success: false, error: 'This bill does not belong to the scanned merchant.' },
          { status: 400 }
        );
      }

      if (bill.status === 'EXPIRED' || bill.status === 'CANCELLED') {
        return NextResponse.json({ success: false, error: 'Bill Expired' }, { status: 400 });
      }

      if (isBillExpired(bill.expiresAt)) {
        bill.status = 'EXPIRED';
        await bill.save();
        return NextResponse.json({ success: false, error: 'Bill Expired' }, { status: 400 });
      }

      if (bill.transactionId && bill.transactionId !== validated.transactionId) {
        return NextResponse.json(
          { success: false, error: 'This transaction does not match the bill.' },
          { status: 400 }
        );
      }

      if (bill.status === 'PAID') {
        return NextResponse.json({ success: false, error: 'This bill has already been paid.' }, { status: 409 });
      }

      if (!amountsMatch(validated.amount, bill.total)) {
        return NextResponse.json(
          { success: false, error: 'Amount does not match the bill total.' },
          { status: 400 }
        );
      }

      if (bill.customerId && String(bill.customerId) !== String(session.userId)) {
        return NextResponse.json({ success: false, error: 'This bill is assigned to another customer.' }, { status: 409 });
      }

      amount = Number(bill.total);
      billSummary = {
        itemsCount: bill.items.length,
        total: bill.total,
      };
      bill.customerId = new mongoose.Types.ObjectId(session.userId);
      bill.status = 'PENDING';
      await bill.save();
      billForAutoPay = bill;
      paymentStatus = 'PENDING';
    }

    const newTxn = await Transaction.create({
      transactionId: validated.transactionId,
      merchantId: merchant._id,
      merchantName,
      customerId: session.userId,
      customerName: session.name,
      billId: validated.billId,
      billSummary,
      amount,
      type: validated.type,
      status: 'CONFIRMED',
      paymentStatus,
      deferredPaymentConsent: validated.type === 'BILL_QR' && validated.deferredPaymentConsent,
      deferredPaymentConsentAt:
        validated.type === 'BILL_QR' && validated.deferredPaymentConsent ? new Date() : undefined,
      idempotencyKey: validated.idempotencyKey,
      offlineCreated: validated.offlineCreated,
      syncedAt: new Date(),
    });

    await SyncLog.create({
      transactionId: newTxn.transactionId,
      idempotencyKey: validated.idempotencyKey,
      attempts: 1,
      state: 'CONFIRMED',
    });

    let autoPay: AutoPayScheduleResult = {
      status: 'SKIPPED',
      reason: 'unverified_bill_or_static_qr',
    };
    if (billForAutoPay) {
      autoPay = await scheduleBillAutoPay(billForAutoPay, newTxn);
    }

    return NextResponse.json({
      success: true,
      idempotent: false,
      message: 'Transaction record synchronized; payment remains unverified until a provider capture.',
      transaction: newTxn,
      autoPay,
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err && (err as { name?: string }).name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: (err as { errors: { message: string }[] }).errors[0].message },
        { status: 400 }
      );
    }

    if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Transaction already processed',
      });
    }

    console.error('Sync API Error:', err);
    return NextResponse.json({ success: false, error: 'Could not sync this transaction. Please try again.' }, { status: 500 });
  }
}
