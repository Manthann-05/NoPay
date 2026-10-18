import { randomUUID } from 'crypto';
import type { IBill } from '@/models/Bill';
import type { ITransaction } from '@/models/Transaction';
import { AutoPayAttempt } from '@/models/AutoPayAttempt';
import { AutoPayMandate } from '@/models/AutoPayMandate';
import { Bill } from '@/models/Bill';
import { MerchantProfile } from '@/models/MerchantProfile';
import { Transaction } from '@/models/Transaction';
import { getRazorpay, isRazorpayAutoPayEnabled, isRazorpayRouteEnabled, razorpayRequest } from '@/lib/payments/razorpay';

interface RazorpayOrder {
  id: string;
  notification?: { payment_after?: number };
}

interface RazorpayRecurringPayment {
  id: string;
  status: string;
}

export type AutoPayScheduleResult =
  | { status: 'SCHEDULED'; paymentAfter: Date }
  | { status: 'SKIPPED'; reason: string };

export async function scheduleBillAutoPay(
  bill: IBill,
  transaction: ITransaction
): Promise<AutoPayScheduleResult> {
  if (!isRazorpayAutoPayEnabled() || !isRazorpayRouteEnabled()) {
    return { status: 'SKIPPED', reason: 'provider_disabled' };
  }
  if (bill.status === 'PAID' || bill.status === 'CANCELLED' || bill.status === 'EXPIRED') {
    return { status: 'SKIPPED', reason: 'bill_not_outstanding' };
  }
  if (
    transaction.type !== 'BILL_QR' ||
    transaction.deferredPaymentConsent !== true ||
    !transaction.deferredPaymentConsentAt
  ) {
    return { status: 'SKIPPED', reason: 'customer_did_not_request_deferred_payment' };
  }
  if (!transaction.customerId) {
    return { status: 'SKIPPED', reason: 'customer_not_identified' };
  }
  if (
    !bill.customerId ||
    String(bill.customerId) !== String(transaction.customerId) ||
    bill.transactionId !== transaction.transactionId ||
    Math.abs(Number(bill.total) - Number(transaction.amount)) >= 0.005
  ) {
    return { status: 'SKIPPED', reason: 'bill_transaction_mismatch' };
  }

  const [merchant, mandate] = await Promise.all([
    MerchantProfile.findById(bill.merchantId).select('+razorpayLinkedAccountId'),
    AutoPayMandate.findOne({
      customerId: transaction.customerId,
      merchantId: bill.merchantId,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    }).select('+razorpayCustomerId +razorpayTokenId'),
  ]);

  if (
    !merchant?.razorpayLinkedAccountId ||
    !['CREATED', 'ACTIVATED', 'ACTIVE'].includes(merchant.razorpayLinkedAccountStatus || '') ||
    merchant.razorpaySettlementStatus !== 'VERIFIED'
  ) {
    return { status: 'SKIPPED', reason: 'merchant_payout_not_verified' };
  }
  if (!mandate?.razorpayTokenId) {
    return { status: 'SKIPPED', reason: 'no_active_mandate' };
  }

  const amountPaise = Math.round(Number(bill.total) * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    return { status: 'SKIPPED', reason: 'invalid_bill_amount' };
  }
  if (Number(bill.total) > mandate.maxAmount) {
    return { status: 'SKIPPED', reason: 'mandate_limit_exceeded' };
  }

  const existingAttempt = await AutoPayAttempt.findOne({ billId: bill.billId });
  if (existingAttempt) {
    if (existingAttempt.status === 'SCHEDULED') {
      return { status: 'SCHEDULED', paymentAfter: existingAttempt.paymentAfter };
    }
    return { status: 'SKIPPED', reason: 'attempt_already_exists' };
  }

  let attempt;
  try {
    attempt = await AutoPayAttempt.create({
      billId: bill.billId,
      transactionId: transaction.transactionId,
      customerId: transaction.customerId,
      merchantId: bill.merchantId,
      mandateId: mandate._id,
      amountPaise,
      status: 'SCHEDULING',
      paymentAfter: new Date(Date.now() + 26 * 60 * 60 * 1000),
    });
    await Transaction.updateOne(
      { transactionId: transaction.transactionId, paymentStatus: { $ne: 'PAID' } },
      { $set: { autopayStatus: 'SCHEDULING' } }
    );
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 11000) {
      return { status: 'SKIPPED', reason: 'attempt_already_exists' };
    }
    throw err;
  }

  try {
    const razorpay = getRazorpay();
    const providerCustomer = await razorpay.customers.fetch(mandate.razorpayCustomerId);
    if (!providerCustomer.contact) {
      throw new Error('The customer phone number is missing from the Razorpay customer profile.');
    }

    const order = await razorpayRequest<RazorpayOrder>('/orders', 'POST', {
      amount: amountPaise,
      currency: 'INR',
      payment_capture: true,
      receipt: `np_${randomUUID().replace(/-/g, '')}`,
      notification: { token_id: mandate.razorpayTokenId },
      notes: {
        nopay_bill_id: bill.billId,
        nopay_transaction_id: transaction.transactionId,
        nopay_attempt_id: String(attempt._id),
      },
    });

    const paymentAfter = order.notification?.payment_after
      ? new Date(order.notification.payment_after * 1000)
      : new Date(Date.now() + 26 * 60 * 60 * 1000);
    attempt.razorpayOrderId = order.id;
    attempt.paymentAfter = paymentAfter;
    await attempt.save();

    const payment = await razorpayRequest<RazorpayRecurringPayment>(
      '/payments/create/recurring',
      'POST',
      {
      email: providerCustomer.email || '',
      contact: providerCustomer.contact,
      amount: amountPaise,
      currency: 'INR',
      order_id: order.id,
      customer_id: mandate.razorpayCustomerId,
      token: mandate.razorpayTokenId,
      recurring: true,
      description: `NoPay bill ${bill.billId}`.slice(0, 50),
      notes: {
        nopay_bill_id: bill.billId,
        nopay_transaction_id: transaction.transactionId,
        nopay_attempt_id: String(attempt._id),
      },
      }
    );

    const scheduledAttempt = await AutoPayAttempt.findOneAndUpdate(
      { _id: attempt._id, status: 'SCHEDULING' },
      {
        $set: {
          razorpayPaymentId: payment.id,
          status: 'SCHEDULED',
        },
      },
      { new: true }
    );
    if (scheduledAttempt) {
      await Bill.updateOne(
        { billId: bill.billId, status: { $ne: 'PAID' } },
        { $set: { status: 'AUTOPAY_SCHEDULED', autopayOrderId: order.id } }
      );
      await Transaction.updateOne(
        { transactionId: transaction.transactionId, paymentStatus: { $ne: 'PAID' } },
        {
          $set: {
            paymentStatus: 'AUTOPAY_SCHEDULED',
            autopayStatus: 'SCHEDULED',
            autopayPaymentAfter: paymentAfter,
          },
        }
      );
    }

    return { status: 'SCHEDULED', paymentAfter };
  } catch (err: unknown) {
    await AutoPayAttempt.updateOne(
      { _id: attempt._id, status: 'SCHEDULING' },
      {
        $set: {
          status: 'FAILED',
          failureReason: 'Razorpay could not schedule the debit.',
        },
      }
    );
    await Transaction.updateOne(
      { transactionId: transaction.transactionId, paymentStatus: { $ne: 'PAID' } },
      { $set: { autopayStatus: 'FAILED' } }
    );
    console.error('AutoPay scheduling failed for attempt:', String(attempt._id));
    return { status: 'SKIPPED', reason: 'provider_request_failed' };
  }
}

export async function markAutoPayPaymentCaptured(
  attemptId: string,
  paymentId: string
): Promise<void> {
  const attempt = await AutoPayAttempt.findOneAndUpdate(
    { _id: attemptId, status: { $in: ['SCHEDULING', 'SCHEDULED'] } },
    { $set: { status: 'CAPTURED', razorpayPaymentId: paymentId } },
    { new: true }
  );
  const capturedAttempt =
    attempt ||
    (await AutoPayAttempt.findOne({
      _id: attemptId,
      status: { $in: ['CAPTURED', 'TRANSFER_FAILED'] },
      razorpayPaymentId: paymentId,
    }));
  if (!capturedAttempt) return;

  const bill = await Bill.findOne({ billId: capturedAttempt.billId });
  if (!bill) {
    throw new Error('AutoPay bill was not found for a captured payment.');
  }

  bill.status = 'PAID';
  bill.paymentReference = paymentId;
  await bill.save();
  await Transaction.updateOne(
    { transactionId: capturedAttempt.transactionId },
    {
      $set: {
        paymentStatus: 'PAID',
        paymentReference: paymentId,
        autopayStatus: 'CAPTURED',
        autopayPaymentAfter: capturedAttempt.paymentAfter,
      },
    }
  );

  const merchant = await MerchantProfile.findById(capturedAttempt.merchantId).select(
    '+razorpayLinkedAccountId razorpayLinkedAccountStatus razorpaySettlementStatus'
  );
  if (
    !merchant?.razorpayLinkedAccountId ||
    !['CREATED', 'ACTIVATED', 'ACTIVE'].includes(merchant.razorpayLinkedAccountStatus || '') ||
    merchant.razorpaySettlementStatus !== 'VERIFIED'
  ) {
    capturedAttempt.status = 'TRANSFER_FAILED';
    capturedAttempt.failureReason = 'Merchant payout account is not verified.';
    await capturedAttempt.save();
    return;
  }

  try {
    if (capturedAttempt.razorpayTransferId) {
      const razorpay = getRazorpay();
      const transfer = await razorpay.transfers.fetch(capturedAttempt.razorpayTransferId);
      capturedAttempt.status = transfer.status === 'processed' ? 'TRANSFERRED' : 'TRANSFER_PENDING';
      await capturedAttempt.save();
      await Transaction.updateOne(
        { transactionId: capturedAttempt.transactionId },
        { $set: { autopayStatus: capturedAttempt.status } }
      );
      return;
    }
    if (capturedAttempt.status === 'TRANSFER_FAILED') {
      return;
    }

    const createdTransfer = await razorpayRequest<{ id: string; status: string }>(
      '/transfers',
      'POST',
      {
        account: merchant.razorpayLinkedAccountId,
        amount: capturedAttempt.amountPaise,
        currency: 'INR',
        notes: {
          nopay_bill_id: capturedAttempt.billId,
          nopay_attempt_id: String(capturedAttempt._id),
        },
      },
      String(capturedAttempt._id)
    );
    const transferStatus = createdTransfer.status === 'processed' ? 'TRANSFERRED' : 'TRANSFER_PENDING';
    await AutoPayAttempt.updateOne(
      { _id: capturedAttempt._id, status: { $in: ['CAPTURED', 'TRANSFER_PENDING'] } },
      {
        $set: {
          razorpayTransferId: createdTransfer.id,
          status: transferStatus,
        },
        $unset: { failureReason: 1 },
      }
    );
    await Transaction.updateOne(
      { transactionId: capturedAttempt.transactionId },
      { $set: { autopayStatus: transferStatus } }
    );
  } catch (err: unknown) {
    capturedAttempt.status = 'TRANSFER_FAILED';
    capturedAttempt.failureReason = 'NoPay could not complete the merchant payout. Support action is required.';
    await capturedAttempt.save();
    await Transaction.updateOne(
      { transactionId: capturedAttempt.transactionId },
      { $set: { autopayStatus: 'TRANSFER_FAILED' } }
    );
    console.error('AutoPay merchant transfer failed for attempt:', String(capturedAttempt._id));
  }
}

export async function markAutoPayPaymentFailed(attemptId: string, reason?: string): Promise<void> {
  const attempt = await AutoPayAttempt.findById(attemptId);
  if (!attempt || attempt.status === 'CAPTURED' || attempt.status === 'TRANSFERRED') return;

  attempt.status = 'FAILED';
  attempt.failureReason = reason?.slice(0, 300) || 'Provider reported a failed AutoPay debit.';
  await attempt.save();
  await Bill.updateOne(
    { billId: attempt.billId, status: { $ne: 'PAID' } },
    { $set: { status: 'PAYMENT_FAILED' } }
  );
  await Transaction.updateOne(
    { transactionId: attempt.transactionId, paymentStatus: { $ne: 'PAID' } },
    { $set: { paymentStatus: 'FAILED', autopayStatus: 'FAILED' } }
  );
}
