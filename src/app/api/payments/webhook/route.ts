import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { connectToDatabase } from '@/lib/db/mongodb';
import { AutoPayAttempt } from '@/models/AutoPayAttempt';
import { AutoPayMandate } from '@/models/AutoPayMandate';
import { MerchantProfile } from '@/models/MerchantProfile';
import { PaymentWebhookEvent } from '@/models/PaymentWebhookEvent';
import { Bill } from '@/models/Bill';
import { Transaction } from '@/models/Transaction';
import {
  markAutoPayPaymentCaptured,
  markAutoPayPaymentFailed,
} from '@/lib/payments/autopay';
import { markTransactionPaymentCaptured } from '@/lib/payments/transactionPayment';
import { getRazorpay } from '@/lib/payments/razorpay';

interface RazorpayWebhook {
  event?: string;
  payload?: {
    token?: { entity?: Record<string, unknown> };
    payment?: { entity?: Record<string, unknown> };
    transfer?: { entity?: Record<string, unknown> };
    merchant_product?: { entity?: Record<string, unknown> };
  };
}

function isValidSignature(body: string, received: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest();
  const actual = Buffer.from(received, 'hex');
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}

function getAttemptId(entity: Record<string, unknown>): string | null {
  const notes = entity.notes;
  if (typeof notes !== 'object' || notes === null || !('nopay_attempt_id' in notes)) {
    return null;
  }
  const value = (notes as Record<string, unknown>).nopay_attempt_id;
  return typeof value === 'string' ? value : null;
}

function getTransactionId(entity: Record<string, unknown>): string | null {
  const notes = entity.notes;
  if (typeof notes !== 'object' || notes === null || !('nopay_transaction_id' in notes)) {
    return null;
  }
  const value = (notes as Record<string, unknown>).nopay_transaction_id;
  return typeof value === 'string' ? value : null;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers.get('x-razorpay-signature');
  const eventId = req.headers.get('x-razorpay-event-id');
  if (!webhookSecret || !signature || !eventId) {
    return NextResponse.json({ error: 'Webhook verification is not configured.' }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!isValidSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  let payload: RazorpayWebhook;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }
  if (!payload.event) {
    return NextResponse.json({ error: 'Webhook event is missing.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    await PaymentWebhookEvent.create({ eventId, eventType: payload.event });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 11000) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('Could not reserve Razorpay webhook event:', err);
    return NextResponse.json({ error: 'Webhook could not be recorded.' }, { status: 500 });
  }

  try {
    if (payload.event === 'payment.authorized') {
      const payment = payload.payload?.payment?.entity;
      if (
        payment &&
        typeof payment.order_id === 'string' &&
        typeof payment.token_id === 'string' &&
        typeof payment.customer_id === 'string'
      ) {
        const mandate = await AutoPayMandate.findOne({
          razorpayOrderId: payment.order_id,
          status: 'PENDING',
        }).select('+razorpayOrderId +razorpayCustomerId');
        if (mandate && payment.customer_id === mandate.razorpayCustomerId) {
          mandate.razorpayTokenId = payment.token_id;
          const token = await getRazorpay().tokens.fetch({ id: payment.token_id });
          if (token.recurring_details?.status === 'confirmed' || token.status === 'active') {
            mandate.status = 'ACTIVE';
            mandate.activatedAt = new Date();
          }
          await mandate.save();
        }
      }
    } else if (payload.event === 'token.confirmed') {
      const token = payload.payload?.token?.entity;
      if (token && typeof token.id === 'string') {
        const mandate = await AutoPayMandate.findOne({
          razorpayTokenId: token.id,
          status: 'PENDING',
        });
        if (mandate) {
          mandate.status = 'ACTIVE';
          mandate.activatedAt = new Date();
          await mandate.save();
        }
      }
    } else if (payload.event === 'token.cancelled') {
      const token = payload.payload?.token?.entity;
      if (token && typeof token.id === 'string') {
        await AutoPayMandate.findOneAndUpdate(
          { razorpayTokenId: token.id, status: 'CANCELLATION_PENDING' },
          { $set: { status: 'REVOKED', revokedAt: new Date() } }
        );
      }
    } else if (payload.event === 'token.rejected') {
      const token = payload.payload?.token?.entity;
      if (token && typeof token.id === 'string') {
        await AutoPayMandate.updateOne(
          { razorpayTokenId: token.id, status: 'PENDING' },
          { $set: { status: 'FAILED' } }
        );
      }
    } else if (payload.event === 'payment.captured' || payload.event === 'payment.failed') {
      const payment = payload.payload?.payment?.entity;
      const attemptId = payment ? getAttemptId(payment) : null;
      if (payment && attemptId) {
        const attempt = await AutoPayAttempt.findById(attemptId);
        if (
          !attempt ||
          (attempt.razorpayOrderId && attempt.razorpayOrderId !== payment.order_id) ||
          attempt.amountPaise !== payment.amount
        ) {
          throw new Error('Razorpay payment did not match its AutoPay attempt.');
        }

        if (payload.event === 'payment.captured') {
          if (
            typeof payment.id !== 'string' ||
            payment.status !== 'captured' ||
            payment.captured !== true
          ) {
            throw new Error('Razorpay capture event did not contain a captured payment.');
          }
          await markAutoPayPaymentCaptured(attemptId, payment.id);
        } else {
          await markAutoPayPaymentFailed(
            attemptId,
            typeof payment.error_code === 'string' ? payment.error_code : undefined
          );
        }
      } else if (payment) {
        const transactionId = getTransactionId(payment);
        if (transactionId && typeof payment.order_id === 'string') {
          const transaction = await Transaction.findOne({ transactionId });
          if (
            !transaction ||
            transaction.razorpayOrderId !== payment.order_id ||
            Math.round(transaction.amount * 100) !== payment.amount
          ) {
            throw new Error('Razorpay payment did not match its NoPay transaction.');
          }
          if (payload.event === 'payment.captured') {
            if (
              typeof payment.id !== 'string' ||
              payment.status !== 'captured' ||
              payment.captured !== true
            ) {
              throw new Error('Razorpay capture event did not contain a captured payment.');
            }
            await markTransactionPaymentCaptured(transactionId, payment.id);
            if (transaction.type === 'BILL_QR' && transaction.billId) {
              await Bill.updateOne(
                { billId: transaction.billId, status: { $ne: 'PAID' } },
                { $set: { status: 'PAID', paymentReference: payment.id } }
              );
            }
          } else {
            await Transaction.updateOne(
              { transactionId, paymentStatus: { $ne: 'PAID' } },
              { $set: { paymentStatus: 'FAILED', failureReason: 'Razorpay reported a failed payment.' } }
            );
          }
        } else if (
          payload.event === 'payment.failed' &&
          typeof payment.order_id === 'string'
        ) {
          await AutoPayMandate.updateOne(
            { razorpayOrderId: payment.order_id, status: 'PENDING' },
            { $set: { status: 'FAILED' } }
          );
        }
      }
    } else if (payload.event === 'transfer.processed' || payload.event === 'transfer.failed') {
      const transfer = payload.payload?.transfer?.entity;
      if (transfer && typeof transfer.id === 'string') {
        const attemptId = getAttemptId(transfer);
        const attempt = attemptId
          ? await AutoPayAttempt.findById(attemptId)
          : await AutoPayAttempt.findOne({ razorpayTransferId: transfer.id });
        if (attempt && (!attempt.razorpayTransferId || attempt.razorpayTransferId === transfer.id)) {
          attempt.razorpayTransferId = transfer.id;
          attempt.status =
            payload.event === 'transfer.processed' ? 'TRANSFERRED' : 'TRANSFER_FAILED';
          if (payload.event === 'transfer.failed') {
            attempt.failureReason = 'Razorpay reported a failed merchant transfer.';
          } else {
            attempt.failureReason = undefined;
          }
          await attempt.save();
        } else {
          const transactionId = getTransactionId(transfer);
          if (transactionId) {
            await Transaction.updateOne(
              {
                transactionId,
                $or: [{ razorpayTransferId: { $exists: false } }, { razorpayTransferId: transfer.id }],
              },
              {
                $set: {
                  razorpayTransferId: transfer.id,
                  payoutStatus: payload.event === 'transfer.processed' ? 'TRANSFERRED' : 'TRANSFER_FAILED',
                  ...(payload.event === 'transfer.failed'
                    ? { failureReason: 'Razorpay reported a failed merchant payout.' }
                    : {}),
                },
              }
            );
          }
        }
      }
    } else if (
      payload.event === 'product.route.under_review' ||
      payload.event === 'product.route.needs_clarification' ||
      payload.event === 'product.route.activated'
    ) {
      const product = payload.payload?.merchant_product?.entity;
      if (product && typeof product.merchant_id === 'string') {
        const status =
          payload.event === 'product.route.activated'
            ? 'ACTIVATED'
            : payload.event === 'product.route.under_review'
              ? 'UNDER_REVIEW'
              : 'NEEDS_CLARIFICATION';
        await MerchantProfile.updateOne(
          { razorpayLinkedAccountId: product.merchant_id },
          {
            $set: {
              razorpayLinkedAccountStatus: status,
            },
          }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    await PaymentWebhookEvent.deleteOne({ eventId });
    console.error('Could not process Razorpay webhook event:', payload.event);
    return NextResponse.json({ error: 'Webhook event processing failed.' }, { status: 500 });
  }
}
